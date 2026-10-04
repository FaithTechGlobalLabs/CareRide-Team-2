# Notification merge repair (Kenton)

The Cloudflare preview's Settings and Notifications screens request
`GET /notifications/preferences`. The deployed Cloud Run service returned
`404 {"error":"Route not found"}` even without authentication. This is a missing
backend route, independent of whether the account is a demo account.

The merge combined PostgreSQL routes with fragments of the former JSON backend:
notification handlers contained broken syntax, authentication checked the JSON
users, and notification preferences/subscriptions/read-all still used JSON.
The repair restores the SQL route handlers and implements those notification
endpoints against PostgreSQL. Notification responses include the timestamps and
type expected by the frontend. Authentication no longer checks the JSON users.

## Deployment

Deploy the repaired **backend** to Cloud Run; a Cloudflare frontend deployment
alone will not fix this error. No deployment or live database change was performed
during this repair.

`backend/db/002_notifications.sql` adds preferences, subscriptions, and delivery
tracking tables without changing existing notification rows. The notification
API initializes this additive schema lazily. The database role must be allowed
to create these tables, or the migration must be applied separately first.
The Docker image already includes the `db` directory.

After deployment, an unauthenticated request to `/notifications/preferences`
should return 401, not 404. With a staff or driver session, verify preferences
load/save, the inbox loads, and individual/all notifications can be marked read.
Settings uses this same preferences endpoint.

Device push also needs VAPID configuration and a scheduled authenticated call to
`POST /internal/notifications/dispatch` using `NOTIFICATION_WORKER_TOKEN`.
The dispatcher reads SQL notifications, respects recipient preferences, retries
deliveries, and removes expired subscriptions. Without that configuration the
in-app inbox still works; native delivery is not established by this repair.

## Validation and boundaries

- Backend and frontend production builds pass.
- `cd backend && node --import tsx --test tests/notifications-merge.test.mjs`
  covers SQL-backed staff preferences, inbox, read/read-all, and subscription
  routes, including authentication and the absence of JSON store creation.
  Database queries are mocked; this does not verify a live SQL connection.
- Older personal API tests describe the former JSON implementation.
- Account/organization deletion remains on the legacy JSON implementation and
  needs a separate SQL migration. Driver event generation and first-ride prompt
  bookkeeping also need verification against the SQL workflows before claiming
  complete notification parity. This repair addresses the merged routes and
  preferences error, not all earlier feature migration gaps.
- Preserve the user's concurrent Dashboard and stylesheet icon edits.
