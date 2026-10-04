-- CareRide schema
-- PostgreSQL 15+ with PostGIS.
-- Apply on Google Cloud SQL for PostgreSQL, or on Neon / Vercel Postgres as a backup.
-- Run as a database user allowed to create the PostGIS and pgcrypto extensions.
-- Cloud Run connects through the attached Cloud SQL Unix socket; its proxy handles TLS.
-- Direct remote DATABASE_URL / POSTGRES_URL connections need the provider's TLS settings.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION care_ride_weekdays_ok(days smallint[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT days IS NULL
    OR (
      cardinality(days) > 0
      AND days <@ ARRAY[0, 1, 2, 3, 4, 5, 6]::smallint[]
    );
$$;

CREATE OR REPLACE FUNCTION care_ride_month_days_ok(days smallint[])
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT days IS NULL
    OR (
      cardinality(days) > 0
      AND days <@ ARRAY[
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
        11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
        21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31
      ]::smallint[]
    );
$$;

CREATE TABLE organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Staff are a login type. There is no organization type and no staff role column.
CREATE TABLE staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL UNIQUE,
  phone text NOT NULL,
  password_hash text NOT NULL,
  is_active boolean NOT NULL DEFAULT true
);

-- organization_id keeps each partner's clients inside that organization.
CREATE TABLE clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  dob date NOT NULL,
  address text,
  has_smartphone boolean NOT NULL DEFAULT false,
  phone text,
  email text,
  emergency_contact_name text,
  emergency_contact_phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT clients_notes_length CHECK (notes IS NULL OR char_length(notes) <= 50)
);

-- latitude, longitude, location_type, and is_active support the map pin and address book.
CREATE TABLE addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  name text NOT NULL,
  address text NOT NULL,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  location_type text NOT NULL DEFAULT 'service'
    CHECK (location_type IN ('hospital', 'shelter', 'service')),
  is_active boolean NOT NULL DEFAULT true
);

-- password_hash is required because drivers are a login type.
CREATE TABLE drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  dob date NOT NULL,
  email text NOT NULL UNIQUE,
  phone text NOT NULL,
  password_hash text NOT NULL
);

CREATE TABLE vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers (id) ON DELETE CASCADE,
  make text NOT NULL,
  model text NOT NULL,
  plate_number text NOT NULL CHECK (char_length(plate_number) BETWEEN 1 AND 8),
  seats integer NOT NULL CHECK (seats > 0),
  wheelchair_accessible boolean NOT NULL DEFAULT false
);

CREATE TABLE driver_availabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers (id) ON DELETE CASCADE,
  centre geography(Point, 4326) NOT NULL,
  radius_m double precision NOT NULL CHECK (radius_m > 0),
  is_active boolean NOT NULL DEFAULT true,
  kind text NOT NULL CHECK (kind IN ('one_time', 'weekly', 'monthly')),
  start_time time NOT NULL,
  end_time time NOT NULL,
  timezone text NOT NULL DEFAULT 'America/Vancouver',
  on_date date,
  weekdays smallint[],
  month_days smallint[],
  starts_on date,
  ends_on date,
  note text,
  CONSTRAINT availability_end_after_start CHECK (end_time > start_time),
  CONSTRAINT availability_kind_fields CHECK (
    (
      kind = 'one_time'
      AND on_date IS NOT NULL
      AND weekdays IS NULL
      AND month_days IS NULL
    )
    OR (
      kind = 'weekly'
      AND weekdays IS NOT NULL
      AND care_ride_weekdays_ok(weekdays)
      AND on_date IS NULL
      AND month_days IS NULL
    )
    OR (
      kind = 'monthly'
      AND month_days IS NOT NULL
      AND care_ride_month_days_ok(month_days)
      AND on_date IS NULL
      AND weekdays IS NULL
    )
  ),
  CONSTRAINT availability_weekdays_range CHECK (care_ride_weekdays_ok(weekdays)),
  CONSTRAINT availability_month_days_range CHECK (care_ride_month_days_ok(month_days))
);

CREATE INDEX driver_availabilities_centre_idx
  ON driver_availabilities
  USING gist (centre);

CREATE TABLE driver_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid NOT NULL REFERENCES drivers (id) ON DELETE CASCADE,
  approved_by_org_id uuid NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  approved_by_staff_id uuid REFERENCES staff (id) ON DELETE SET NULL,
  document_type text NOT NULL,
  document bytea NOT NULL,
  document_filename text,
  expires_on date,
  status text NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'expired')),
  reviewed_at timestamptz,
  reject_reason text
);

-- destination snapshots stay on the ride so later address-book edits do not rewrite history.
-- trip_group_id and linked_ride_id join the two one-way legs of a round trip.
CREATE TABLE ride_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES clients (id),
  requested_by_staff_id uuid NOT NULL REFERENCES staff (id),
  organization_id uuid NOT NULL REFERENCES organizations (id),
  pickup_address text NOT NULL,
  pickup_lat double precision NOT NULL,
  pickup_lng double precision NOT NULL,
  destination_id uuid NOT NULL REFERENCES addresses (id),
  destination_address text NOT NULL,
  destination_lat double precision NOT NULL,
  destination_lng double precision NOT NULL,
  requested_pickup_at timestamptz NOT NULL,
  passenger_count integer NOT NULL CHECK (passenger_count > 0),
  accessibility_needs text[] NOT NULL DEFAULT '{}',
  notes text,
  status text NOT NULL CHECK (
    status IN (
      'requested',
      'approved',
      'in_progress',
      'completed',
      'cancelled',
      'no_show',
      'timed_out'
    )
  ),
  driver_id uuid REFERENCES drivers (id),
  approved_by_user_id uuid REFERENCES staff (id),
  approved_at timestamptz,
  ride_option text NOT NULL DEFAULT 'free' CHECK (ride_option IN ('free', 'paid_external')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  cancelled_reason text,
  is_client_picked_up boolean NOT NULL DEFAULT false,
  is_client_dropped_off boolean NOT NULL DEFAULT false,
  trip_group_id uuid,
  linked_ride_id uuid,
  trip_leg text CHECK (trip_leg IN ('outbound', 'return')),
  CONSTRAINT ride_pickup_flag CHECK (
    NOT is_client_picked_up
    OR status IN ('in_progress', 'completed')
  ),
  CONSTRAINT ride_dropoff_flag CHECK (
    NOT is_client_dropped_off
    OR (status = 'completed' AND is_client_picked_up)
  ),
  CONSTRAINT ride_assigned_driver CHECK (
    status NOT IN ('approved', 'in_progress', 'completed', 'no_show')
    OR driver_id IS NOT NULL
  )
);

ALTER TABLE ride_requests
  ADD CONSTRAINT ride_requests_linked_ride_fk
  FOREIGN KEY (linked_ride_id) REFERENCES ride_requests (id)
  DEFERRABLE INITIALLY DEFERRED;

CREATE INDEX ride_requests_org_status_idx ON ride_requests (organization_id, status);
CREATE INDEX ride_requests_driver_idx ON ride_requests (driver_id);
CREATE INDEX ride_requests_open_idx ON ride_requests (status) WHERE status = 'requested';

-- One accepted dispatch row per ride. The claim transaction writes this with the assignment.
CREATE TABLE dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ride_request_id uuid NOT NULL REFERENCES ride_requests (id) ON DELETE CASCADE,
  driver_id uuid NOT NULL REFERENCES drivers (id) ON DELETE CASCADE,
  offered_at timestamptz NOT NULL DEFAULT now(),
  response text CHECK (response IN ('accepted', 'declined', 'expired')),
  responded_at timestamptz
);

CREATE UNIQUE INDEX dispatches_one_accepted_idx
  ON dispatches (ride_request_id)
  WHERE response = 'accepted';

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id uuid REFERENCES drivers (id) ON DELETE CASCADE,
  staff_id uuid REFERENCES staff (id) ON DELETE CASCADE,
  ride_request_id uuid REFERENCES ride_requests (id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  action_url text,
  channel text NOT NULL DEFAULT 'push' CHECK (channel IN ('push', 'sms', 'email', 'in_app')),
  metadata jsonb NOT NULL DEFAULT '{}',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT notifications_one_recipient CHECK (
    (driver_id IS NOT NULL AND staff_id IS NULL)
    OR (driver_id IS NULL AND staff_id IS NOT NULL)
  )
);

CREATE INDEX notifications_staff_idx ON notifications (staff_id, is_read);
CREATE INDEX notifications_driver_idx ON notifications (driver_id, is_read);
