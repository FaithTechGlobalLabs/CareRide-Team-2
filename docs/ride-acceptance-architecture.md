# Parallel ride acceptance implementation

`POST /rides/:id/accept` continues to use `backend/src/api/routes.ts`.
`POST /v2/rides/:id/accept` uses the new layers. Both use the same bearer tokens,
PostgreSQL pool, underlying tables, and HTTP response shapes. No migration is
required to exercise V2 against an existing CareRide database.

## Responsibilities and dependency direction

- **Domain:** `RideRequest` protects claimability and changes its assigned driver
  and accepted dispatch together. `PassengerCount` is a positive integer value
  object. `RideAcceptancePolicy` evaluates approval, vehicle, and availability
  facts, preserving the requirement that a single vehicle and a single
  availability record satisfy their respective conditions.
- **Application:** `RideRequestsService.acceptRide` owns its input and result.
  It coordinates authorization, aggregate loading, policy evaluation, persistence,
  notification creation, and the response lookup. It starts the Kysely transaction
  and forwards it explicitly to the participating repository and query methods.
  Its ports own query, notification, authentication, and clock contracts.
- **Infrastructure:** Kysely repositories and queries implement those ports.
  Table and column types live in `infrastructure/persistence/schemas`. Database
  rows are mapped to domain objects or application read models. JWT verification
  remains compatible with existing tokens using the installed `jsonwebtoken`.
- **Presentation:** the framework-independent controller validates the shared
  HTTP schemas, maps inputs to the use case, and maps application results back
  to HTTP. An Express route adapter mounts it at the V2 URL.

Domain imports no outer layer. Application imports domain and its own ports,
with the deliberate Kysely transaction exception described below.
Presentation imports application and `@careride/api-contracts`; it does not import database
types or adapters. Infrastructure adapters import application and domain.
`container.ts` is the composition root: its cross-layer imports are solely for
constructing and wiring reusable adapters. Likewise,
`create-http-app.ts` is HTTP bootstrap code, rather than a domain/application module.

## Decision: explicit Kysely transactions in application coordination

We deliberately relax pure clean architecture for transaction coordination.
`application/ports/database.ts` defines compile-time aliases for the real Kysely
transaction and the client's transaction method. These types reference
infrastructure's `DatabaseSchema`; that type-only outward source dependency is
also part of the exception. It introduces no registry, token, runtime wrapper,
or service-owned SQL.

The reasons are pragmatic:

- The application use case naturally owns the sequence of reads, domain decisions,
  and writes that must succeed together. Keeping `database.transaction().execute`
  visible there makes its transaction lifetime explicit.
- The transaction must still start before `findForAcceptance` acquires its ride
  row lock and last until all writes complete. Moving the beginning to the first
  write would require changing concurrency handling, including stale-read
  validation, timeout updates, and failed-claim classification. This refactor
  preserves the existing locking protocol instead.
- Passing the same Kysely transaction to methods avoids an earlier AI design
  re-creating a set of repository and query objects and passing the Kysely transaction
  to the constructor for every invocation of the service method for accepting rides.
  The composition root creates repositories and queries
  once; none stores a mutable current transaction.
- An opaque application-owned transaction handle would require a registry and
  lifecycle management solely to hide a technology choice we already made.
  That indirection does not provide enough benefit for this use case.

Writes, eligibility retrieval, and the locking read require a transaction argument.
The notification-context query receives that transaction during acceptance, and
can also run as a standalone read using its normal database client. The final
response query remains outside the transaction. The existing notification-context
integration test can still construct `RideQueries` with its own transaction as
the query client's base connection; production wiring does not create per-request
query instances.

Domain entities and policies remain independent of Kysely, persistence types,
application contracts, and HTTP. SQL, table definitions, row mapping, and PostgreSQL
error-code translation stay in infrastructure. Adapters translate unique violations
to `RideAssignmentConflict`; Kysely rolls back before the service catches that
application-level error and returns `alreadyAssigned`.

The cost is explicit technology coupling in application coordination and its
transaction-aware ports. Replacing Kysely or changing the schema type's location
will require updating those types and transaction calls as well as the adapters.
Most use-case sequencing and domain logic can remain. This is a focused exception,
not permission to put SQL or database rows into the domain or HTTP contracts.

The shared `@careride/api-contracts` workspace exposes TypeScript source under the
`development` export condition. Backend dev and tests enable that condition through
Node; the default backend TypeScript configuration enables it for typechecking
and editors, with `noEmit` and a root that includes the contracts source. These
commands need no contracts build, and tests run backend source through `tsx`.

Production keeps the default JavaScript and declaration exports from `dist`.
The backend build compiles contracts first, then uses `tsconfig.build.json` to
disable the development condition and emit only backend `src` into backend `dist`.
No third-party dependency was installed or upgraded.

## Transaction and compatibility details

1. The application service starts a Kysely transaction, then passes it to the
   repository to lock the ride row and load its active dispatch.
2. Reject a non-requested or assigned ride. A repeated acceptance by the same
   driver remains a conflict, rather than an idempotent success.
3. If pickup is at or before the application clock's decision time, persist
   `timed_out` and **commit** before mapping the result to HTTP 409.
4. Fetch eligibility facts together in one SQL statement. The domain policy
   evaluates approval, expiry, capacity, accessibility, and availability.
5. Apply a conditional assignment update that rechecks state, future pickup,
   approval, vehicle, and availability in its own statement snapshot. The database
   continues to store status `approved`; domain and HTTP use `accepted`.
6. Insert the accepted dispatch and requesting staff member's inbox notification
   in the same transaction. A write failure aborts the transaction. The existing
   partial unique index still prevents two accepted dispatches for one ride.
7. After commit, independently read the ride details and map the HTTP response.
   This preserves `{ ride: null }` if that lookup finds nothing and a generic
   HTTP 500 if the post-commit read fails; such a failure does not undo acceptance.

V2 uses the injected application clock's acceptance timestamp for both assignment
and dispatch writes. The original handler uses PostgreSQL's transaction timestamp.
Timeout checks remain based on application time, and the final future-pickup
guard and verification date arithmetic remain based on PostgreSQL time.

Timezone recurrence and PostGIS radius calculations stay in the Kysely adapter.
Their expressions are shared between fact retrieval and the final claim guard.
The domain policy's acceptance rules also appear as conditional-write safeguards;
this deliberate duplication preserves the original atomic eligibility recheck.
Changing a policy requires updating and verifying those safeguards as well.

The requesting staff notification is synchronous in both implementations. There
is no outbox or additional push dispatch in V2. The ignored request body and
string path ID remain compatible with the extracted contracts. The new verifier
rejects signed tokens that lack a nonempty subject or supported account kind.

## Explicit limits

This extraction does not introduce driver-level locks or update the old approval,
vehicle, or availability mutation paths. Eligibility can still change after the
final claim statement's snapshot. Stronger ordering would require every relevant
mutation path to participate in a shared coordination protocol; it does not
automatically require merging aggregates or adding repositories.

No new rule prevents overlapping rides, requires approval through pickup day,
checks destination coverage, or couples acceptance of round-trip legs.

## Verification

From the repository root:

```sh
npm run test:acceptance --workspace=backend
npm run typecheck --workspace=backend
npm run lint --workspace=@careride/api-contracts
```

The focused tests cover domain transitions and policy combinations, use-case
coordination through stubbed ports, and controller authentication/error/response
mapping through mocked dependencies. The HTTP wiring test checks both routes,
real JWT verification, and CORS with a stubbed use case. It binds a localhost port;
none of these tests connect to PostgreSQL.

Database tests and live database/end-to-end verification are intentionally deferred.
Before replacing the original route, verify Kysely query behavior against PostGIS,
concurrent claims, rollback of assignment/dispatch/notification writes, expiry and
timezone boundaries, and the existing frontend journey. Deployment packaging also
needs to include the workspace contracts package and its build output; the old
backend-only Docker context does not include workspace packages.
