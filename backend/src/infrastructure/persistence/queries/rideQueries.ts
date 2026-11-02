import { sql } from "kysely"

import type { DatabaseTransaction } from "../../../application/ports/database.js"
import type {
  IRideQueries,
  RideDetails,
  RideNotificationContext,
} from "../../../application/ports/rideQueries.js"
import type { DatabaseClient } from "../databaseClient.js"

export class RideQueries implements IRideQueries {
  constructor(private readonly db: DatabaseClient) {}

  async getDetails(rideId: string): Promise<RideDetails | null> {
    const row = await this.db
      .selectFrom("ride_requests as r")
      .innerJoin("clients as c", "c.id", "r.client_id")
      .leftJoin("drivers as d", "d.id", "r.driver_id")
      .leftJoinLateral(
        (eb) =>
          eb
            .selectFrom("vehicles")
            .select(["make", "model", "plate_number", "seats"])
            .whereRef("driver_id", "=", "d.id")
            .limit(1)
            .as("v"),
        (join) => join.onTrue()
      )
      .selectAll("r")
      .select([
        "c.first_name as client_first_name",
        "c.last_name as client_last_name",
        "d.first_name as driver_first_name",
        "d.last_name as driver_last_name",
        "d.phone as driver_phone",
        "v.make",
        "v.model",
        "v.plate_number",
        "v.seats",
      ])
      .where("r.id", "=", rideId)
      .executeTakeFirst()
    if (!row) return null

    return {
      id: row.id,
      clientId: row.client_id,
      requestedByStaffId: row.requested_by_staff_id,
      organizationId: row.organization_id,
      pickupAddress: row.pickup_address,
      pickupLatitude: row.pickup_lat,
      pickupLongitude: row.pickup_lng,
      destinationId: row.destination_id,
      destinationAddress: row.destination_address,
      destinationLatitude: row.destination_lat,
      destinationLongitude: row.destination_lng,
      requestedPickupAt: row.requested_pickup_at,
      passengerCount: row.passenger_count,
      accessibilityNeeds: row.accessibility_needs,
      notes: row.notes,
      status: row.status === "approved" ? "accepted" : row.status,
      driverId: row.driver_id,
      approvedByStaffId: row.approved_by_user_id,
      acceptedAt: row.approved_at,
      rideOption: row.ride_option,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      cancelledReason: row.cancelled_reason,
      clientPickedUp: row.is_client_picked_up,
      clientDroppedOff: row.is_client_dropped_off,
      tripGroupId: row.trip_group_id,
      linkedRideId: row.linked_ride_id,
      tripLeg: row.trip_leg,
      client: {
        firstName: row.client_first_name,
        lastName: row.client_last_name,
      },
      driver:
        row.driver_first_name &&
        row.driver_last_name !== null &&
        row.driver_phone !== null
          ? {
              firstName: row.driver_first_name,
              lastName: row.driver_last_name,
              phone: row.driver_phone,
            }
          : null,
      vehicle:
        row.plate_number &&
        row.make !== null &&
        row.model !== null &&
        row.seats !== null
          ? {
              make: row.make,
              model: row.model,
              plate: row.plate_number,
              seats: row.seats,
            }
          : null,
    }
  }

  async getNotificationContext(
    rideId: string,
    transaction?: DatabaseTransaction
  ): Promise<RideNotificationContext | null> {
    const row = await (transaction ?? this.db)
      .selectFrom("ride_requests as r")
      .innerJoin("clients as c", "c.id", "r.client_id")
      .innerJoin(
        "addresses as destination",
        "destination.id",
        "r.destination_id"
      )
      .leftJoin("addresses as pickup", (join) =>
        join
          .onRef("pickup.organization_id", "=", "r.organization_id")
          .onRef("pickup.address", "=", "r.pickup_address")
      )
      .select([
        "r.requested_by_staff_id as requestedByStaffId",
        "r.passenger_count as passengerCount",
        "r.requested_pickup_at as pickupAt",
        "r.trip_leg as tripLeg",
        "c.first_name as clientFirstName",
        "destination.name as destinationName",
        sql<string>`COALESCE(pickup.name, r.pickup_address)`.as("pickupName"),
      ])
      .where("r.id", "=", rideId)
      .executeTakeFirst()
    return row ?? null
  }
}
