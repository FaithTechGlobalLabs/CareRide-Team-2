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

Start a PostgreSQL database with PostGIS, then run from `backend/`:

```sh
DATABASE_URL=postgres://careride:careride@localhost:5432/careride npm run db:setup
npm run dev
```

`db:setup` applies the schema once and seeds Belkin, the demo staff and drivers, four clients, two addresses, and one completed ride. The password for every demo login is `CareRideDemo1`.

## Cloud Run with Cloud SQL

Use Cloud SQL **for PostgreSQL**. The API needs PostGIS; choose the same region as your Cloud Run service. This setup uses Cloud Run's built-in Cloud SQL Auth Proxy and Unix socket, with database username/password authentication.

1. Create the `careride` database and a PostgreSQL user. Initial schema setup needs permission to create the `postgis` and `pgcrypto` extensions. The schema creates them with `CREATE EXTENSION`; there is no `cloudsql.enable_postgis` flag. See [Cloud SQL extensions](https://docs.cloud.google.com/sql/docs/postgres/extensions).
2. Enable the Cloud SQL Admin API. Give the Cloud Run service's **runtime service account** the `roles/cloudsql.client` role in the instance's project.
3. In Cloud Run, edit the service revision and add the instance under **Cloud SQL connections**. For this built-in proxy setup, the instance needs public IP enabled. Connecting through the proxy does not require adding public authorized networks. Private IP instead needs appropriate VPC connectivity and different connection settings.
4. Add these environment variables to the service (replace all placeholders):

   ```text
   INSTANCE_CONNECTION_NAME=YOUR_PROJECT:YOUR_REGION:YOUR_INSTANCE
   POSTGRES_USER=careride
   POSTGRES_DB=careride
   DB_POOL_MAX=5
   ```

   Inject `POSTGRES_PASSWORD` and `JWT_SECRET` from Secret Manager. Give the runtime service account Secret Manager Secret Accessor access to those secrets. Do not bake credentials or `.env` into the image. See [Cloud Run secrets](https://docs.cloud.google.com/run/docs/configuring/services/secrets).

`INSTANCE_CONNECTION_NAME` selects `/cloudsql/PROJECT:REGION:INSTANCE`, even if `DATABASE_URL` is still set. Alternatively, explicitly set `POSTGRES_HOST` to that socket directory. The backend validates required socket credentials at startup, limits each container to five database connections by default, and times out connection attempts after five seconds (`DB_CONNECT_TIMEOUT_MS` can override this). Idle connections are released after 30 seconds.

The aliases `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, and `DB_PORT` are also supported. `POSTGRES_*` values take priority if both naming conventions are set. A Cloud Run deployment using `DB_HOST=/cloudsql/PROJECT:REGION:INSTANCE` and the other `DB_*` credentials works without `INSTANCE_CONNECTION_NAME`. `DB_NAME` must be the actual PostgreSQL database name, which can differ from the Cloud SQL instance name.

The proxy encrypts the remote connection; do not add `sslmode=require` to the socket configuration. Attaching the instance is still required: setting the environment variable alone does not create the socket. See [Google's Cloud Run connection guide](https://docs.cloud.google.com/sql/docs/postgres/connect-run).

Set a Cloud Run maximum instance count appropriate for your database: each container may open `DB_POOL_MAX` connections. Leave room for schema setup, administrative sessions, and overlapping revisions. For a small demo, three containers with pools of five is a reasonable starting point, subject to the database's connection limit.

### Initialize the database once

The API does not create tables on startup. Build the backend, then initialize a new database separately:

```sh
npm run build
npm run db:schema
```

`db:schema` uses compiled JavaScript, applies the initial schema in a transaction, and does **not** create demo accounts. It works in the production Docker image without `tsx`. This initializes a fresh database; it is not a migration runner for future schema changes.

For cloud execution, create a Cloud Run **Job** using the same image, instance attachment, runtime service account, and database environment/secrets as the service. Override its command to `node` and pass two arguments: `dist/db/setup.js` and `--schema-only`. Run it once with one task and no retries. A job completing with exit code zero confirms setup. Use `npm run db:setup:compiled` (or the job argument `dist/db/setup.js` without `--schema-only`) only when you intentionally want the demo accounts and sample data.

### Verify the deployed service

Rebuild the image from `backend/` before deploying these changes:

```sh
docker build --platform linux/amd64 -t careride-backend .
```

The API listens on `0.0.0.0` using Cloud Run's injected `PORT`. `/health/live` returns 200 while the HTTP server is running; use it for a liveness probe. `/health` runs `SELECT 1` and returns 200 when the database connection works, or 503 when it fails. After deployment:

```sh
curl -i https://YOUR_SERVICE_URL/health
```

For an IAM-protected Cloud Run service, include the appropriate identity token. A successful health response verifies connectivity and authentication; test an API endpoint too to verify schema and application permissions. On `SIGTERM`, the backend stops accepting requests, drains active requests, and closes the database pool within Cloud Run's shutdown window.

### Connecting from your Mac

Cloud Run's `/cloudsql` mount is not present on your Mac. Use the [Cloud SQL Auth Proxy](https://docs.cloud.google.com/sql/docs/postgres/connect-auth-proxy) with local Application Default Credentials and Cloud SQL Client access. With the proxy installed, start it in another terminal:

```sh
cloud-sql-proxy --port 5433 YOUR_PROJECT:YOUR_REGION:YOUR_INSTANCE
```

Leave `INSTANCE_CONNECTION_NAME` unset locally. Set `DATABASE_URL` to a PostgreSQL URL pointing to `127.0.0.1:5433`, with the actual database credentials (URL-encode special characters). The local proxy handles remote TLS. When running the API inside Docker on your Mac, use `host.docker.internal:5433` and ensure the proxy listens on an address reachable from Docker.

## Other hosted PostgreSQL providers

Use the provider's connection string as `DATABASE_URL` or `POSTGRES_URL` with its required TLS settings, and ensure PostGIS is supported. Leave `INSTANCE_CONNECTION_NAME` and any `/cloudsql/` host unset. A backup of this database is a normal `pg_dump`.

The claim is safe under concurrency: the ride row is locked with `SELECT … FOR UPDATE`, then updated only while it is still `requested`, unassigned, and the driver is eligible. The loser gets `409` and `{ "message": "Already assigned" }`.
