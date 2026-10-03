# CareRide hail-mary progress

Updated: October 3, 2026.

The hail-mary backend and responsive React frontend are implemented on the `Hail` branch. The plan is `docs/HAIL_MARY_PLAN.md`.

## Open questions

None. Decisions below are locked for this pass.

## Decisions

Confirmed October 3, 2026:

- Seed Belkin staff, one driver, and two address-book locations, and still ship registration screens.
- The partner organization that owns the booking approves the driver. Belkin admin approves drivers for Belkin rides.
- Address book and service area use a map pin. Radius matching runs when both the pin and the pickup have coordinates.
- A booking is claimable as soon as staff submit it. Status starts at `requested`.
- Build order if time is short: login, client, book from the address book, accept, pickup, drop-off, staff status, in-app notifications, sample dashboard. Organization registration, document approval, and round trip follow that path.

Demo logins (synthetic, not the proposal contacts):

- Staff: `alvin.demo@careride.local`, `aretha.demo@careride.local`, or `billy.demo@careride.local` / `CareRideDemo1`
- Drivers: `olive.demo@careride.local`, `derek.demo@careride.local`, `kenton.demo@careride.local`, or `eshean.demo@careride.local` / `CareRideDemo1`
- Client records: Jamie Chen, Chong Demo, Winnie Demo, and Joe Demo. Clients do not log in for this MVP.

## Checklist

- [x] Questions above answered
- [x] JSON store and seed data
- [x] Auth login
- [x] Organization registration
- [x] Staff dashboard (frontend)
- [x] Client registration API
- [x] Address book UI (frontend). API accepts a map pin as lat/lng.
- [x] Booking API, including round trip
- [x] Booking tracking UI (frontend)
- [x] Driver registration and document upload API
- [x] Admin approval API
- [x] Driver availability API
- [x] Available rides and atomic accept
- [x] Pickup, drop-off, cancel, no-show API
- [x] Staff notification records
- [x] Demo summary API with labeled sample savings
- [x] Browser pass of the staff-to-driver script (frontend)

Backend contract: `docs/BACKEND_API.md`. Checked on October 3, 2026 against `http://localhost:3011`: login, book, competing accepts, pickup, drop-off, notifications, round trip, organization registration, driver upload, and admin approval. The store was reset to seed data afterward. PostgreSQL is not called.

Frontend browser pass on October 3, 2026: staff login, one-way booking, approved-driver login, eligible ride acceptance, pickup, drop-off, staff dashboard completion count, and unread notifications. Responsive layouts were visually checked at mobile width and 1440px desktop width. The frontend defaults to a browser-persisted screen demo when `VITE_API_URL` is unset and uses the JSON API when it is set.
