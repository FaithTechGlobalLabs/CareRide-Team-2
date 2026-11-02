# CareRide: driver locks and version fields

For coordinating acceptance with eligibility edits, I would start with a PostgreSQL row lock on the driver. A shared driver version can also work, but adds a version protocol and conflict handling. Versions on separate tables alone do not give this cross-table guarantee.

These are teaching examples based on the current working tree on November 1, 2026. They are proposed additions, not applied backend changes. SQL/Kysely snippets omit imports and some existing service plumbing. New ports, helpers and columns are explicitly identified below. No dependencies need to be added for either approach.

## 1. First decide what must stay true

Assume this policy: acceptance and eligibility edits must take effect in an agreed order. If a rejection takes effect first, acceptance must see it. If acceptance takes effect first, a later rejection is allowed and does not automatically undo the ride.

An overlap does not necessarily represent a business bug: two overlapping requests may reasonably be ordered either way. The guard makes that order explicit. It does not mean the request arriving first always wins, or that rejection takes priority.

If the actual requirement is “a driver must remain eligible through pickup,” BOTH approaches need more behavior: rejection must block the edit, cancel/reassign affected rides, or cause pickup to fail. Neither a lock nor a counter chooses that policy for you.

There are two different concurrency problems:

| Decision | Competing operations | Shared coordination point |
| --- | --- | --- |
| Who gets this ride? | Two drivers accept the same ride | The ride row |
| Can this driver accept using these eligibility facts? | Acceptance versus verification, vehicle or availability changes | A guard shared by those commands for this driver |

Your current repository already locks the ride in `findForAcceptance()`. `saveAcceptance()` checks requested/unassigned/future pickup and eligibility again in its UPDATE, then writes the accepted dispatch in the same transaction. Keep those protections. The added driver guard addresses a different boundary.

A transaction makes its writes commit or roll back together. It does not automatically prevent other transactions from changing everything you read. At PostgreSQL Read Committed, an ordinary query reads a statement snapshot. See [PostgreSQL transaction isolation](https://www.postgresql.org/docs/current/transaction-iso.html#XACT-READ-COMMITTED).

## 2. Shared driver lock: take turns before checking

“Shared” here means a common convention across commands. The example uses an exclusive row lock, not PostgreSQL's `FOR SHARE` mode. There is no Redis service, JavaScript mutex, persistent `locked = true` flag, or extra lock table.

Lock the existing driver row. Different backend processes connected to the same database participate in the same database lock. Different drivers can proceed independently.

Proposed infrastructure helper, called with the transaction connection:

```ts
async function lockDriver(
  tx: Transaction<DatabaseSchema>,
  driverId: string,
): Promise<void> {
  await tx.selectFrom("drivers")
    .select("id")
    .where("id", "=", driverId)
    .forUpdate()
    .executeTakeFirstOrThrow();
}
```

Expose that helper through a proposed `transaction.driverGuard.lock(driverId)` port, created alongside the repositories in `Container`. This keeps Kysely out of the application service. The guard and every repository must use the SAME transaction connection.

Insertion into the existing acceptance callback, after the ride is found and readiness is checked, immediately before `eligibility.getFacts()`:

```ts
// findForAcceptance() already locked this ride.
await transaction.driverGuard.lock(input.actor.id); // NEW

// This is a separate statement AFTER acquiring the guard.
const facts = await transaction.eligibility.getFacts(
  ride.id, input.actor.id,
);
const eligibility = this.policy.evaluate(ride.requirements, facts);
const accepted = ride.accept(input.actor.id, eligibility, now);
if (accepted !== "accepted") return accepted;
if (!(await transaction.rides.saveAcceptance(ride)))
  return "notEligible";

// Continue with the existing notification write and return.
// The unit of work then commits; both row locks are released.
```

The rejection path must join the convention too. Today the legacy staff rejection route issues a single UPDATE through `pool.query()`. It would become one transaction with the guard before the edit. In this example `staff` is authenticated, `verificationId` and `reason` are validated, and verification ownership cannot be reassigned while this command runs.

```ts
await db.transaction().execute(async (tx) => {
  const verification = await tx.selectFrom("driver_verifications")
    .select("driver_id")
    .where("id", "=", verificationId)
    .where("approved_by_org_id", "=", staff.organizationId)
    .executeTakeFirstOrThrow();

  await lockDriver(tx, verification.driver_id); // SAME guard

  await tx.updateTable("driver_verifications")
    .set({ status: "rejected", reject_reason: reason,
      approved_by_staff_id: staff.id,
      reviewed_at: sql<Date>`now()` })
    .where("id", "=", verificationId)
    .where("driver_id", "=", verification.driver_id)
    .where("approved_by_org_id", "=", staff.organizationId)
    .returning("id")
    .executeTakeFirstOrThrow(); // Throw rolls the transaction back.
});
```

How coordination changes: if rejection holds the guard first, acceptance waits, then reads the rejected verification. If acceptance holds it first, rejection waits until the ride/dispatch commit. Acceptance may still fail if there is no suitable vehicle or availability. Rejection does not necessarily make a driver ineligible if another qualifying approved verification exists.

The driver lock does not automatically lock child tables. Safety comes from ALL relevant writers taking the same guard before editing. That includes verification review, vehicle capacity/accessibility edits, and availability creation, updates and deletion. Raw SQL scripts and background jobs count as writers too.

PostgreSQL holds the row lock until transaction end. Ordinary reads can still proceed. Keep the transaction short; do not call an external notification provider while holding it. See [PostgreSQL row locks](https://www.postgresql.org/docs/current/explicit-locking.html#LOCKING-ROWS).

## 3. What a version field is good at

A version is a revision counter, not a timestamp. It answers “has this record changed since I read it?” Only an atomic conditional write makes the check useful.

For example, a proposed `ride_requests.version` lets a client that read version 4 attempt this write:

```sql
-- Proposed column, not an applied migration:
ALTER TABLE ride_requests
  ADD COLUMN version integer NOT NULL DEFAULT 0;

UPDATE ride_requests
SET notes = $1, version = version + 1
WHERE id = $2 AND version = 4
RETURNING version;
-- One returned row: saved, now version 5.
-- Zero rows: missing record or stale version; do not claim success.
```

If two editors both read 4, one saves 5; the other's WHERE no longer matches. This prevents a lost update, where the second editor silently overwrites the first. Every relevant update must increment that version. Keep tenant/actor checks in the real command too.

This is often simpler for a single record or a stale form. An atomic conditional ride claim also works without a numeric counter when `status = 'requested' AND driver_id IS NULL` fully expresses the conflict. Your current ride lock already handles competing claims.

However, a ride's version does not change merely because someone updates a verification row. Even separate versions on ride, verification, vehicle and availability do not coordinate automatically. Reading them twice leaves a gap after the last check. An inserted availability row has no previously-read version, and a deleted row disappears entirely. You need a protocol covering the whole set.

## 4. A working version alternative: one driver coordination revision

Use one proposed counter on `drivers` to represent the eligibility inputs collectively. This does not require moving the child entities into one Driver aggregate. It is a coordination record for commands spanning those roots.

```sql
-- Proposed migration, not applied:
ALTER TABLE drivers
  ADD COLUMN coordination_version integer NOT NULL DEFAULT 0;
```

Also add `coordination_version: Generated<number>` to `DriversTable`. This example uses an integer for readability; a production bigint counter needs an explicit PostgreSQL-to-TypeScript representation.

The protocol is: read version BEFORE facts; evaluate facts; atomically increment only if the version still matches; save the ride/dispatch in that same transaction. A successful conditional increment holds a write lock until transaction end. This is optimistic coordination, but it still uses database locks when writing.

Proposed transaction adapter methods, exposed through `transaction.driverRevision`:

```ts
class CoordinationConflict extends Error {}

async function readRevision(tx: Transaction<DatabaseSchema>, id: string) {
  const row = await tx.selectFrom("drivers")
    .select("coordination_version")
    .where("id", "=", id).executeTakeFirstOrThrow();
  return row.coordination_version;
}

async function claimRevision(
  tx: Transaction<DatabaseSchema>, id: string, expected: number,
) {
  const claimed = await tx.updateTable("drivers")
    .set((eb) => ({
      coordination_version: eb("coordination_version", "+", 1),
    }))
    .where("id", "=", id)
    .where("coordination_version", "=", expected)
    .returning("id").executeTakeFirst();
  if (!claimed) throw new CoordinationConflict();
}

async function bumpRevision(tx: Transaction<DatabaseSchema>, id: string) {
  await tx.updateTable("drivers")
    .set((eb) => ({
      coordination_version: eb("coordination_version", "+", 1),
    }))
    .where("id", "=", id)
    .returning("id").executeTakeFirstOrThrow();
}
```

Replace the lock insertion with this version-based acceptance fragment, after the ride/readiness steps. The notification code stays inside the existing callback after these lines.

```ts
const expected = await transaction.driverRevision.read(input.actor.id);
const facts = await transaction.eligibility.getFacts(ride.id, input.actor.id);
const eligibility = this.policy.evaluate(ride.requirements, facts);
if (eligibility !== "eligible") return "notEligible";

// Compare AND increment atomically. A mismatch THROWS, causing rollback.
await transaction.driverRevision.claim(input.actor.id, expected);

// This driver revision is now protected until commit or rollback.
const accepted = ride.accept(input.actor.id, eligibility, now);
if (accepted !== "accepted") return accepted;
if (!(await transaction.rides.saveAcceptance(ride)))
  return "notEligible";
// Continue with the existing transactional notification write.
```

Every eligibility edit must bump that SAME counter inside its edit transaction. In the rejection example, replace `await lockDriver(tx, verification.driver_id)` with `await bumpRevision(tx, verification.driver_id)`, before the UPDATE. The bump and rejection commit or roll back together. Bump for inserts and deletes too. A separate version on each verification row is not required for this protocol, though it could additionally protect staff forms from stale edits.

Why acceptance increments too: after successfully checking the version, it must prevent an edit from slipping in before acceptance commits. A plain SELECT that sees version 7 does not reserve version 7.

If rejection wins: version 7 becomes 8, and acceptance's conditional increment expecting 7 fails. Roll back and rerun the WHOLE acceptance transaction with fresh facts. If acceptance wins: it changes 7 to 8 and keeps the write lock; rejection's bump waits, then changes 8 to 9 after acceptance commits.

Two acceptances for different rides by the same driver also conflict on the counter. That is conservative and does not itself prohibit overlapping rides. On retry both could succeed. Preventing double booking needs an explicit schedule rule and a protected overlap check or a database constraint.

## 5. Handling version conflicts

Do not translate `CoordinationConflict` into `alreadyAssigned`: the ride might still be free. A bounded retry should surround the unit-of-work call, after the failed transaction has rolled back.

```ts
async function retryCoordination<T>(work: () => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try { return await work(); }
    catch (error) {
      if (!(error instanceof CoordinationConflict) || attempt >= 2)
        throw error; // Exhausted: map to a defined retryable API conflict.
    }
  }
}

// Wrap the existing callback; recreate the ride and facts on each attempt.
const outcome = await retryCoordination(() => this.unitOfWork.run(work));
// `work` here means the existing acceptance callback with the additions above.
```

This illustrative wrapper makes at most three attempts. Under load, add bounded backoff/jitter and an explicit retryable response after exhaustion. Do not repeat external side effects inside retries. Current notification-row writes roll back with the transaction; external email/push would need post-commit delivery or an outbox. Deadlocks and serialization errors are separate retry cases for either design.

## 6. Which is simpler here?

| Concern | Shared driver row lock | Shared driver version |
| --- | --- | --- |
| Core idea | Take turns, then read | Read, check-and-increment, retry on change |
| Schema change | None for an existing driver row | One driver counter and schema type |
| Acceptance change | Acquire guard before reading facts | Read counter, read facts, claim counter |
| Eligibility edits | Acquire guard before edit | Bump counter before edit |
| Concurrent command | Usually waits before reading facts | May compute stale facts, then wait and fail |
| Database locking | Explicit row lock | UPDATE still acquires a row lock |
| Stale browser form | Needs a separate version if desired | Can add/use a suitable form version; the broad counter may conflict unnecessarily |
| Forgotten writer | Breaks the convention | Breaks the convention |

My recommendation for the review's cross-table eligibility concern is the shared driver row lock. It is easier to explain, audit and integrate with your current transaction-scoped repositories. Use per-record versions when you need to detect stale edits; they can coexist with the driver guard.

Optimistic coordination can be useful when reads/computation overlap substantially and conflicts are rare. Here the database work is short, and the shared counter introduces schema changes and conflict handling while still making both sides coordinate on the driver row. Measure contention before adding complexity. The lock also serializes same-driver claims to different rides, although unrelated drivers can proceed.

## 7. How this fits your current code

The application service coordinates; `RideAcceptancePolicy` still decides eligibility from facts; `RideRequest` still owns ride/dispatch state; infrastructure implements the guard or revision protocol. A shared coordination point does not require one giant Driver object.

The working entry point constructs `createHttpApp()` before registering the legacy API. The new ride-acceptance route and the remaining legacy eligibility edit routes must share the convention. Updating only the new acceptance service would leave a hole.

- `backend/src/application/services/rideRequests/rideRequestsService.ts:43`: transaction callback and acceptance sequence.
- `backend/src/application/ports/rideAcceptanceUnitOfWork.ts:9`: add the chosen transaction-scoped port here.
- `backend/src/infrastructure/container.ts`: construct its adapter with the same transaction.
- `backend/src/infrastructure/persistence/repositories/rideRequestsRepository.ts:18`: ride lock; `:66`: conditional write and dispatch.
- `backend/src/infrastructure/persistence/queries/driverEligibilityQuery.ts:31`: multi-table facts query.
- `backend/src/api/routes.ts:1435`: legacy verification review; availability handlers also need the convention.

Both examples retain the current ride-first, driver-second lock order. Any future command taking both must use the same order; edits shown here take only the driver. Do not add a driver-first command that then locks a ride. Multi-driver operations need deterministic ordering too. Account/organization deletion requires its own lifecycle coordination; this driver example does not solve every cross-root workflow.

The examples assume Read Committed and fresh queries on the primary transaction connection. Keep lock acquisition and the facts query as separate statements, so a query after a wait sees the newly committed eligibility edits. A counter does not represent the passage of time; pickup deadlines and expiry still need their explicit policy checks. Current SQL uses transaction-time `now()` and `CURRENT_DATE`; exact wall-clock-at-commit validity would require a separately defined policy.

Suggested implementation verification: use two real database connections and controlled barriers to test rejection-first and acceptance-first orders, same-ride competing claims, different drivers, rollback, availability insert/delete and vehicle changes. For versions, force a mismatch and verify the entire transaction retries without duplicate dispatches or notification rows. These examples have not been executed against PostgreSQL.
