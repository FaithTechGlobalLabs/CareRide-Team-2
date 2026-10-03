# CareRide hail-mary plan

Updated: October 3, 2026, before implementation.

This plan covers the 12pm MVP and the Saturday user-testing script: staff book a free ride for a client, an organization-approved driver claims it, and staff follow pickup through drop-off. It uses the existing React app and Express API. PostgreSQL stays unwired. The API reads and writes a JSON file.

Decisions are locked in `docs/PROGRESS.md`. Map pins are in scope for the address book and the driver service area. A booking is claimable the moment staff submit it.

## What already exists

- Frontend: Vite, React 19, TanStack Router, Tailwind, one shadcn button. Routes are only `/`. `App.tsx` and `src/routes/index.tsx` both still show the starter screen.
- Backend: Express on port 3000 with `/` and `/health`. `pg` is installed. `src/db/db.ts` opens a Postgres pool.
- Types already match the working schema: organization, destination, staff, client, ride, driver, vehicle, availability, verification, notification.
- Organization registration is written against Postgres helpers. It is not mounted in `src/index.ts`.
- `src/routes/rideRoutes.ts` imports `rideController`, which does not exist.
- `src/routes/adminRoutes.ts` imports `adminController`, but the file is `adminContoller.ts`, and that file does not export `registerAdmin` or `loginAdmin`.
- `staffHelpers.ts` imports a default `pool`; `db.ts` exports a named `pool`.

## Storage

Add `backend/src/store/jsonStore.ts` and `backend/data/store.json`.

- One process-local write queue so a ride claim is check-then-write in a single turn. The first claim that still sees `status === "requested"` and no `driver_id` wins. The loser gets an already-assigned response.
- Collections mirror the existing TypeScript types: organizations, staff, clients, destinations, rides, drivers, vehicles, availabilities, verifications, notifications.
- Dates are ISO strings in JSON and converted at the store boundary.
- Uploaded verification files go in `backend/data/uploads/` and are served only to an authenticated admin of the approving organization. The JSON record stores `document_ref`, not a public URL.
- Postgres helpers stay in the repo and are not called. A later swap replaces the store module, not the route shapes.

Seed `store.json` on first boot if the file is missing.

## Auth and roles

JWT with the packages already in `backend/package.json`. Password hashes use bcrypt.

One login endpoint for staff and drivers. The token carries `userId`, `role`, and `organizationId` when the person belongs to an organization.

Roles used in the demo:

- `admin` on a partner organization: clients, address book, bookings, driver approval, demo dashboard.
- `driver`: availability, eligible rides, active ride actions. Independent drivers have no `organization_id`. Affiliated drivers point at a `transport_provider`.

Staff and drivers are separate records for this pass. A person who is both uses two accounts. Forgot password is a visible link that explains reset is not in this demo.

## Demo script the build is shaped around

1. Log in as Belkin staff.
2. Open a client (seeded or just created): name and DOB required.
3. Book a one-way ride. Pickup and destination come from the address book and autofill the saved address onto the booking.
4. Log in as the driver in a second session.
5. Driver sees the ride only after Belkin has approved them, capacity fits, and the pickup falls in an active availability window.
6. Driver accepts. A second accept attempt fails.
7. Driver marks picked up, then dropped off.
8. Staff dashboard and booking detail show the new status. Staff see in-app notifications for confirmation, assignment, and completion.
9. Admin demo panel shows completed-ride count and sample time and cost savings, labeled sample data.

Round trip, cancel, and no-show are in the same API so the tracking screen can show them. They are second priority after the script above works.

## Status model for this pass

Claimable bookings are created as `requested`. These statuses are not required before a driver can accept: `approved`, `dispatched`, `declined`.

| Action | Who | Next status |
| --- | --- | --- |
| Submit booking | Staff | `requested` |
| Accept | First eligible driver | `accepted` |
| Picked up | Assigned driver | `in_progress` |
| Dropped off | Assigned driver | `completed` |
| Cancel | Staff, with reason | `cancelled` |
| No-show | Assigned driver | `no_show` |
| Withdraw | Assigned driver, with reason | `requested`, `driver_id` cleared |

Staff can edit a booking only while it is `requested`. After acceptance, the detail screen shows the saved snapshot and does not offer edit.

## Eligibility

A ride is listed for a driver when all of these are true:

- Booking status is `requested`.
- A verification row for this driver and the booking's partner organization is `approved`.
- Vehicle `seats` is at least `passenger_count`.
- If accessibility includes wheelchair, the vehicle is wheelchair accessible.
- Pickup datetime is inside an active availability rule in `America/Vancouver`, and is at least `minimum_notice_minutes` from now.
- Pickup coordinates come from the address-book map pin and must fall inside an active availability radius.

Service area uses pickup only. Destination is not required to fall inside the circle. Overlapping accepted rides are allowed.

## Round trips

`trip_type` is `one_way` or `round_trip`. A round trip writes two ride rows that share `trip_group_id` and point at each other with `linked_ride_id`. The return leg swaps pickup and destination and uses the required return pickup time. Each leg is claimed on its own.

## Screens, in build order

Existing router files stay. New screens are TanStack file routes under `react-web-careride/src/routes`. One API client module calls the Express origin.

1. Login, plus links to organization registration and driver registration.
2. Organization registration. Creates the org as `active` and its first administrator. Partner and transport provider stay separate accounts.
3. Staff home: book, register client, upcoming rides, rides awaiting a driver, search, status filter, notification count, address book, demo summary.
4. Client create and edit. Accommodations stay within 50 characters.
5. Address book list, search, type filter, add, edit, activate and deactivate. Address is typed. A map pin sets latitude and longitude.
6. Booking form and booking detail with the progress timeline.
7. Driver registration, verification upload, availability, available rides, active ride.
8. Partner-admin review: approve or reject a pending verification, with reason on reject.
9. Notifications list. Channel is `in_app`. Types are `confirmation`, `driver_assigned`, and `completed`. Recipient is the booking staff member. No SMS or email is sent.

Urgency dropdown values, display only: `routine`, `soon`, `time_sensitive`.

## Seed data

If the store is empty, create:

- Partner org: Belkin Communities of Hope, address `228 W. 5th Ave, Vancouver`.
- Staff admin: synthetic email and password recorded in `docs/PROGRESS.md`, not a real credential from the proposal.
- Transport provider org: sample provider, plus one admin, so both registration types exist.
- Driver: synthetic volunteer, vehicle with 3 seats, weekly availability covering the demo afternoon, verification pending until the admin approves it. A second copy of the same driver can be pre-approved if we need the happy path without the approval click.
- Address book on Belkin: Belkin House and St. Paul's Hospital, with rough coordinates so radius matching can be shown.
- One completed ride with made-up distance, duration, and cost saved, flagged `sample: true`, so the dashboard is not empty before the live ride finishes.

## API surface

Mounted from `src/index.ts`. JSON bodies. Auth header `Authorization: Bearer`.

- `POST /auth/login`
- `POST /organizations/register`
- `GET/POST /clients`, `GET/PATCH /clients/:id`
- `GET/POST /destinations`, `PATCH /destinations/:id`
- `GET/POST /rides`, `GET /rides/:id`, `POST /rides/:id/cancel`
- `POST /rides/:id/accept`, `POST /rides/:id/pickup`, `POST /rides/:id/dropoff`, `POST /rides/:id/no-show`, `POST /rides/:id/withdraw`
- `POST /drivers/register`
- `POST /drivers/me/verifications` multipart file
- `GET/POST /drivers/me/availability`, `PATCH/DELETE /drivers/me/availability/:id`
- `GET /drivers/me/rides/available`, `GET /drivers/me/rides`
- `GET /admin/verifications`, `POST /admin/verifications/:id/approve`, `POST /admin/verifications/:id/reject`
- `GET /notifications`, `POST /notifications/:id/read`
- `GET /admin/demo-summary`

`POST /rides` accepts one body. For `round_trip` it returns both legs.

## Explicitly out of this pass

- PostgreSQL and PostGIS.
- Google address autocomplete. Map pins use OpenStreetMap tiles, not a paid geocoder.
- Client portal, paid ride links, SMS, email, phone calls.
- Forgot-password reset, staff invite, multi-role identity.
- Dispatcher workflow and offer rows. Acceptance writes `driver_id` directly.
- Overlap locking, overnight availability, monthly availability beyond storing the fields.
- React Native.

## Docs to keep current

- `docs/HAIL_MARY_PLAN.md` — this plan. Change it when a default is overturned.
- `docs/PROGRESS.md` — questions, decisions, and a checklist updated as screens land.
