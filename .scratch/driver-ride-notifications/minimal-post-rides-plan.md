# Minimal POST /rides driver notifications

Plan approved by the user on 2026-11-20. The design interview is complete.
Implementation has not been authorized.
This first phase supplements [the broader plan](spec.md), which is preserved.

## Terminology

Use **open ride request** for a requested ride with a future pickup time and no
assigned driver. Driver availability remains the driver's declared time window
and service area; eligibility is whether a particular driver can claim an open
ride request. See the [shared glossary](../../GLOSSARY.md).

This terminology change applies to the glossary and plan. Preserve approved
notification wording and existing identifiers such as `available_ride`,
`available_rides_enabled`, and `/drivers/me/rides/available`; this plan does not
add a general UI-label or API rename.

## Confirmed decisions

- Trigger notification processing only for newly created rides through
  `POST /rides`. Defer release triggers, eligibility-change triggers, existing-ride
  backfill, and scheduled reconciliation.
- Notification processing is best effort. Ride creation succeeds independently
  of notification failures. A crash or timeout may leave drivers unnotified;
  this phase does not promise durable retries or guaranteed delivery.
- Log notification failures without exposing sensitive notification or
  subscription data.
- Preserve the existing broader specification and planning visuals.
- Match drivers using exactly the current open-ride-request list and claim
  eligibility rules: requested/unassigned/future rides, organization approval
  and expiry, vehicle capacity and wheelchair capability, and an active
  availability covering pickup time, recurrence, dates, timezone, and radius.
  Share the predicate; do not introduce new matching rules in this phase.
- Target push delivery to the new notices produced by this task, reusing the
  existing transport and delivery records rather than invoking the unchanged
  global dispatcher.
- Follow ADR 0001 for the touched notification workflow and delivery code.
  Reuse means extract and relocate existing behavior into the appropriate
  layers, with shared application services and infrastructure adapters serving
  both targeted delivery and the existing dispatcher. Do not add a second
  delivery implementation beside the monolithic legacy function.
- Create one inbox notice per eligible driver per booking, with one push per
  subscribed device. Matching either leg qualifies the driver; matching both
  legs of a round-trip booking must not produce a second notice or push.
  Both the push tap and inbox notice link open the open-ride-request list at
  `/driver`, which shows only independently eligible legs and groups a round
  trip when both legs qualify.
- Follow the existing ride-alert category semantics: disabling
  `available_rides_enabled` suppresses creation of new open-ride-request inbox
  notices and their push sends. Disabling only `push_enabled` still permits
  inbox notices. Preserve existing preference defaults and inbox history.
  The existing JSON producer implements the creation gate and SQL push delivery
  implements the send gate; this phase supplies the missing SQL driver producer.
- Use push title `CareRide` and body `A ride fits your availability. Tap to view
  available rides.` Keep client and appointment details out of device alerts.
- Use inbox title `A ride fits your availability` and message `Open available
  rides to view pickup times and details.` Keep the new inbox notice generic.
- Run one set-based eligibility SQL statement for the newly created booking in
  the background task. It finds all eligible drivers for either created leg and
  groups them so each driver appears once. Bulk-create one inbox notice per
  matching driver; do not run eligibility SQL separately per driver, push, or
  device. PostgreSQL evaluates candidate eligibility within the statement.
  Subscription and delivery-record queries remain separate from eligibility
  matching. Accept the possibility that an alert becomes stale after matching.
- Fetch the latest open-ride-request list when drivers follow the alert. Verify
  that both frontend and backend handle concurrent acceptance attempts, with
  authoritative acceptance preventing a second driver from claiming the ride.
  Fix demonstrated gaps within that flow; do not add SSE in this phase.
- Duplicate prevention is scoped to the single `POST /rides` invocation:
  schedule one task, group matches by driver/booking, and reuse the existing
  per-notification/device delivery records and recorded-success checks.
  `waitUntil` does not automatically restart the task. Do not create a persistent
  producer that could reconcile the same booking after the invocation ends.
- Make one bounded delivery pass. Do not implement a retry loop, scheduler,
  Queue, separate worker Function, or durable task mechanism in this phase.
  A separate Function-and-Queue retry design is being planned separately.
  Delivery outcome records can remain, but their existence does not schedule
  another attempt. Provider acceptance is not proof of device display.

## Verified constraints

- The current SQL booking endpoint creates staff notices, commits the ride transaction,
  reads the response, and returns `201`. It does not create SQL driver notices.
- A round-trip booking creates two linked ride requests in one transaction.
- The SQL push dispatcher requires persisted driver notification rows. The
  existing JSON-store driver producer does not populate those rows.
- The existing push dispatcher is global: it leases up to 40 deliveries per
  call and coalesces overlapping calls within a process. Calling it unchanged
  cannot ensure the newly created ride's notices are attempted immediately.
- `waitUntil` accepts an already-started promise and retains the Vercel
  invocation without awaiting that promise in the HTTP handler. Request and
  background work share the function deadline; this is not a durable queue.
- `@vercel/functions` is absent. Installation requires explicit approval of an
  exact command under this repository's dependency policy.
- Push title and body are configurable in backend code. Current driver copy is
  generic and contains no ride or client details.
- Push taps currently open `/notifications`: both the backend payload and the
  service worker specify that route, with the worker ignoring the payload URL.
  Inbox ride links currently open one ride request. `/driver` lists open ride
  requests and groups both legs only when both are independently eligible.

## Acceptance and navigation findings

- The current SQL acceptance handler locks the ride before checking it, rejects
  an assigned ride with `409`, and conditionally writes the assignment using
  authoritative eligibility. A unique index also prevents multiple accepted
  dispatches. Preserve this algorithm.
- The frontend already displays acceptance errors and disables the button while
  a request is pending. It refreshes shared data only after successful mutations,
  so a losing acceptance leaves stale data until the next poll.
- Open ride requests refresh on initial loading and polling, but not driver route
  entry or window focus. Overlapping refreshes can overwrite newer data with an
  older response. Address these gaps for the driver acceptance/list flow.
- The open-ride-request list has no app-provided pull-to-refresh gesture or manual
  Refresh button. Confirmed: add a visible Refresh button beside the list
  heading, reusing existing refresh behavior with loading/error feedback.
  Defer a custom pull-to-refresh gesture; do not add dependencies for refreshing.
- Current acceptance tests use database stubs, not a real two-driver race.
- Reading the inbox does not dispatch or retry push. The existing authenticated
  dispatch endpoint is the only current production caller of `flushPush`.
  Outcome records remain compatible with it if explicitly invoked, but this
  phase does not schedule it or implement new retry behavior.

## Proposed implementation outline

1. Extract the eligibility SQL used by the current endpoints into a shared
   infrastructure helper used
   by open-request-list, claim, and new-booking match queries. Preserve predicate
   semantics. Match only the IDs created by this request in one set-based query;
   retrieve all eligible drivers and group matches by driver and booking rather
   than by device or leg. Bulk-create their notices, preferably in the same
   `INSERT ... SELECT ... RETURNING` statement, returning new notification IDs
   for targeted delivery. Do not loop over drivers to issue eligibility queries
   or individual notice inserts.
2. After the ride transaction commits, register exactly one caught promise with
   Vercel `waitUntil`. Pass immutable created IDs and the booking identity, not
   the HTTP request or transaction client. Use independent pool connections.
   Keep matching, notice writes, and push I/O inside that promise. Do not await
   its completion to return the current `201` response. A scheduling or task
   failure must not enter booking rollback/error handling after commit.
3. Keep orchestration out of the route, SQL in infrastructure, and Vercel
   invocation-lifetime tracking at the HTTP boundary, following ADR 0001. Wire
   the SQL endpoints registered by the running app; do not migrate unrelated
   legacy handlers or V2.
   Insert one generic `available_ride` inbox notice per eligible driver,
   respecting category preferences independently of push support/configuration.
   Store booking context in existing notification metadata and set the action
   URL to `/driver`; no availability version or new migration is proposed for
   the confirmed single-invocation scope.
4. Extract the existing delivery orchestration into an application service and
   its SQL/provider operations into infrastructure adapters behind
   application-owned ports, as detailed below. Use that shared service for both
   targeted delivery of new notification IDs and the existing global dispatcher.
   Preserve transport behavior, per-device delivery uniqueness,
   preference/subscription-age filtering, success records, and
   expired-subscription handling. Scope targeted leasing/discovery
   to those IDs so global backlog or process-wide coalescing cannot substitute
   another task's work. Attempt each due target once in this pass; retain the
   existing eight-send concurrency and five-second provider timeout. The
   invocation deadline remains the overall limit; do not add a retry loop or
   repeat full eligibility matching. Log sanitized aggregate outcomes and
   errors; abrupt termination may prevent a final log.
5. Include `/driver` as the page to open in driver ride-alert push messages.
   Update the service worker (the browser script that displays pushes and
   handles taps) to open that page when the driver taps the notification,
   instead of always opening `/notifications`. Allow only known destinations
   within the CareRide app; if the destination is missing or unrecognized, open
   `/notifications`. Generic inbox notices link to `/driver` too and must not
   be labelled unavailable merely because a representative leg is absent.
   Set `/driver` only for driver open-ride-request alerts. Staff push messages
   continue to specify `/notifications`, and tapping them continues to open the
   staff inbox. Preserve staff notification text and existing inbox action links.
   The shared service worker must handle both destinations rather than sending
   every notification tap to `/driver`.
6. Refresh current open ride requests on driver list entry and foreground return.
   Refresh after rejected acceptance, preserve useful failure feedback, and
   prevent older overlapping responses from replacing newer list data. Keep
   backend acceptance authoritative and preserve its current protections. Add
   the confirmed manual Refresh button with loading/error feedback.
7. In ordinary local Node execution, run the same caught asynchronous task
   without awaiting it in the endpoint. Vercel request-context retention is a
   deployment property; local success alone is not evidence for it. Loss during
   local shutdown remains within the accepted best-effort scope; add no durable
   shutdown worker or job registry.

## Notification layering under ADR 0001

- **Application services** own the new-booking notification workflow and the
  bounded push-delivery pass: call bulk notice creation, obtain targeted
  deliveries, invoke the push transport, and record outcomes. These services
  depend on application-owned ports, not Express, Vercel APIs, SQL clients,
  database rows, or `web-push`.
- **Application ports** describe the operations those workflows need, with
  contracts beside the relevant port/use case. Keep bulk matching plus notice
  creation available as one persistence operation so layering does not turn
  `INSERT ... SELECT ... RETURNING` into per-driver calls or unnecessary
  database round trips. Delivery persistence and external push transport have
  separate responsibilities and ports.
- **Infrastructure persistence adapters** own shared eligibility SQL, set-based
  notice creation, subscription/preference filtering, delivery uniqueness and
  leasing, outcome persistence, and expired-subscription deletion. Follow the
  existing persistence/schema conventions; keep database rows inside adapters.
- **Infrastructure push adapter** owns `web-push`, VAPID setup, provider request
  serialization, timeout configuration, and provider-error translation into
  typed outcomes for application coordination.
- **Presentation/hosting boundary** owns the HTTP response, validation, and
  Vercel `waitUntil` registration. The booking route schedules the injected
  notification use case after commit; it contains no delivery implementation.
  The existing authenticated dispatch route invokes the shared delivery use
  case with its existing global behavior.
- **Composition root** constructs the adapters and application services and
  injects them into the legacy routes registered by the running app. It may import across
  layers for wiring, as ADR 0001 permits. Application code must not import an
  infrastructure implementation to obtain its dependencies.
- **Domain** stays independent. Do not invent notification aggregates or move
  provider/SQL concerns into domain code merely to populate every layer. Keep
  the confirmed matching semantics and shared SQL guard behavior intact.

Extract the existing behavior instead of copying it. Legacy entry files may
remain only as thin compatibility delegates if existing callers require them;
they must not retain a separate orchestration, SQL, or provider implementation.
This is a focused notification refactor, not migration of all booking, acceptance,
or other legacy API behavior.

## Verification for implementation

Start with focused tests, then existing Docker-backed PostgreSQL/PostGIS
integration tests, then the driver browser flow. No implementation tests were
run during this planning interview; only documentation checks were run.

- A deferred notification promise does not delay `201`. Booking rollback never
  schedules notifications. Background rejection never changes booking success.
- Matching agrees with the current list/claim eligibility, including vehicle,
  approval, availability, and radius rejection cases. Two qualifying legs or
  overlapping availability records create only one notice per driver/booking.
  A driver eligible for either leg receives that single generic notice.
- Category disabled means no new notice/send; push disabled or unconfigured
  still permits inbox creation. Preserve subscription-age filtering. Targeted
  delivery does not drain unrelated work, coalesce away a concurrent booking,
  or repeat a recorded-success delivery; no eligibility query occurs per device.
- Provider failures, expired subscriptions, and missing configuration leave
  booking success intact. No test depends on an automatic retry or scheduler.
- Verify that targeted and existing global dispatch use the same application
  delivery service and adapters. Cover existing staff/global-dispatch behavior
  after extraction, in addition to new driver targeting. Unit-test application
  coordination with port doubles; verify persistence against the real database using
  and stub only the external push provider in integration tests.
- Race two eligible drivers through the real acceptance endpoint used by the app:
  assert one winner, one `409`, one assigned driver and one accepted dispatch.
- Verify generic inbox and push navigation, round-trip grouping, fresh list
  loading, acceptance-conflict feedback/refresh, and stale-response protection.
  Verify the frontend behavior when the booking is already unavailable.
- Verify separately that a driver ride-alert tap opens `/driver`, a staff push
  tap still opens `/notifications`, and a missing/unrecognized destination falls
  back to `/notifications`. Preserve staff inbox action navigation.
- On Preview, verify that the response completes while the background task is
  pending and a subscribed device receives the alert with the agreed text.
  Confirm a tap opens fresh open ride requests. Deployment is separate from this
  planning request.

## Approval and implementation prerequisites

All proposed product choices are resolved, and the user confirmed shared
understanding by approving the plan on 2026-11-20. No application code,
dependency, environment, or deployment changes are authorized by plan approval.

Implementation needs explicit dependency approval for this exact command:

```sh
npm install --workspace=backend @vercel/functions
```

That command has not been run. Repository rules require approval before adding
new dependencies. Full builds, pushing, and deployment also require their
respective authorization if needed later.

## Sources

- `backend/src/api/routes.ts`: creation, list, and claim handlers used by the app.
- `backend/src/notifications/push.ts`: SQL push delivery.
- [Vercel waitUntil reference](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#waituntil).
- [Express on Vercel](https://vercel.com/docs/frameworks/backend/express).

## Documentation policy

Record resolved domain terms in the root glossary as they crystallize. This
small, reversible first phase does not currently warrant a new ADR; reconsider
if the interview produces a lasting architectural decision.
