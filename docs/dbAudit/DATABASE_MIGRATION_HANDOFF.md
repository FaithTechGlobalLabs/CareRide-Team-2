# Cloud deployment to database-only CareRide: audit and implementation handoff

Audit date: October 4, 2026 (America/Vancouver).
Status: investigation and plan only; no application fixes, deployments, database writes, dependency installs, or git commits performed.

Latest confirmed scope: remain on **cloud-deployment**; keep **all seven login accounts and Belkin**, with **no seeded driver vehicle, availability or verification**; **any active organization staff may approve drivers for their own organization**. **No notifications at all in this milestone**, including in-app. No SMS/email or password-reset implementation. Planning only. See [FRONTEND_DATABASE_LINK_AUDIT.md](FRONTEND_DATABASE_LINK_AUDIT.md) for the request/response map and recovery references from Eshean's original branch.

User-supplied database target (configuration report, not a successful connection): Cloud SQL PostgreSQL, instance connection name `sigma-chemist-497422-r8:us-central1:care-ride-db`, Unix socket `/cloudsql/sigma-chemist-497422-r8:us-central1:care-ride-db`, database `postgres`, username `postgres`. Password/complete credential URL intentionally omitted. PostGIS installation, schema contents, backend service/URL and runtime instance attachment are still unverified. The instance name `care-ride-db` is **not** the database name in the supplied URL; do not configure POSTGRES_DB/DB_NAME to the instance name by mistake. Inject the password using deployment secrets. The separate socket fields in config.ts are a supported way to represent this connection; public VITE_API_URL must be the HTTPS backend origin, never a PostgreSQL URL.

## Intended outcome and scope

The user wants the Cloudflare frontend and Google Cloud backend to run a real, shared, database-backed application. The only allowed synthetic data is explicitly retained login accounts, inserted by a separate runner. There must be no browser demo API, JSON demo backend, fake clients/rides/locations, automatic driver approvals, sample documents, or fabricated outcome metrics in application runtime or its seed runner.

Use this document as the migration handoff. Earlier hackathon decisions in `HAIL_MARY_PLAN.md`, `PROGRESS.md`, and `BACKEND_API.md` describe the old demo and must not override this request. Historical documents may remain clearly marked as historical; the current runbook must describe real behavior. Test fixtures are isolated test data, never production seed data.

Repository instructions: keep work focused; do not install or upgrade dependencies without showing exact commands and obtaining explicit confirmation; stop on unexpected unrelated working-tree changes; do not delete existing database/file data without explicit approval. Do not request an additional automated code review merely for this work.

## Comparison baseline and verification limits

- Current branch: `cloud-deployment`, HEAD `2e0aff6fab8cd86f8405139ce7bc9322bc4b8df8`.
- Local `main`: `1b03af28d898356bac7c0e75a2e3d8f4b2e686ed`.
- Recovery reference: `origin/cloud-deployment-Eshean-original`, `6c78d18d02ca37f0b9aab1d596d0f9d6fe645d06`. User identified this as the pre-rebase source. Its SQL handlers/types were inspected after the initial audit; selectively restore and adapt existing SQL rather than writing everything from scratch.
- At audit time, `origin/main` and `origin/cloud-deployment` tracking refs matched those respective local commits. No remote fetch was performed; these are checkout/tracking-ref comparisons, not confirmation of current GitHub state.
- Working tree was clean before the audit and after build checks, before writing this document.
- Inspected runtime entrypoints, all active API handlers, SQL schema/setup/config, frontend provider/API/screens/types/demo, deployment workflow, Dockerfile, existing backend tests, and project runbooks.
- `npm run build` in `backend/`: **FAIL**, 23 TypeScript diagnostics. Existing dependencies were used.
- `npm run build` in `react-web-careride/`: **PASS**. Passing compilation does not establish database connectivity or real workflow correctness.
- Backend integration/runtime tests were not executed: the current source cannot build, and tests import/run `dist` files, which could be stale. The supplied deployment was subsequently inspected read-only: [deployed login](https://0326731f.careride-40g.pages.dev/login) visibly shows **TRY THE SCREEN DEMO** and **Explore the staff and driver screens with sample data**. Based on the source condition, that build selects the browser demo path. No login/form submission occurred. Google Cloud/database/GitHub variable or secret settings were not inspected. No real database integration has been verified.

## Main discrepancy

`main` already contains a browser demo and a JSON-backed API. `cloud-deployment` adds SQL schema, SQL seeding, Cloud SQL connection configuration, a production image, runtime tests, and a frontend build-time API variable, but **does not switch the active API to PostgreSQL**.

Actual request paths:

```text
VITE_API_URL missing -> frontend api.ts -> demo.ts -> browser localStorage
VITE_API_URL present -> frontend fetch -> backend index.ts
                    -> api/routes.ts -> store/jsonStore.ts -> data/store.json

Separate setup command -> db/setup.ts -> db/db.ts -> PostgreSQL
                         (active HTTP routes never use these database records)
```

`backend/src/api/routes.ts` is unchanged between main and this branch. `backend/src/index.ts` mounts only `registerApi(app)`. PostgreSQL helpers and old routers/controllers are not mounted. PostgreSQL login seeding therefore does not make those accounts authenticate against PostgreSQL; successful JSON login does not prove SQL works.

Meaningful branch changes, excluding removal of tracked root `node_modules`:

- Adds `backend/db/001_schema.sql`, `backend/src/db/config.ts`, `backend/src/db/setup.ts`, transaction support, `.env.example`, Docker packaging, and two backend test files.
- Changes `index.ts` binding/liveness/shutdown but leaves `/health` as unconditional success and references an unimported `pool`.
- Partially changes JSON seed and eligibility to SQL-shaped fields while leaving API handlers and TypeScript types on the original JSON contract.
- Adds `vars.VITE_API_URL` to the Cloudflare build and limited frontend compatibility normalization. Does not remove frontend demo fallback or fix all SQL/UI differences.
- Removes tracked root dependencies and ignores them; this explains the enormous deletion count in the raw diff, not an application feature removal.

### Confirmed pre-rebase losses

Against Eshean's original ref, current routes.ts lost the mounted SQL implementation; backend types reverted to JSON models; db.ts lost its PoolClient import; index.ts lost its pool import and real readiness query; SQL helper inserts reverted to columns absent from the retained schema; the db:setup script and docs/FRONTEND_HANDOFF.md disappeared. Schema, connection config, setup seed, eligibility file and backend tests are unchanged between these two refs. This is direct comparison evidence, not proof of an individual rebase conflict choice.

Original SQL contains reusable authentication, clients, addresses, linked rides, transactional claims/dispatch release, timezone/PostGIS eligibility, bytea documents and readiness. It still includes demo seeding/metrics and notification writes, lacks PATCH /rides/:id, and availability PATCH only changes is_active. Restore selectively; never overwrite current files wholesale or restore demo/notification behavior.

## Findings: deployment and data blockers

### F01 — P0: backend/image cannot build

Evidence: actual backend build and `backend/tsconfig.json` (`noEmitOnError: true`).

- `src/db/db.ts:24`: `PoolClient` is referenced without a type import.
- `src/index.ts:55`: shutdown calls `pool.end()` without importing `pool`.
- `src/store/eligibility.ts:100,128`: `radius_m` does not exist on the current availability type; `accessibility_needs` is optional string but is used as an array with `.some()`.
- `src/store/jsonStore.ts`: seed omits required organization fields and staff roles and uses incompatible driver, vehicle, verification, availability, and ride fields. Diagnostics occur at lines 58, 66, 77, 86, 99, 110, 119, 128, 142, 152, 166, 231, 240, 249, 255, 272, 322.

`backend/Dockerfile` invokes `npm run build`, so this source cannot produce a fresh successful image as written. A currently deployed service, if running, is not evidence that this exact revision builds. Resolve by completing the persistence/contract migration and removing the obsolete JSON implementation, not by disabling type checking or coercing incompatible values.

### F02 — P0: runtime database is still local JSON with automatic full demo seed

Evidence: `backend/src/api/routes.ts:10-16`; `jsonStore.ts:348-391`.

Every active resource handler uses `readDb()`/`update()`. First read on a missing store invokes `seed()` and writes fabricated records. The queue serializes writes only inside one process. Container-local data and uploads do not provide shared durable storage across restarts/instances. The API never writes `dispatches` to SQL.

Replace every resource read/write with scoped parameterized SQL and transactions. Remove filesystem business persistence and runtime seeding entirely. A missing/unreachable database must produce an error, never a replacement demo database.

### F03 — P0: partially migrated JSON records break existing runtime contracts

Evidence: branch diff for `jsonStore.ts`/`eligibility.ts`, active routes and current types.

- Newly seeded organization has no `status`, so `/organizations` filters it out. Verification submission additionally requires `type === 'partner_org'` and active status.
- Seed staff have no `role`; approval handlers require `role === 'admin'`, so these staff cannot approve. Existing JSON files may still contain old roles, making behavior installation-dependent.
- Seed drivers have first/last names, while public responses read `driver.name`; session/UI code assumes a name exists.
- Seed vehicles use `plate_number`, but responses read `plate`.
- Availability created/edited by routes has `radius_km`; matching now reads `radius_m`, so newly entered availability cannot match correctly.
- Booking routes store absent/string accessibility needs; eligibility now calls `.some()`, which can throw. Seed sample ride uses an array, concealing this difference.
- Seed sample ride uses `requested_by_staff_id`, while notification generation reads `requested_by_user_id`; seed verifications use different reviewer/document keys from handlers.

These are branch regressions caused by applying SQL shapes to the old JSON implementation. Do not retain a hybrid contract as a final solution.

### F04 — P0: frontend silently runs a complete browser demo

Evidence: frontend `api.ts:1-14`, `demo.ts`, `Provider.tsx`, `AuthScreens.tsx`, `Layout.tsx`.

Unset/empty `VITE_API_URL` selects `demoRequest`. Browser localStorage then stores clients, bookings, verification records, availability, notifications, and fictional logins/registration. A successful static build can deploy a working-looking demo with zero backend requests.

Remove `demo.ts`, its imports, `IS_DEMO` branches/banners, synthetic registration behavior, and production account/password autofill. Make missing/invalid API configuration fail the production build and present a clear configuration/network error at runtime. Audit any retained login shortcut requirement separately: a seeded login must always authenticate against the backend, with no hardcoded bypass.

### F05 — P0: SQL seed creates far more than login accounts

Evidence: `backend/src/db/setup.ts:24-166`.

Default setup seeds an organization, three staff, four drivers, four clients, two locations, four vehicles, broad weekly availability, fake approved identity documents, a completed ride, and its accepted dispatch. It hashes a source-controlled shared demo password. It skips all seeding if *any* organization exists, so it cannot reliably fill missing accounts in an existing database.

Split schema migration from an explicit account-only seed runner. Permit only the agreed login identities and the minimum supporting organization/profile fields needed to satisfy foreign keys and login requirements. Insert no clients, addresses, vehicles, availability, verifications, dispatches, rides, or notifications. Use a transaction, email-based conflict handling, and a deployment-level single-run guard; rerunning must not duplicate accounts, reset passwords, or overwrite real profile data. Get passwords from runner secrets, never source literals or frontend build variables. Do not automatically run this seed when the service starts or on every frontend push.

The user confirmed all seven accounts and Belkin with empty driver setup. Preserving a driver login with no vehicle also requires a real authenticated profile/vehicle setup flow; currently vehicles are entered only during registration.

### F06 — P1: SQL and API/frontend have incompatible business contracts

The SQL schema is a possible target, not a contract already implemented by the app. Resolve the following explicitly before writing repositories:

| Area | SQL target | Current runtime/UI | Required decision/work |
| --- | --- | --- | --- |
| IDs | UUID PK/FK, full `gen_random_uuid()` | `newId(prefix)` produces prefixed 8-character suffix IDs | Use full UUIDs consistently; reject invalid path/body IDs; handle existing records only through an approved migration |
| Organization | name/email/phone; no type/status/contact/address | registration, list filtering and provider affiliation require those fields | Decide whether to simplify UI/requirements or extend schema; do not silently discard registration inputs |
| Staff authority | no staff role column | auth/types require role; approve/reject restricted to admin | Confirmed: any active staff can approve for their own organization; restore SQL authority model and align JWT/UI |
| Driver | first_name/last_name, no affiliation/license flag | single name, optional organization affiliation, license_verified | Define public name mapping and affiliation policy; add real profile setup/update |
| Vehicle | plate_number | plate | Explicit mapping, include wheelchair flag in returned vehicle; define one/current vehicle policy (schema has no unique driver_id) |
| Location | addresses; latitude/longitude/location_type | destinations; lat/lng/type | Repository/DTO mapping; preserve scoped active/inactive address-book behavior |
| Ride ownership | requested_by_staff_id | requested_by_user_id | Update API types/queries; derive organization and staff from authentication; remove notification dependencies |
| Ride lifecycle | requested/approved/in_progress/completed/cancelled/no_show/timed_out | accepted plus legacy backend statuses; frontend only six statuses | Choose one canonical lifecycle; update every filter/action/calendar/badge and response mapping together |
| Ride timestamps/flags | approved_at; pickup/dropoff booleans | accepted_at/picked_up_at and no maintained flags | Preserve genuine event timestamps; update status and flags atomically; migrate schema if needed |
| Accessibility | nonnull text[] | optional string/comma-joined string | Define input/output shape and normalize once; remove unsafe mixed array/string handling |
| Ride metadata | no urgency/appointment_at/waiting_minutes/picked_up_at/measurement columns | handlers/UI use several of these | Persist supported features with a migration or explicitly remove corresponding controls; never accept and silently lose them |
| Availability | geography centre, radius_m, recurrence, timezone | lat/lng, radius_km, notice/wait policy | ST_X/ST_Y mapping and km/m conversion; preserve validated notice/wait settings in schema or remove them explicitly |
| Verification | document_type, bytea, document_filename, approved_by_staff_id; no issued_on | check_type, file reference, approved_by_user_id, issued_on | Persist document + metadata and reviewer; keep binaries out of list responses; return suitable DTO |
| Notification | staff_id/driver_id, title/message, is_read, created_at, metadata | recipient_user_id/type/status/read_at/sent_at | Excluded from milestone: remove fetches, UI and writes; do not restore this feature |
| Impact | no outcome measurement columns | demo-summary and fake per-ride savings | Retain real completed counts; remove unsupported savings/time-saved claims |

`api.ts` currently maps some verification keys and driver login role, but does not reconcile statuses, driver first/last name, availability units, notification read state, nested plate names, or staff roles. It also expects specific response envelopes. Staff approval UI reads `v.driver.name/email`, while backend returns flat `driver_name/driver_email`; add explicit matching DTOs. Test response contracts, not merely HTTP success.

### F07 — P1: documentation promises SQL behavior that runtime lacks

Evidence: `docs/POSTGRES.md` vs `index.ts`, routes, helpers, and `package.json`.

- Runbook says API uses PostgreSQL; it uses JSON.
- Says `/health` queries `SELECT 1`/returns 503 on failure; actual handler always returns 200.
- Says claims use `SELECT ... FOR UPDATE` and dispatch transaction; actual handler uses process-local JSON queue and writes `accepted`.
- Says verification documents are stored as `bytea`; actual upload writes to local disk.
- Says expired requested pickups become timed_out; no active handler/job implements that transition, and runtime types omit timed_out.
- Local runbook references `npm run db:setup`; no such package script exists. Existing scripts are `db:setup:compiled` and `db:schema`, both needing compiled JS.
- Dormant SQL helpers reference organization fields and staff roles absent from the new schema; several staff helpers explicitly throw “Postgres staff helpers are unused.” Old registration controller inserts org and staff separately and does not match the mounted registration payload/session contract. Do not just mount those routers as a migration shortcut.

Correct the current runbook after implementation. Keep `/health/live` as server liveness, and implement bounded database readiness with safe errors and schema verification in deployment smoke tests.

## Findings: real workflow and operational gaps

### F08 — P1: fabricated outcomes remain in actual API mode

`routes.ts:207-213` and dropoff call `applySampleMetrics`: distance 6.5 km, duration 20 min, savings 28, staff effort 15. `/admin/demo-summary` aggregates these; Dashboard shows sample savings. These values are generated even when frontend uses the backend. Delete the fabrication and sample dashboard contract; show only database-derived counts and genuine recorded timestamps. Route estimates in `travel.ts` are estimates, not measured trip outcomes or proven staff savings.

### F09 — P1: documents need durable storage and a real review interface

`multer({ dest: uploadsDir() })`, upload rows with `document_ref`, and download `sendFile` use local files. No upload size/content limits are configured; rejected org submissions can leave files behind. Staff approval UI displays only the reference, with no authenticated document-view action.

User wants everything in the database: use the existing bytea design for now, with bounded upload size and content validation, safe metadata/download headers, organization authorization, and a document-view/download action that sends the bearer token. Do not expose a raw public URL or token in the query string. Include expiry enforcement and reviewer records. Decide required verification types; currently any approved record grants eligibility and expiry dates are not checked.

### F10 — P1: claiming/state changes are unsafe across backend instances

Make assignment, accepted dispatch and status/timestamps one SQL transaction with a locked ride row and conditional update. No notification writes in this milestone. Loser gets 409. Repeat eligibility checks inside that transaction. Address driver double-booking/overlapping accepted rides: current eligibility checks only approval, capacity, wheelchair needs, one pickup time/window/radius; it does not check schedule conflicts, destination coverage or full trip duration. Define the intended overlap/coverage policy before enforcing it.

Withdrawal must reconcile the accepted dispatch record: the schema's unique accepted-dispatch index otherwise prevents a later driver claim if an old accepted row is left intact. Original SQL already expires accepted dispatches on cancel/withdraw; retain that behavior and meaningful history. Serialize cancel/edit/withdraw/pickup/dropoff/no-show against concurrent claims and prevent invalid terminal-state transitions. The JSON cancel handler currently permits cancelling in_progress/no_show and sets no pickup/dropoff flags; agree valid transitions and satisfy SQL constraints.

### F11 — P1: date, eligibility and request validation are incomplete

- Backend accepts ride datetime strings without validating valid/future dates or return-after-outbound ordering; passenger counts/seats need integer checks.
- Coordinate inputs need latitude/longitude bounds as well as finite checks; location/availability patches need the same validation as creation.
- Recurrence day ranges, notice/wait policy values, date bounds and verification date order need validation.
- Branch removed minimum-notice eligibility enforcement while UI still asks for minimum notice. Availability matching hardcodes Vancouver despite a timezone field. Test Vancouver DST boundaries and normalize database time/date values to API formats.
- Booking uses new Date(date + 'T' + time) in the browser timezone but labels/displays Vancouver times. Convert chosen Vancouver wall time explicitly; test different browser timezones and DST.
- Requested expired pickups need a real SQL transition/query policy, not a promise in docs. Preserve timeout history and user-visible status. Decide whether a scheduled runner is needed or transactional on-access expiry is sufficient.
- Staff requests must enforce client/location organization membership in SQL, not trust payload IDs. Cross-table UUID foreign keys alone do not ensure organization ownership.

### F12 — P1: authentication and privacy need production enforcement

`routes.ts:31` falls back to a known JWT secret. Require a supplied secret outside tests/development; load environment deterministically before signing/config initialization. Verify active account/membership on authenticated requests so disabling a staff record takes effect instead of leaving a 12-hour token fully valid. Remove source/default-password autofill from public login UI; seeded identities authenticate normally. Add bounded login/register abuse protection using the chosen infrastructure or existing stack, without installing dependencies without approval.

`GET /rides/:id` permits **any** driver to read any requested ride, bypassing eligibility used by available-rides listing; shared response includes ride data/notes. Scope detail visibility to eligible drivers or assigned drivers and restrict sensitive client fields for each audience. Currently `publicDriver`/ride views include inconsistent names and vehicle fields; contract and privacy tests should cover them.

Password reset currently displays “not available in this demo.” Recovery is deferred by user scope: remove misleading demo wording or mark it unavailable without implementing it. Account provisioning/invites and staff management lack mounted implementations; do not add these features to the database milestone without agreement.

### F13 — P1: deployment workflow does not complete backend/database delivery

Only checked-in deployment workflow is `.github/workflows/pages-deployment.yaml`. It runs on all pushed branches, builds frontend on Node 22, injects `vars.VITE_API_URL`, and deploys Pages using the git branch name. There is no checked-in backend build/deploy, migration or account-seeding workflow. Google may have an external trigger; that has not been inspected.

Plan a reproducible backend deployment and separate migration/account-seed jobs. Document selected Google service/image revision, database target, environment/secret names, job execution and rollback. Build the Docker image with **backend/** as context; it expects that directory's package/db files. Existing tracked Dockerfile is also named in backend/.gitignore: remove that confusing ignore entry as part of packaging cleanup if editing packaging.

Require a valid frontend API origin before build; Vite embeds it at build time, so changing the variable requires rebuilding. Decide preview vs production backend/database separation: currently all branches receive one variable, potentially sharing data. User confirmed remaining on cloud-deployment; confirm its actual Cloudflare deployment/domain mapping. Check CORS (currently unrestricted), HTTPS origins, public browser reachability vs Google service IAM policy, pool/instance limits, secret injection, PostGIS availability, schema permissions, backups and restore readiness in the actual deployed environment. These settings are unverified, not asserted broken.

Frontend should deploy after the compatible backend and migrations pass smoke checks. Schema/account tasks must not run implicitly for every Pages preview. A passing Pages build is insufficient deployment verification.

### F14 — P2: errors and persistence need visible, consistent frontend behavior

Provider refresh uses Promise.allSettled, recreates emptyData for failed endpoints, and aggregates errors. A failed request can appear as zero rides/empty data; obsolete `/admin/demo-summary` continues to be requested. Stop requesting removed endpoints, preserve useful loaded state where appropriate, distinguish loading/failed/empty, and handle 401 by invalidating/revalidating session. Guard against late refresh results from a previous session. Restore session against `/auth/me` so stale/demo sessions do not masquerade as current accounts.

Ride detail finds a ride only in provider arrays; consider authorized detail fetch for direct links and clear forbidden/not-found states. Legitimate local theme/map preferences and session handling are not demo business storage and need not be moved to SQL merely because they use browser storage. Clean obsolete browser demo business data in a narrowly scoped migration if desired; never clear all localStorage.

### F15 — P2 / scope decision: notifications, maps and operational readiness

Current notify records only staff in-app events; no actual SMS/email/push delivery, reminders or driver notification feed. Even 'sent' means only local record insertion. **All notification work is excluded by latest user instruction.** Remove notification fetches, navigation/badges/screens and writes from the planned milestone, including original SQL notifyStaff calls. A retained unused SQL table for future compatibility must not require inserts for core workflows. Do not implement in-app restoration, outbox or external delivery.

`travel.ts` directly calls public OSRM routing and Nominatim geocoding from the browser, sharing coordinates/address inputs with external services and caching only in memory. These are real external calls, not hardcoded demo data. Production service selection, usage requirements, privacy, timeouts and graceful failures need validation before relying on them. Map pinning should remain usable when route estimates fail. Do not replace absent estimates with fake numbers.

No database workflow test suite, migration history/locking, deployed persistence checks or restore evidence was found. Existing tests validate configuration/lifecycle only. Runtime test expects DB-unavailable health 503, contradicting the handler. Add structured operational errors without logging uploaded content, access tokens or connection credentials.

## Ordered implementation plan for the next agent

### Phase 1 — settle contract and migration safety

- [ ] Read this document, repository instructions and latest user answers; inspect clean status/current refs. Do not reinstall dependencies that are already present.
- [ ] Confirm Google service/database and registration/profile metadata. Locked: seven logins/Belkin, empty driver setup, any active organization staff can approve, stay on this branch, no notifications.
- [ ] Record chosen canonical API/SQL DTO contract and lifecycle. Recommended starting point: SQL as persistence target with explicit DTO mappings, preserving user-supported workflow fields through additive migrations; no mixed JSON models.
- [ ] Inventory whether existing Google DB/JSON contain real records. Obtain permission for any deletion/reset or real-data migration. Do not drop/reseed to make tests pass.
- [ ] Introduce versioned, transactional migrations with history and locking. Existing setup checks only existence of organizations and skips all future schema updates/partial schemas. Separate migration authority from routine runtime access.

### Phase 2 — replace active persistence and fix build

- [ ] Fix missing imports and make the actual backend compile; remove JSON store and old dead helpers/routers once all usages are replaced. Keep type checking enabled.
- [ ] Selectively restore original SQL handlers/types with explicit current-UI DTOs and missing handlers from the link audit. Implement scoped SQL for authentication/registration, clients, addresses, vehicle/profile, availability, documents/reviews and rides/dispatches. Do not restore notification calls.
- [ ] Register org+first staff and driver+vehicle atomically. Enforce agreed normalized/case-insensitive email uniqueness; schema currently only has per-table case-sensitive UNIQUE, while API checks emails across staff+drivers. Decide support for dual staff/driver identities rather than introducing ambiguous login selection.
- [ ] Use full UUIDs and transaction helpers; no SQL facade that reads/writes a whole serialized JSON snapshot.
- [ ] Implement atomic claims, subsequent transitions, expiry and dispatch release. Preserve linked round trips/address snapshots. No notification dependency in any transaction.
- [ ] Implement bytea document uploads/downloads and genuine authenticated vehicle/profile setup for retained logins.
- [ ] Implement actual readiness and secret requirements, role/membership checks, scoped detail responses and validation.

### Phase 3 — remove demo UI and align real workflows

- [ ] Remove browser demo and missing-API fallback; validate config in CI/build/runtime.
- [ ] Update types, response envelopes and screens for canonical statuses/names/plates/coordinates/availability/roles/verifications. Remove notification refresh/nav/badges/screens and mutation side effects for this milestone. Audit Dashboard, RideDetail, BookingDay, WeekCalendar, UI badges/search, staff/driver screens, AuthScreens, Provider and context defaults.
- [ ] Add staff document review and driver setup; support empty database through real client/address/vehicle/availability/document entry instead of seed shortcuts.
- [ ] Remove sample metrics generation and `/admin/demo-summary`; replace with real counts or remove impact panel until genuine measurement definitions exist.
- [ ] Make loading/auth/network/validation/conflict errors clear; verify phone and desktop flows.

### Phase 4 — account-only runner and reproducible cloud release

- [ ] Implement explicit compiled account-seed command, separate from migration command; use approved account inputs/secrets and idempotent transaction semantics. No sample operational data.
- [ ] Add a documented manually invoked/protected runner appropriate to the chosen Google setup (e.g. a same-image Cloud Run Job). If GitHub is the launcher, invoke the protected backend-side job; do not expose credentials to browser bundles or untrusted preview builds.
- [ ] Add/confirm backend build/test/deploy and migration ordering; verify external Google trigger if one exists before creating a duplicate pipeline.
- [ ] Gate Pages build on API configuration and agreed branch/environment mapping. Verify allowed origins and real browser access to backend.
- [ ] Update `.env.example`, POSTGRES.md, BACKEND_API.md, README/current progress to match implemented commands and behavior; mark previous demo plans as historical.
- [ ] Record deployed frontend/backend revisions and smoke-test results. No live deploy/reset is authorized by this audit-only request.

## Acceptance checks: required evidence before calling this database-only

1. **Clean fresh build:** backend and frontend builds succeed from current source with existing locked dependencies; image compiles same revision. Fresh backend tests run against newly built files. `node --test tests/*.test.mjs` is the current manual test invocation from backend once build is repaired; add a package test script if implementing the suite.
2. **No fallback:** missing API URL fails production build; stopped backend/unreachable database produces an error and creates no browser/JSON business database. Source/bundle audit finds no demoRequest, screen-demo token, runtime seed, jsonStore usage or fake metric generator.
3. **Account seed isolation:** apply migrations to disposable DB; account runner creates only selected organization/login profiles. clients/addresses/vehicles/availability/verifications/rides/dispatches/notifications remain empty. Second execution creates nothing and changes no existing passwords/profiles. Existing unrelated organization does not prevent approved accounts being added.
4. **Real empty-start journey:** log in via SQL; staff creates client and pickup/destination addresses; driver enters vehicle/availability and real document; authorized staff opens document and approves; book a future ride; eligible driver claims, picks up and drops off; staff sees actual count. Verify rows after each step without preapproved/sample records or notification fetch/write.
5. **Persistence:** refresh browser, log in from another browser, restart backend and deploy another compatible revision; accounts and created operational records/documents remain. Two API processes share the same state.
6. **Concurrent claims/transitions:** two eligible drivers using separate backend processes race; exactly one succeeds, one gets 409, SQL has one assignment/accepted dispatch. Claim-vs-cancel/edit and repeated pickup/dropoff are safe. Withdraw then another driver claim works without unique-index failure. Notifications are never created.
7. **Organization privacy/authority:** organization A cannot read/edit B clients, locations, rides or documents; unapproved/ineligible driver cannot retrieve requested ride details by guessed UUID; any active staff can review only for their own organization; deactivated staff loses access.
8. **Eligibility/time:** capacity/accessibility, metre/kilometre conversion, recurrence/date bounds, notice window, expiry, overlaps and agreed destination/trip coverage behave as defined, including DST. Invalid dates/coordinates/seats return 4xx; return time cannot precede outbound.
9. **Lifecycle/history:** round-trip legs/linkage and partial edits/cancellations follow agreed rules; status flags/timestamps satisfy constraints; address edits do not rewrite ride snapshots; timed-out rides remain understandable; real dropoff creates no invented savings.
10. **Documents:** real uploaded bytes survive backend restart; only authorized organization can retrieve them; too-large/invalid input is rejected; binary content/hash/secret fields never appear in list responses/logs.
11. **Deployed cloud smoke:** actual Pages build has expected API origin; real backend revision talks to target DB; readiness returns 503 on controlled DB failure while liveness stays available; real-domain login and end-to-end flow work; secrets absent from frontend assets. Confirm backups and a restore procedure before storing real client records.

## User decisions and remaining questions

Confirmed: all seven logins and Belkin; no driver setup seed; remain on cloud-deployment; planning only; database work only; **no notifications including in-app**, and no password-reset implementation; **any active staff may approve for their own organization**. Initial in-app-notifications preference was explicitly superseded. User supplied the Pages deployment and identified cloud-deployment-Eshean-original as the recovery reference.

Remaining questions (never infer approval from elapsed time):

1. Cloud SQL PostgreSQL target is now supplied above. What is the public backend HTTPS URL/service, and is there an external backend trigger? Cloud Run use and PostGIS/schema readiness still need verification; do not assume them from the socket URL alone.
2. Retain organization types/transport affiliation or simplify? Do not silently drop current UI inputs; authority model is already confirmed.
3. Are current stored records real and required to migrate? Which credential injection/profile minimum fields should the account-only runner use?
4. What policy applies to overlapping rides, minimum notice, waiting deadlines and verification types/expiry? Resolve if changing product behavior.

If answers are unavailable, progress only on independent work and record assumptions. Do not seed fictitious operational records, remove real data or silently discard existing product fields. Current authorization remains investigation/documentation only.
