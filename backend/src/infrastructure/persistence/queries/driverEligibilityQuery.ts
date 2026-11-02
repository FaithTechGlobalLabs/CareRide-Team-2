import { sql } from "kysely"
import { jsonArrayFrom } from "kysely/helpers/postgres"

import type { DatabaseTransaction } from "../../../application/ports/database.js"
import type { IDriverEligibilityQuery } from "../../../application/ports/driverEligibilityQuery.js"
import type { DriverEligibilityFacts } from "../../../domain/rides/rideAcceptancePolicy.js"

/** PostgreSQL owns timezone / geography mechanics. Both the facts query and
 * final conditional claim use these exact same expressions.
 */
export function availabilityComparisons() {
  return {
    pickupTimeInWindow: sql<boolean>`(r.requested_pickup_at AT TIME ZONE a.timezone)::time
      BETWEEN a.start_time AND a.end_time`,
    pickupDateInRange: sql<boolean>`(a.starts_on IS NULL OR (r.requested_pickup_at AT TIME ZONE a.timezone)::date >= a.starts_on)
      AND (a.ends_on IS NULL OR (r.requested_pickup_at AT TIME ZONE a.timezone)::date <= a.ends_on)`,
    recurrenceMatches: sql<boolean>`COALESCE(
      (a.kind = 'one_time' AND a.on_date = (r.requested_pickup_at AT TIME ZONE a.timezone)::date)
      OR (a.kind = 'weekly' AND EXTRACT(DOW FROM r.requested_pickup_at AT TIME ZONE a.timezone)::int = ANY(a.weekdays::int[]))
      OR (a.kind = 'monthly' AND EXTRACT(DAY FROM r.requested_pickup_at AT TIME ZONE a.timezone)::int = ANY(a.month_days::int[])),
      false)`,
    pickupWithinRadius: sql<boolean>`ST_DWithin(a.centre,
      ST_SetSRID(ST_MakePoint(r.pickup_lng, r.pickup_lat), 4326)::geography,
      a.radius_m)`,
  }
}

export class DriverEligibilityQuery implements IDriverEligibilityQuery {
  async getFacts(
    rideId: string,
    driverId: string,
    transaction: DatabaseTransaction
  ): Promise<DriverEligibilityFacts> {
    // One statement snapshot, matching PostgreSQL's existing decision semantics.
    // Keep timezone recurrence and PostGIS calculations at the database adapter.
    const comparisons = availabilityComparisons()
    const result = await transaction
      .selectFrom("ride_requests as r")
      .where("r.id", "=", rideId)
      .select((eb) => [
        jsonArrayFrom(
          eb
            .selectFrom("driver_verifications as v")
            .select([
              "v.status",
              sql<number | null>`v.expires_on - CURRENT_DATE`.as(
                "daysUntilExpiry"
              ),
            ])
            .where("v.driver_id", "=", driverId)
            .whereRef("v.approved_by_org_id", "=", "r.organization_id")
        ).as("verifications"),
        jsonArrayFrom(
          eb
            .selectFrom("vehicles as veh")
            .select([
              "veh.seats",
              "veh.wheelchair_accessible as wheelchairAccessible",
            ])
            .where("veh.driver_id", "=", driverId)
        ).as("vehicles"),
        jsonArrayFrom(
          eb
            .selectFrom("driver_availabilities as a")
            .where("a.driver_id", "=", driverId)
            .where("a.is_active", "=", true)
            .select([
              "a.is_active as active",
              comparisons.pickupTimeInWindow.as("pickupTimeInWindow"),
              comparisons.pickupDateInRange.as("pickupDateInRange"),
              comparisons.recurrenceMatches.as("recurrenceMatches"),
              comparisons.pickupWithinRadius.as("pickupWithinRadius"),
            ])
        ).as("availabilities"),
      ])
      .executeTakeFirstOrThrow()
    return result
  }
}
