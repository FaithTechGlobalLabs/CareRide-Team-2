# CareRide API

Updated: October 3, 2026.

The backend is Express in `backend/`. It reads and writes PostgreSQL. Schema, local setup, and the Cloud SQL / Vercel backup notes are in `docs/POSTGRES.md`. Uploaded verification documents are stored in the database.

Start it from `backend/` with `npm run dev`. Default origin is `http://localhost:3000`. Send `Authorization: Bearer <token>` after login. Errors use `{ "message": "..." }`. Unknown routes still return `{ "error": "Route not found" }`.

## Seed logins

- Staff: `alvin.demo@careride.local`, `aretha.demo@careride.local`, or `billy.demo@careride.local` / `CareRideDemo1`
- Drivers, already approved by Belkin: `olive.demo@careride.local`, `derek.demo@careride.local`, `kenton.demo@careride.local`, or `eshean.demo@careride.local` / `CareRideDemo1`

Seed records: Belkin Communities of Hope (`org_belkin`), clients Jamie Chen, Chong Demo, Winnie Demo, and Joe Demo, Belkin House, St. Paul's Hospital, and one completed sample ride. Clients are records managed by staff and do not have login accounts.

## Auth

`POST /auth/login` with `{ email, password }` returns `{ token, user }`.

`GET /auth/me` returns `{ user }`.

Staff `user.kind` is `"staff"`. Driver `user.kind` is `"driver"`. Both include `role` for the existing screens (`staff` or `driver`). Organizations no longer have a type.

## Organizations

`GET /organizations` is public. It returns `{ id, name }`.

`POST /organizations/register` creates the organization and its first staff login, then returns `{ token, user }`. Body: `name`, `email`, `phone`, `admin_name`, `admin_email`, `admin_password` (at least 8 characters). Optional `admin_phone`. A `type` field is ignored.

## Clients

Staff only. Clients are limited to the caller's organization.

- `GET /clients?q=`
- `POST /clients` — `first_name`, `last_name`, and `dob` required. `notes` max 50 characters. Optional `address`, `phone`, `email`, `has_smartphone`, `emergency_contact_name`, `emergency_contact_phone`.
- `PATCH /clients/:id`

## Address book

Staff only.

- `GET /destinations?q=&type=`
- `POST /destinations` — `name`, `type` (`hospital`, `shelter`, `service`), `address`, `lat`, `lng`. `is_active` defaults true.
- `PATCH /destinations/:id` — including `is_active`.

## Rides

`POST /rides` as staff. Required: `client_id`, `pickup_destination_id`, `destination_id`, `requested_pickup_at` (ISO), `passenger_count`. Optional: `appointment_at`, `accessibility_needs` (string or string array), `notes`, `urgency` (`routine`, `soon`, `time_sensitive`), `trip_type` (`one_way` or `round_trip`), `return_pickup_at` (required for round trip).

A round trip returns two rides that share `trip_group_id` and point at each other with `linked_ride_id`. Addresses are copied onto the ride. Response: `{ rides: [...] }`.

`GET /rides?status=&q=` for the staff organization. `GET /rides/:id` for that staff org, the assigned driver, or any driver while the ride is `requested`.

Ride objects add `client_name`, `driver_name`, `driver_phone`, and `vehicle` (`make`, `model`, `plate`, `seats`).

Staff: `POST /rides/:id/cancel` with `{ reason }`.

Driver:

- `GET /drivers/me/rides/available` — requested rides this driver can claim.
- `GET /drivers/me/rides` — rides already assigned to this driver.
- `POST /rides/:id/accept` — locks the row and assigns it only if it is still `requested` and the driver is eligible. Status becomes `approved`. The loser gets `409` and `{ message: "Already assigned" }`.
- `POST /rides/:id/pickup` — `approved` to `in_progress`, and sets `is_client_picked_up`.
- `POST /rides/:id/dropoff` — `in_progress` to `completed`, and sets `is_client_dropped_off`.
- `POST /rides/:id/no-show` — from `approved`.
- `POST /rides/:id/withdraw` — from `approved`, body `{ reason }`, returns the ride to `requested`.

The screens still look for status `accepted`. The database and API now use `approved` for a claimed ride. Pickup, no-show, and withdraw start from `approved`.

A driver can claim when Belkin (the booking's partner org) has approved them, the vehicle has enough seats, wheelchair rides have a wheelchair vehicle, and the pickup is inside an active availability window and radius. Olive's seed rule is weekly 06:00–22:00 `America/Vancouver`, 25 km around Belkin House, no minimum notice.

## Drivers

`POST /drivers/register` returns `{ token, user }`. Required: `name`, `dob`, `email`, `phone`, `password`, `make`, `model`, `plate` (max 8), `seats`. Optional: `wheelchair_accessible`, `affiliation` (`independent` or `transport_provider`), `organization_id` when affiliated.

- `GET /drivers/me/verifications`
- `POST /drivers/me/verifications` multipart fields: `document`, `organization_id` (partner org), `check_type`, optional `issued_on`, `expires_on`.
- `GET /drivers/me/availability`
- `POST /drivers/me/availability` — `kind` (`one_time`, `weekly`, `monthly`), `start_time`, `end_time` (`HH:MM`, end after start), `centre_lat`, `centre_lng`, `radius_km`, `minimum_notice_minutes`, `max_wait_minutes`. One-time needs `on_date`. Weekly needs `weekdays` (0–6, Sunday 0). Monthly needs `month_days`.
- `PATCH /drivers/me/availability/:id` with `{ is_active }`
- `DELETE /drivers/me/availability/:id`

## Admin and notifications

Staff admin of the partner org:

- `GET /admin/verifications`
- `POST /admin/verifications/:id/approve`
- `POST /admin/verifications/:id/reject` with `{ reason }`
- `GET /admin/verifications/:id/document`
- `GET /admin/demo-summary` — always labeled `Sample data`.

`GET /notifications` and `POST /notifications/:id/read` are for the staff user who booked the ride. Channel is `in_app`. Types used now: `confirmation`, `driver_assigned`, `completed`, `cancelled`.
