import { sql } from "kysely"

import type { DatabaseTransaction } from "../../../application/ports/database.js"
import type { IRideRequestsRepository } from "../../../application/ports/rideRequestsRepository.js"

import { RideAssignmentConflict } from "../../../application/ports/rideRequestsRepository.js"
import {
  AcceptedDispatch,
  RideRequest,
} from "../../../domain/rides/rideRequest.js"
import { availabilityComparisons } from "../queries/driverEligibilityQuery.js"

/** Transaction arguments are required: writes and the locking read must share
 * the transaction opened by the application service.
 */
export class RideRequestsRepository implements IRideRequestsRepository {
  async findForAcceptance(
    rideId: string,
    transaction: DatabaseTransaction
  ): Promise<RideRequest | null> {
    const row = await transaction
      .selectFrom("ride_requests")
      .select([
        "id",
        "status",
        "driver_id",
        "requested_pickup_at",
        "passenger_count",
        "accessibility_needs",
      ])
      .where("id", "=", rideId)
      .forUpdate()
      .executeTakeFirst()
    if (!row) return null

    const dispatch = await transaction
      .selectFrom("dispatches")
      .select(["driver_id", "responded_at"])
      .where("ride_request_id", "=", rideId)
      .where("response", "=", "accepted")
      .executeTakeFirst()

    return new RideRequest({
      id: row.id,
      status: row.status === "approved" ? "accepted" : row.status,
      driverId: row.driver_id,
      requestedPickupAt: row.requested_pickup_at,
      passengerCount: row.passenger_count,
      accessibilityNeeds: row.accessibility_needs,
      acceptedDispatch: dispatch
        ? new AcceptedDispatch(dispatch.driver_id, dispatch.responded_at)
        : null,
    })
  }

  async saveTimeout(
    ride: RideRequest,
    transaction: DatabaseTransaction
  ): Promise<void> {
    if (ride.status !== "timed_out")
      throw new Error("Expected a timed-out ride.")
    await transaction
      .updateTable("ride_requests")
      .set({ status: "timed_out", updated_at: sql<Date>`now()` })
      .where("id", "=", ride.id)
      .where("status", "=", "requested")
      .where("driver_id", "is", null)
      .executeTakeFirst()
  }

  async saveAcceptance(
    ride: RideRequest,
    transaction: DatabaseTransaction
  ): Promise<boolean> {
    const dispatch = ride.acceptedDispatch
    if (
      ride.status !== "accepted" ||
      !dispatch?.acceptedAt ||
      ride.driverId !== dispatch.driverId
    ) {
      throw new Error("An accepted ride must agree with its dispatch.")
    }
    try {
      const comparisons = availabilityComparisons()
      // The domain decides whether to accept. These conditional-write safeguards
      // independently recheck authoritative eligibility in the UPDATE snapshot,
      // preserving the legacy claim's guarantee if facts changed since evaluation.
      const claimed = await transaction
        .updateTable("ride_requests as r")
        .set({
          status: "approved",
          driver_id: dispatch.driverId,
          approved_at: dispatch.acceptedAt,
          updated_at: dispatch.acceptedAt,
        })
        .where("r.id", "=", ride.id)
        .where("r.status", "=", "requested")
        .where("r.driver_id", "is", null)
        .where("r.requested_pickup_at", ">", sql<Date>`now()`)
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom("driver_verifications as v")
              .select("v.id")
              .where("v.driver_id", "=", dispatch.driverId)
              .whereRef("v.approved_by_org_id", "=", "r.organization_id")
              .where("v.status", "=", "approved")
              .where((verification) =>
                verification.or([
                  verification("v.expires_on", "is", null),
                  verification(
                    sql<number>`v.expires_on - CURRENT_DATE`,
                    ">=",
                    0
                  ),
                ])
              )
          )
        )
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom("vehicles as veh")
              .select("veh.id")
              .where("veh.driver_id", "=", dispatch.driverId)
              .whereRef("veh.seats", ">=", "r.passenger_count")
              .where((vehicle) =>
                vehicle.or([
                  vehicle("veh.wheelchair_accessible", "=", true),
                  sql<boolean>`NOT EXISTS (
              SELECT 1 FROM unnest(r.accessibility_needs) need
              WHERE lower(need) LIKE '%wheelchair%'
            )`,
                ])
              )
          )
        )
        .where((eb) =>
          eb.exists(
            eb
              .selectFrom("driver_availabilities as a")
              .select("a.id")
              .where("a.driver_id", "=", dispatch.driverId)
              .where("a.is_active", "=", true)
              .where(comparisons.pickupTimeInWindow)
              .where(comparisons.pickupDateInRange)
              .where(comparisons.recurrenceMatches)
              .where(comparisons.pickupWithinRadius)
          )
        )
        .returning("r.id")
        .executeTakeFirst()
      if (!claimed) return false

      await transaction
        .insertInto("dispatches")
        .values({
          ride_request_id: ride.id,
          driver_id: dispatch.driverId,
          response: "accepted",
          responded_at: dispatch.acceptedAt,
        })
        .execute()
      return true
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "23505") {
        throw new RideAssignmentConflict("Already assigned", { cause: error })
      }
      throw error
    }
  }
}
