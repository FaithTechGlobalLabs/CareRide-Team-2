# PostgreSQL

Updated: October 3, 2026.

The API uses PostgreSQL. The schema is `backend/db/001_schema.sql`. It targets PostgreSQL 15 or 16 with PostGIS, which is the same shape for Google Cloud SQL and for a Neon / Vercel Postgres backup.

## What changed from the JSON store

- Organization rows have no type. Belkin Communities of Hope is the first organization, not a `partner_org` value.
- Staff and drivers are the two login types. Drivers store `password_hash` so they can log in. Staff have no role column. Any active staff member of an organization can approve a driver for that organization.
- Clients belong to an organization.
- Addresses keep a map pin (`latitude`, `longitude`), a location type, and an active flag so the address book can filter and deactivate places.
- Ride destinations must already be in the address book. The street address and pin are also copied onto the ride.
- A round trip is still two ride rows, linked by `trip_group_id` and `linked_ride_id`.
- Ride status is `requested`, `approved`, `in_progress`, `completed`, `cancelled`, `no_show`, or `timed_out`. A driver claim sets `approved`. There is no `accepted` status. Pickup and no-show start from `approved`.
- A requested ride whose pickup time has passed becomes `timed_out`.
- Driver service areas use a PostGIS geography point and a radius in metres.
- The winning claim writes the ride assignment and one `dispatches` row with `response = 'accepted'` in the same transaction. A partial unique index allows only one accepted dispatch per ride.
- Verification documents are stored in the database as `bytea`, so a database backup includes them.
- Notifications have one recipient, either `staff_id` or `driver_id`, and the message names the client and the places and time.

## Local database

Docker is not required if you already have Postgres with PostGIS. From the repo root, the compose file starts PostGIS 16:

```sh
docker compose up -d
```

Then, from `backend/`:

```sh
DATABASE_URL=postgres://careride:careride@localhost:5432/careride npm run db:setup
npm run dev
```

`db:setup` applies the schema once and seeds Belkin, the demo staff and drivers, four clients, two addresses, and one completed ride. The password for every demo login is `CareRideDemo1`.

## Cloud SQL or a Vercel backup

Use the provider's connection string as `DATABASE_URL` or `POSTGRES_URL`, with `sslmode=require`. On Cloud SQL, enable PostGIS, then run `backend/db/001_schema.sql` as a user who can create extensions. On Neon or Vercel Postgres, `CREATE EXTENSION postgis` is supported. The seed script is only for the demo. A backup of this database is a normal `pg_dump`.

The claim is safe under concurrency: the ride row is locked with `SELECT … FOR UPDATE`, then updated only while it is still `requested`, unassigned, and the driver is eligible. The loser gets `409` and `{ "message": "Already assigned" }`.
