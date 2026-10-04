# Frontend → API → PostgreSQL link audit and recovery map

October 4, 2026. Companion to [DATABASE_MIGRATION_HANDOFF.md](DATABASE_MIGRATION_HANDOFF.md). Planning only; no code changes or deployed writes.

## Locked scope

Stay on cloud-deployment. Keep Belkin plus Alvin, Aretha, Billy, Olive, Derek, Kenton and Eshean login accounts through an account-only database runner. Driver setup starts empty: no vehicle, availability, documents or approval seed. Any active organization staff may review/approve drivers **for that organization**. No notifications of any kind in this milestone. No SMS/email or password-reset implementation. Remove all demo runtime paths and fabricated operational data/metrics.

Database target supplied later: Cloud SQL PostgreSQL instance `sigma-chemist-497422-r8:us-central1:care-ride-db`, socket `/cloudsql/sigma-chemist-497422-r8:us-central1:care-ride-db`, actual database `postgres`, user `postgres`. Credentials are omitted. This confirms intended configuration only; no connection was attempted. Database PostGIS/schema and public backend URL/service remain unverified. Frontend fetch must use the backend HTTPS origin; it must never connect to PostgreSQL or contain this database password.

## Evidence from the rebase comparison

Compared current `2e0aff6` with main `1b03af2` and original `origin/cloud-deployment-Eshean-original` at `6c78d18`. Tracking refs were not refreshed from GitHub.

- Current mounted `backend/src/api/routes.ts` is identical to main's JSON version. Original mounted route file contains about 1,500 lines of SQL implementation and SQL response mapping. This is the lost database connection, rather than a few missing fetch calls.
- Original `db.ts` imports `PoolClient`; current lost that import but retained the transaction helper signature.
- Original `index.ts` imports `pool` and queries it for `/health`; current lost both but kept pool shutdown.
- Original backend types align to the retained schema. Current types reverted to main's names/statuses/units while JSON seed/eligibility retained SQL-shaped changes.
- Schema, config, SQL setup seed, eligibility file and backend tests are identical between original and current. Database infrastructure survived while its mounted callers did not.
- Original contains no `PATCH /rides/:id`; current UI added booking editing. Original availability PATCH changes **only is_active**; current UI can edit the whole recurrence/pin/radius/policy. These need new SQL implementations, not merely recovery.
- Original SQL still seeds demo records, emits notifications and computes sample summary. Do not restore those portions.

Useful read-only recovery commands from repository root:

```sh
git show origin/cloud-deployment-Eshean-original:backend/src/api/routes.ts
git diff origin/cloud-deployment-Eshean-original HEAD -- backend/src/api/routes.ts backend/src/types
git diff origin/cloud-deployment-Eshean-original HEAD -- backend/src/index.ts backend/src/db/db.ts
git show origin/cloud-deployment-Eshean-original:docs/FRONTEND_HANDOFF.md
git show af88ba4 -- backend/src/api/routes.ts backend/src/types
```

Do not checkout original over current wholesale, reset the branch, or cherry-pick the entire implementation without adapting newer features. Commit `af88ba4` is a useful SQL migration reference, but later/current frontend work must be preserved.

## Network boundary and receive adapter

All business requests currently use frontend `features/careride/api.ts`, directly from AuthScreens or through Provider `mutate()`/`refresh()`. `request()` uses VITE_API_URL, bearer auth, JSON or FormData and single-key response unwrapping. That is a valid boundary to retain after removing demo fallback.

The supplied [Cloudflare deployment login](https://0326731f.careride-40g.pages.dev/login) was inspected without submitting forms. It says **TRY THE SCREEN DEMO**. This source shows that text only for `IS_DEMO = !API_URL`, so the visible build is using the browser demo path. It cannot verify live backend/database behavior. Current repo's workflow adds the build variable, but that does not prove the supplied immutable deployment was built with it. Rebuild a compatible frontend with the correct API URL after database integration; no backend URL has been supplied yet.

Current `normalize()` handles document_type→check_type, document_filename→document_ref, driver kind→role, and flat ride driver_name→nested driver. It is not a complete decoder, and `as T` does not validate payload shape. Define explicit DTOs and contract tests at this boundary. Retain correct single-key unwrapping: `{rides:[...]}` becomes an array, `{ride:{...}}` becomes a ride, but `{token,user}` must stay intact. Binary documents require a separate authenticated blob response helper; current helper always calls response.json() and would discard successful binary content.

## Complete current business request map

Frontend paths below are relative to `react-web-careride/src/features/careride/`. Current backend line anchors refer to `backend/src/api/routes.ts`; original line anchors refer to the file at `6c78d18`, not current source. Every current mounted business route ultimately uses JSON; “recover” describes original SQL available to adapt, not working current SQL.

| Caller/action | Request and sent data | Expected receive/use | Missing database link / original recovery |
| --- | --- | --- | --- |
| AuthScreens login:95 | POST /auth/login; email/password | `{token,user}` with name, role, organization_id/name; saved session and navigation | Current:223 reads JSON. Recover original:311 SQL staff/driver lookup + bcrypt; preserve staff/driver role DTO and active checks |
| Organization registration:203 | POST /organizations/register; name/type/address/contact_name/email/phone/admin_name/admin_email/admin_password | `{token,user}` immediately logs in | Current:327 writes JSON. Original:423 SQL CTE creates org+staff, but ignores type/address/contact_name. Decide/persist supported inputs; no admin-only authority now |
| Driver registration:285 | POST /drivers/register; flat name/dob/email/phone/password/make/model/plate/seats + nested vehicle | `{token,user}` then verification screen | Current:1103 JSON. Original:1099 inserts driver+vehicle atomically, splits full name into first/last. Preserve names with explicit contract; validate integers; see affiliation issue below |
| Provider staff refresh | GET /clients | `{clients}`→Client[]; list, detail, booking selector | Current:423 JSON. Original:484 SQL org-scoped list returns DOB as text and optional client data; reusable |
| Client form:141 | POST /clients or PATCH /clients/:id; first/last/dob/contact/address/emergency/notes/boolean smartphone | `{client}`; refresh list then navigate | Current:441/494 JSON. Original:504/545 SQL scoped insert/update; verify clearing optional fields and actual boolean handling |
| Provider staff refresh | GET /destinations | `{destinations}`→Destination[]; address book and booking selector | Current:547 JSON. Original:593 maps SQL addresses location_type/latitude/longitude to type/lat/lng |
| Location save:321 | POST /destinations or PATCH /destinations/:id; name/type/address/lat/lng/is_active | `{destination}`; refresh/navigation | Current:567/609 JSON. Original:613/640 SQL mapping exists; add robust patch/create coordinate validation |
| Location active toggle:282 | PATCH /destinations/:id; is_active boolean | refreshed address list | Same recovery as above; don't hide inactive records from address management, but exclude them from booking |
| Provider staff refresh | GET /rides | `{rides}`→Ride[]; dashboard/calendar/list/detail/editor | Current:644 JSON. Original:676 SQL list/shapeRide; map statuses and include current UI data (see receive matrix) |
| Booking submit:570 | POST /rides; client_id, pickup_destination_id, destination_id and destination_destination_id, pickup instant, passengers, accessibility string, notes, trip_type, return instant, round_trip, free option; supplied address snapshots | `{rides}`→Ride[]; navigate using result[0].id after refresh | Current:693 JSON. Original:721 SQL verifies DB locations/client ownership and inserts linked legs transactionally; do not trust submitted snapshots; discard no supported inputs silently |
| Booking editor:570 | PATCH /rides/:id; same selected IDs/time/passengers/needs/notes; trip fields may also be supplied | `{ride}`→Ride; refresh/navigation | Current:824 JSON only. **No original SQL endpoint.** Implement org-scoped edit while requested, locking against assignment; define linked-leg editing instead of silently ignoring round-trip fields |
| RideDetail cancel:201 | POST /rides/:id/cancel; reason | `{ride}` then refresh | Current:913 JSON. Recover original:829 transaction updates scoped ride and expires dispatch; restrict valid states/flags; omit notifyStaff |
| Provider driver refresh | GET /drivers/me/rides | `{rides}`→assigned Ride[] | Current:969 JSON. Original:884 SQL filters driver_id; shape and privacy need adaptation |
| Provider driver refresh | GET /drivers/me/rides/available | `{rides}`→eligible Ride[] | Current:950 JSON eligibility now mismatches runtime fields. Original:870 + eligibleSql:27 uses approval/expiry, vehicle capacity/accessibility, timezone recurrence and ST_DWithin; retain server authority |
| RideDetail accept:165 | POST /rides/:id/accept | `{ride}`, refresh then detail | Current:982 JSON queue. Original:896 SQL row lock, approved assignment and accepted dispatch transaction; UI currently expects accepted. Update together and exclude notifications |
| RideDetail pickup:121 | POST /rides/:id/pickup | `{ride}`, refresh shows in_progress | Current driverTransition:1016 JSON accepted→in_progress. Original:986 SQL approved→in_progress with picked-up flag; add genuine pickup timestamp if retained in UI |
| RideDetail dropoff:130 | POST /rides/:id/dropoff | `{ride}`, refresh shows completed | Current:1058 generates fake metrics. Original:994 SQL flags/completed_at transaction; remove notification call; no fabricated metrics |
| RideDetail no-show:140 | POST /rides/:id/no-show; reason | `{ride}`, refresh shows no_show | Current:1061 JSON accepted state. Original:1025 SQL approved state; define actual waiting-deadline enforcement and reject early no-show if required |
| RideDetail withdrawal:148 | POST /rides/:id/withdraw; reason | `{ride}`, refreshed available/assigned lists | Current:1067 JSON. Original:1057 SQL returns ride to requested and expires accepted dispatch; preserve atomic release without notification calls |
| Provider driver refresh | GET /drivers/me/availability | `{availability}`→Availability[]; list/editor prefill | Current:1263 JSON. Original:1207 SQL ST_X/ST_Y, radius_m/1000, HH:MM mapping. Missing notice/wait fields in original/schema; persist or remove controls explicitly |
| Availability form:102 | POST /drivers/me/availability; kind/HH:MM/centre/radius_km/weekdays/month_days/on_date/timezone/notice/wait/note/is_active | `{availability}`, caller ignores immediate row and refreshes | Current:1277 JSON. Original:1233 SQL insert converts km to m, but ignores notice/wait and fixed timezone. Adapt complete contract |
| Availability edit:102 | PATCH /drivers/me/availability/:id; full form | refreshed persisted editor/list | Current:1364 JSON. **Original:1297 only writes is_active.** Implement validated recurrence/point/radius/policy update, atomically scoped to driver |
| Availability toggle:291 | PATCH /drivers/me/availability/:id; is_active | refreshed list | Original toggle is reusable for this specific action; do not assume it implements edit |
| Availability delete:309 | DELETE /drivers/me/availability/:id | `{ok:true}`, refreshed list | Current:1443 JSON. Original:1316 SQL scoped delete exists; soft/history policy if needed is a separate decision |
| Provider driver refresh | GET /organizations | `{organizations}`→Organization[]; verification dropdown | Current:317 filters missing seed status out. Original:416 SQL id/name list; UI accepts missing type here after compatibility fix, but Organization type still requires more fields elsewhere |
| Provider driver refresh | GET /drivers/me/verifications | `{verifications}`→Verification[] | Current:1198 JSON. Original:1152 SQL list metadata; map reviewer/organization/document keys and dates; no binary in list |
| Driver document form:353 | POST /drivers/me/verifications; FormData document/organization_id/check_type/issued_on/expires_on | `{verification}`; refresh/status | Current:1217 writes local file + JSON. Original:1172 memory upload max 5 MB writes bytea, filename, expiry, but ignores issued_on. Persist or remove that input; validate content/date/order |
| Provider staff refresh | GET /admin/verifications | `{verifications}`→Verification[] with nested driver for review UI | Current:1464 JSON returns flat driver fields. Original:1332 SQL also returns flat fields. Neither matches current v.driver.name/email. Add nested DTO or update consumer consistently |
| Staff approve:892 | POST /admin/verifications/:id/approve | `{verification}`, refresh/status | Current:1490 requires JSON admin role absent from seed. Original:1370 SQL scopes reviewing org and allows staff. User confirmed original any-active-staff policy; revalidate membership/active flag |
| Staff reject:901 | POST /admin/verifications/:id/reject; reason | `{verification}`, refresh/reason | Current:1521 JSON admin gate. Original:1389 SQL scoped reviewer/status/reason; align active authority and response dates |
| Provider staff refresh — excluded | GET /notifications; GET /admin/demo-summary | notices, summary including fake savings | Current:1587/1622 JSON; original:1432/1471 SQL. **Remove both requests and dependencies**; retain real completed count from rides or renamed real reporting endpoint if needed |
| Notification screen:838 — excluded | POST /notifications/:id/read | mark-read refresh | Current:1600 JSON; original:1453 SQL. **No restoration this milestone**; remove navigation/badges/screen calls and backend notification side effects |

Additional network calls: `travel.ts` calls OSRM routing and Nominatim geocoding, not CareRide API/PostgreSQL. Audit production privacy/failure handling separately. Do not pretend these fetches store trip data or measure real savings. Pin defaults are UI starting coordinates, not evidence that the entered address was geocoded/confirmed; require deliberate location confirmation if persisting those coordinates.

## Missing callers and endpoints

1. **Session validation receive link:** both branches provide GET /auth/me, but no current frontend caller uses it. Provider restores sessionStorage JSON directly. Add backend revalidation of stored sessions, expiry/deactivation handling and normalized name/role/organization receive data. No database-backed sessions requirement is implied merely by storing a bearer token in sessionStorage.
2. **Document receive link:** GET /admin/verifications/:id/document exists in both route files, but current approval UI never fetches it. Implement authenticated binary download/view and appropriate metadata. Ordinary request<T> is JSON-only and cannot receive the document.
3. **Seeded driver setup write/read links:** neither branch exposes authenticated vehicle/profile setup endpoints or frontend screens. Login-only drivers cannot use registration again because their emails already exist; availability and document alone do not satisfy vehicle eligibility. Plan explicit scoped profile/vehicle read/update endpoints and UI, or a combined setup endpoint; URL names are proposed, not existing routes. Handle no-vehicle/null safely.
4. **Booking-edit SQL link:** current PATCH /rides/:id must be ported to SQL; original recovery would return 404 for this UI action.
5. **Availability edit SQL link:** original PATCH returns success after updating only active flag; user-edited recurrence/location/policy would disappear on refresh. Test sent values against returned/reloaded SQL rows.
6. **Current searches are primarily client-side filters:** UI doesn't need new search fetches just to work; existing GET clients/destinations/rides accept query parameters. Pagination/server-side search can be deferred but must be planned before large datasets; don't diagnose intentional local filtering as a missing request.
7. **Detail lookup currently depends on provider lists:** client/location/ride pages may render unavailable before refresh completes or when list load fails. Ride GET /rides/:id exists but is not called by RideDetail. Add authorized on-demand detail loading/error states if lists cannot reliably supply the record; don't create nonexistent detail routes speculatively without need.

## Receive-side gaps when recovering original SQL

| Returned data | Current UI assumption | Result if restored unchanged | Plan |
| --- | --- | --- | --- |
| status approved/timed_out | accepted plus six-state Status; driver action buttons, dashboard and calendars filter accepted | assigned trips disappear from upcoming/schedule and pickup/no-show/withdraw buttons are unavailable; timeout badge/filter missing | Choose canonical SQL lifecycle; update types, every filter/action and tests, or one explicit documented boundary mapping |
| approved_at; no picked_up_at | accepted_at and picked_up_at in timeline | assignment timestamp blank; in-progress pickup not marked done | Map assignment timestamp; persist pickup timestamp or derive truthful flag-based step without fake time |
| client_name only from original shapeRide | WeekCalendar/BookingDay require ride.client.first_name; RideDetail reads client notes; driver provider never fetches clients | calendar names become Passenger/Booked; driver client accommodations vanish | Return role-scoped nested client with allowed fields; full staff details and minimal driver details; never add unrestricted client fetch for drivers |
| no organization name/phone or staff contact in original ride joins | RideDetail offers organization/staff calls if fields exist | contact actions missing | Add appropriate scoped organization/staff joins/DTO and privacy tests |
| no pickup_id/name or destination_name in original | location labels/calendar/edit use IDs/names when available, with address fallback | generic address labels, ambiguous pickup editor if duplicate address rows | Persist/return pickup address-book identity if required while keeping immutable snapshot; explicit name mapping |
| requested_by_staff_id | frontend expects requested_by_user_id | owner metadata missing where relied on | Canonicalize property names across backend, UI, tests; derive owner from token at creation |
| original vehicle plate mapping but lacks wheelchair in ride shape | nested vehicle with plate and wheelchair flag | missing accessibility metadata | Include safe complete vehicle DTO and deterministic current vehicle selection |
| document_type/document_filename/approved_by_staff_id | check_type/document_ref/approved_by_user_id/reviewed_by_name, organization | current normalization maps some keys but reviewer/name remain missing | Define exact Verification DTO including reviewer name/role-safe organization and display metadata |
| flat driver_name/email from verification query | v.driver.name/email | review screen loses identity | Explicit nested driver mapping with id/name/email/phone allowed for reviewer |
| radius_m + converted radius_km; no notice/wait | UI displays/edit minimum_notice_minutes/max_wait_minutes and ride.waiting_minutes | policies blank/defaulted and not actually enforced | Persist complete policy fields and agreed claim/wait semantics; do not set untrue defaults merely to satisfy a type |
| partial mutation DTO, e.g. availability {id,radius_m} | most callers ignore row and refresh, booking needs id from actual ride result | valid for current ignored mutation return but unsuitable for consumers assuming full row | Document envelope/shape; return full resource consistently where useful; contract-test reload, not only immediate mutation |
| SQL null optional fields/date objects | TS optional strings; date inputs expect YYYY-MM-DD; DateTime expects ISO | blank/broken date controls or misleading labels | Explicit DTO null handling and date/time serialization; preserve ISO instants vs date-only values |
| notifications/title/message/read fields, demo summary | old notice type/read_at and fabricated savings | obsolete fetches and sample UI persist | No adaptation needed this milestone: remove callers, UI and writes; retain true SQL ride counts |

## Send-side losses that are not fixed by restoring SQL

- **Affiliation:** DriverRegistration's affiliation select has no `name`; its option value is `provider`, while current backend checks `affiliation === 'transport_provider'`. UI sends organization_id conditionally but never sends the checked affiliation value. Current handler therefore defaults to independent; original SQL ignores affiliation entirely. Decide supported provider model and wire the actual value/columns, or remove unsupported controls explicitly.
- **Vehicle payload:** registration sends both flat fields and nested vehicle, while both backend variants read flat fields. Existing flat values mean the core fields aren't currently absent. Normalize to one contract; don't implement a nested-only server decoder without updating caller. Checkbox handling must explicitly send booleans.
- **Booking edit:** caller sends trip_type/round_trip/return_pickup_at, but current JSON PATCH ignores linked-return updates and original has no PATCH. Define edit one leg vs entire trip; make control labels and payload match.
- **Booking input time:** frontend constructs local Date from chosen wall-clock date/time while displaying Vancouver. Define Vancouver→UTC conversion for browsers outside Vancouver; backend validate instant/order and appropriate scheduling policy.
- **Availability:** new UI sends recurrence edits, minimum notice/max wait and timezone; retained schema/original SQL do not store all these policy fields. Keep implemented rules and fields aligned instead of accepting-and-dropping inputs.
- **Verification:** UI sends issued_on; SQL doesn't store it. Add column/mapping if required or remove input; map check_type to document_type explicitly.
- **Organization:** current form sends organization type/address/contact name; original ignores them and database has no columns. Any-active-staff authority is confirmed, but organization-type/affiliation model still requires a product decision.
- **Server snapshots:** booking sends address/coordinate fields that original correctly rebuilds from scoped DB addresses. Preserve server-authoritative lookups; malicious coordinates in a client payload must not alter historical location truth.

## Recovery implementation order and proof

1. Recover missing pool/type imports, readiness and SQL-aligned backend model while preserving noEmitOnError. Do not ship a compiling JSON fallback as the database fix.
2. Recover/adapt original active SQL authentication, clients and addresses with DTO tests; remove notification/metrics/demo sections. Keep actual mounted entrypoint registerApi connected to SQL, not dead helper routers.
3. Add authenticated driver profile/vehicle setup; recover bytea document handling and real staff viewing/approvals; recover availability and extend PATCH/policy persistence.
4. Recover linked ride insert/list/claim/transitions/dispatch release; implement newer booking PATCH; fix privacy, lifecycle statuses and receive fields for current screens. Keep transactions independent of notifications. Avoid using pool.query while retaining a checked-out transaction connection after COMMIT in tiny pools; read through that client or release before reacquiring.
5. Remove frontend demo transport and unsupported notification/sample UI. Validate build API origin and backend route prefixes. Restore /auth/me validation and binary document receive path.
6. Implement account-only runner; use agreed seven identities/Belkin and no operational setup rows. Ensure schema migration is separately versioned and existing real data is never reset by this task.
7. Verify each table-row mapping using disposable SQL data: form submit → actual request payload → SQL row → GET DTO → refreshed form/detail. Specifically test booking edit and availability edit for lost fields, assignment action visibility, client accommodations, document bytes and empty-driver setup.
8. Test separate backend processes claiming one ride concurrently, restart persistence, organization isolation/deactivated accounts, no browser/API fallback, and no notification fetch/write. Run fresh backend/frontend builds and existing plus SQL integration tests; update handoff with exact evidence.

See the main handoff for broader validation, cloud settings still unverified and outstanding questions. This is a source-complete map of observed callers/handlers and recovery gaps; the database target has been supplied, but live authenticated API behavior remains unverified until the backend URL is known and the source builds.
