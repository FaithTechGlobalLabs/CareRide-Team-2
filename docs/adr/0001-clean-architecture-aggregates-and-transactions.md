---
status: accepted
date: 2026-11-01
---

# Clean architecture, aggregate ownership, and explicit transactions

CareRide is introducing a layered implementation alongside its original API,
using ride acceptance as a worked example. We separate domain decisions,
application coordination, persistence, and HTTP handling, while deliberately
allowing Kysely transactions in application coordination and transaction-aware
ports. We choose aggregate and persistence interfaces around business ownership
and consistency requirements, with database enforcement of concurrent writes.

## Context and scope

The original `POST /rides/:id/accept` remains in
[api/routes.ts](../../backend/src/api/routes.ts). The parallel
`POST /v2/rides/:id/accept` uses the new layers. This record captures the agreed
design, its tradeoffs, and guidelines for extending it; it does not declare the
entire legacy backend migrated or claim that all candidate aggregates below have
been implemented.

The implementation walkthrough, compatibility details, and verification commands
remain in [ride-acceptance-architecture.md](../ride-acceptance-architecture.md).

## 1. Layer responsibilities and the inward dependency rule

The default rule is about **source-code dependencies**, not the direction in which
an HTTP request executes. Inner code defines the interfaces it needs; outer
adapters implement them. This follows
[Robert C. Martin's dependency rule](https://blog.cleancoder.com/uncle-bob/2012/08/13/the-clean-architecture.html).

| Layer | Owns | Normal dependencies |
| --- | --- | --- |
| `domain/` | Entities, value objects, aggregate behavior, domain events, and business policies | Domain code; no application, infrastructure, or presentation dependencies |
| `application/` | Use-case coordination, input/result contracts, and adapter ports | Domain and application code |
| `infrastructure/` | Kysely queries, repositories, database schemas/rows, JWT verification, and other technology adapters | Application ports, domain, and infrastructure code |
| `presentation/` | Controllers, routes, HTTP validation, and response mapping | Application and presentation code, including shared HTTP contracts |

`packages/api-contracts` belongs to presentation conceptually. An application
result is not an HTTP response or a database row. Use-case contracts stay beside
their use case; port-specific retrieved-data contracts stay beside their port.
Infrastructure maps rows into domain objects or application read models, and
presentation maps those values into wire formats. Do not create a global DTO
folder or duplicate identical shapes solely to suggest separation. Use domain
value objects where values carry rules, such as `PassengerCount`.

The composition root, [container.ts](../../backend/src/infrastructure/container.ts),
constructs and connects classes across layers. Its wiring imports, and the HTTP
bootstrap imports in `create-http-app.ts`, are distinct from domain/application
business logic. A repository must not import a controller to perform its work.

### Deliberate exception: Kysely transaction coordination

The application service calls `database.transaction().execute(...)` and forwards
the same transaction object to repository and query methods that participate.
[application/ports/database.ts](../../backend/src/application/ports/database.ts)
defines `DatabaseTransaction = Transaction<DatabaseSchema>` and a
`TransactionalDatabase` type exposing the client's transaction method.

This is explicitly an exception to pure dependency inversion: Kysely is an outer
technology choice, and the alias has a type-only dependency on infrastructure's
`DatabaseSchema`. Type erasure avoids a runtime import but does not erase the
source-code dependency. The exception applies to transaction coordination and
the signatures of transaction-aware application ports. It does not permit SQL,
Kysely row types, or HTTP contracts in domain entities or policies.

We chose this because the service already expresses the workflow whose operations
must succeed together. Passing an explicit transaction keeps that lifetime visible
and lets the container create reusable adapters once. An opaque transaction token
would require a registry, resolution, and lifetime management; transaction-bound
adapter factories would construct another adapter set for each invocation. Neither
adds enough value here to justify hiding Kysely behind those mechanisms.

The cost is accepted coupling: replacing Kysely requires changing transaction
calls and affected application-port types, as well as persistence adapters.
Moving the database schema type can also affect the shared alias. Most business
decisions and use-case sequencing can remain. Domain code stays independent.

## 2. Choose aggregate roots by the rules they protect

An aggregate root is the entry point for changing a group of domain state whose
invariants must hold together. An entity relationship or object graph alone does
not establish aggregate ownership. See
[Fowler's aggregate description](https://martinfowler.com/bliki/DDD_Aggregate.html).

When choosing a boundary:

1. State the invariant and a concrete command that could break it.
2. Identify the smallest state that must be coordinated to preserve that rule.
3. Choose a root through which relevant changes to that state must pass.
4. Prefer small boundaries; unrelated edits should not contend on a giant root.
5. Separate relationships that can tolerate delay or reference another root by ID.
6. Establish a concurrency protocol; merely constructing the aggregate does not
   keep its state current while another request writes.

These guidelines draw on
[Vaughn Vernon, Effective Aggregate Design, Part I](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_1.pdf).
The following CareRide boundaries are our code-based decisions or candidates,
not requirements supplied by that article.

| Worked example | Rule and resulting boundary | Status |
| --- | --- | --- |
| `RideRequest` and its assignment dispatch | A ride's assigned driver must agree with its accepted dispatch, and there must be at most one accepted dispatch. Acceptance writes both; cancellation/withdrawal must change the related state consistently. Keep dispatch assignment state under `RideRequest`. | Implemented for the V2 acceptance model; legacy lifecycle handlers still exist. |
| Driver and vehicles | A vehicle used only as a driver's capability record is a plausible child. Registration or cascade deletion alone does not prove a continuing cross-entity invariant. The schema allows multiple vehicles; do not invent an exactly-one-vehicle rule. | Candidate for future driver modeling, not a reason to load the full Driver aggregate for acceptance. |
| `DriverVerification` and `AvailabilityRule` | A verification has its own document/review/expiry lifecycle. An availability rule owns a coherent recurrence, window, and service area. Current acceptance depends on those facts but does not own their records. | Independent root candidates. |
| A round-trip `Trip` or `Booking` | Atomic creation of two linked legs is a workflow requirement. Today each leg can be accepted independently. A root owning both becomes justified if continuing rules require both legs to be edited, cancelled, or validated together. | Candidate only if those additional rules are established. |
| Organization and all tenant records | Tenant membership does not require every staff member, client, location, and ride to be one aggregate. No demonstrated rule requires that enormous object graph to change as one unit. | Keep smaller owners rather than making Organization a giant aggregate. |

Use only the state needed to protect a command's invariants: acceptance needs the
active dispatch, not every historical dispatch or verification document's bytes.
This is not permission to omit a child that participates in a rule or to expose
independent child writes that bypass the root's protection.

References across roots do not merge them. The review's preference for small
aggregates, identity references, and delayed cross-root effects is informed by
[Vernon, Part II](https://www.dddcommunity.org/wp-content/uploads/files/pdf_articles/Vernon_2011_2.pdf).
Notification delay or an outbox is a possible future design, not implemented
behavior: acceptance currently writes its staff notification synchronously.

## 3. Repositories follow ownership; queries follow information needs

Create repository interfaces around aggregates that need persistence, rather
than around every table touched by an endpoint. A child normally persists through
its root's repository. This is the repository-per-aggregate guideline described
in [Microsoft's persistence guidance](https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/infrastructure-persistence-layer-design).

Read queries can join several owners and return a purpose-specific read model.
A join does not make the joined objects aggregate children, and reading an entity
does not require creating its repository. This separation is supported by
[Microsoft's query guidance](https://learn.microsoft.com/en-us/dotnet/architecture/microservices/microservice-ddd-cqrs-patterns/cqrs-microservice-reads).

For ride acceptance, the four responsibilities are:

| Responsibility | Current class | Why it fits |
| --- | --- | --- |
| `RideRequestRepository` | `RideRequestsRepository` | Loads and protects the ride's relevant state; writes assignment and accepted dispatch together. It owns persistence across `ride_requests` and `dispatches`. A separately callable `DispatchRepository` would make bypassing that ownership easier. |
| `NotificationRepository` | `NotificationsRepository` | Persists the requesting staff member's notification in `notifications`. A notification's recipient, content, and read state have an independent lifecycle; it is not a ride child. |
| `DriverEligibilityQuery` | `DriverEligibilityQuery` | Retrieves authoritative approval, vehicle, and availability facts for this driver and the ride's organization/pickup. It reads `driver_verifications`, `vehicles`, and `driver_availabilities` without pretending those are owned by the ride. |
| `RideQueries` | `RideQueries` | Joins ride, client, driver, and vehicle data for the response, and ride/client/address data for notification context. It returns application-port contracts rather than persistence rows. |

Consequently, this command does not need Client, Address, Driver, Verification,
and Availability repositories just to read their facts or labels. Such repositories
may be appropriate for commands that change those owners. Four responsibilities
here is a worked design, not a fixed repository count for every endpoint.

Two distinctions prevent misuse:

- Response/read-model queries may cross aggregate boundaries freely, subject to
  authorization and privacy. Their joins do not define write ownership.
- A query feeding a business decision needs an explicit freshness guarantee.
  Eligibility cannot be taken from a stale dashboard projection merely because
  retrieving it does not itself write anything.

The synchronous notification is an intentional transaction across independent
owners to preserve current behavior. It is not evidence of a larger Ride-plus-
Notification aggregate. Moving that effect to reliable asynchronous processing
would require its own delivery, retry, and idempotency design.

## 4. Put decisions where their meaning belongs

| Kind of logic | Owner | Acceptance example |
| --- | --- | --- |
| State validity for one value | Value object | `PassengerCount` is a positive integer. |
| Transition and invariant over owned state | Aggregate root, delegating to children as useful | `RideRequest` rejects a non-requested/assigned ride, marks an expired request timed out, or sets its driver and accepted dispatch together. |
| Business decision using information from independent owners | Domain policy/service | `RideAcceptancePolicy` evaluates approval, capacity, accessibility, and availability. |
| Workflow sequencing and effects | Application use case | Authorize the actor, start the transaction, load state/facts, invoke domain behavior, persist, create the notification, and read response details. |
| Storage and concurrency mechanisms | Infrastructure | SQL predicates, row locks, indexes, transaction-aware persistence, timezone/PostGIS calculations, and driver-error translation. |
| Wire validation and representation | Presentation | Validate path/body shapes and translate application outcomes into HTTP status/message pairs. |

### A policy can be a domain service

Yes, a domain service could perform this evaluation. A significant domain operation
that does not naturally belong to an entity or value object is a service candidate;
see [Eric Evans, DDD Reference, Services, printed page 14](https://www.domainlanguage.com/wp-content/uploads/2016/05/DDD_Reference_2015-03.pdf#page=21).
`RideAcceptancePolicy` already plays that role. The name emphasizes a specific
decision rather than defining a different architectural layer or requiring another
wrapper called `RideAcceptanceDomainService`.

Its inputs can be aggregates, entities, value objects, or domain facts. Whole
aggregates are useful when the calculation needs their encapsulated behavior;
they are not mandatory inputs. Here `RideRequirements` and
`DriverEligibilityFacts` carry enough information, without loading unrelated
state or the approval documents themselves:

```ts
const facts = await eligibilityQuery.getFacts(ride.id, driverId, transaction)
const decision = rideAcceptancePolicy.evaluate(ride.requirements, facts)
const outcome = ride.accept(driverId, decision, now)
```

The application retrieves the facts; the domain operation evaluates their meaning.
The query must scope them to the correct driver and ride organization. Keeping
facts as explicit inputs makes the policy deterministic and straightforward to
unit-test. A domain-service label does not itself authorize importing application
repository ports, querying PostgreSQL, or coordinating commits from domain code.
Other DDD designs may use domain-level retrieval abstractions; that is not the
dependency arrangement chosen here.

For example, a two-passenger wheelchair booking cannot combine a four-seat,
inaccessible vehicle with a one-seat accessible vehicle. One vehicle must satisfy
both conditions. Likewise one active availability must cover the time, date,
recurrence, and radius; matching the time in one row and radius in another is
insufficient. These are policy decisions over facts, not SQL-join ownership rules.

Approval currently means any approved, unexpired verification for the relevant
organization. Expiry is checked against the database's current date, not the
future pickup date. Requiring every document type to pass or approval to remain
valid through pickup would be new business rules.

## 5. Persistence must protect invariants under concurrent writes

Passing domain checks in one in-memory object does not prevent another request
from making the same decision. Protect the stored result as well. For V2 acceptance:

1. Start the transaction **before** loading the ride with `FOR UPDATE`.
2. Hold that ride lock while reading its active dispatch, evaluating rules, and
   writing the resulting state. All participating methods receive the same
   Kysely transaction; writes do not silently fall back to the normal client.
3. Recheck requested/unassigned/future-pickup state and authoritative eligibility
   in the conditional assignment `UPDATE`, then inspect whether it claimed a row.
4. Insert the accepted dispatch and requesting staff notification before commit.
   An insertion failure aborts all preceding writes in that transaction.
5. Keep the partial unique index `dispatches_one_accepted_idx`, enforcing at most
   one accepted dispatch per ride. Keep the schema's status/driver and pickup/
   dropoff checks. The index does not by itself prove cross-table driver agreement;
   the coordinated writes preserve that relationship.
6. On timeout, save the timeout and return normally so it commits; map the result
   to HTTP 409 afterward. Read the success response only after commit.

The SQL guards intentionally repeat rules expressed in the domain. Share vendor
calculations where practical, and keep policy and guard changes aligned. Domain
tests prove decision behavior; they do not prove database isolation or rollback.
Database concurrency and integration checks are separate verification work.

### Worked race: two drivers accept one ride

Without persistence protection, both requests could load an unassigned ride,
pass every domain check, and save competing assignments. Currently the first
locking read blocks the second request's write/locking read until transaction end.
After the winner commits, the second sees an assigned ride and returns a conflict.
The conditional update and unique dispatch index supply additional safeguards.

PostgreSQL holds these row locks until transaction end. A locking read performed
as a separate autocommit statement would release its lock before the later writes,
losing protection for the read/decision/write sequence. See
[PostgreSQL's row-lock documentation](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS).

Starting a transaction at the first write can be valid with an optimistic design,
but moving the wrapper alone is unsafe. It requires authoritative write-time
validation or version checks, handling a stale aggregate by reloading/re-evaluating,
and preserving rejection/timeout classification. We retain the current pessimistic
locking boundary to avoid adding that redesign to this example.

For future aggregate commands, choose a concurrency protocol explicitly. Root
locking must happen before relevant child reads, and every child-writing path must
follow it. With optimistic concurrency, relevant child changes must participate
in the root's version check/update. A version field that child writers ignore
does not protect a cross-child invariant.

### Worked limit: a verification changes during acceptance

The ride lock does not lock verification, vehicle, or availability rows. The final
claim can observe approval and then commit after a concurrent rejection commits.
Under default Read Committed isolation, statements have committed-data snapshots;
starting a transaction earlier does not freeze every row it later reads. See
[PostgreSQL's isolation documentation](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-READ-COMMITTED).

If that ordering becomes unacceptable, acceptance and **all** relevant eligibility
edits must use a shared guard or another correctly designed concurrency protocol.
A serializable strategy also requires appropriate participating transactions and
retries; serializable ordering is not a promise of latest wall-clock data at commit.
Simply adding aggregate classes, repositories, or a lock in only the new endpoint
does not coordinate old mutation paths.

First decide the business timing: eligibility at the ordered acceptance decision,
or eligibility maintained through pickup/completion. The latter needs a defined
response to later revocation or capacity/availability changes, such as rejection
of the edit, reassignment, or a pickup-time check. Neither policy implies that all
eligibility records must become ride children. No new overlapping-ride, destination-
coverage, or coupled-round-trip acceptance rule is introduced by this ADR.

## Consequences and review guidance

The domain model owns business meaning; the application keeps coordination visible;
and persistence owns SQL plus the mechanisms that protect stored state. That costs
some duplicated guard predicates and accepted Kysely/schema coupling, while avoiding
an opaque transaction registry or per-invocation adapter factory.

When extending the design, identify the owning invariant, the facts needed to
decide, the point at which they must be authoritative, the concurrency protocol,
and the read/write contract owner. Revisit a boundary when a new business rule
requires coordinated state; do not infer it from table count, joins, object nesting,
or the fact that several operations currently share a transaction.
