import type { RideResponse } from "@careride/api-contracts/rides/ride-responses"

import type { RideDetails } from "../../application/ports/rideQueries.js"

export function toRideResponse(ride: RideDetails): RideResponse {
  return {
    id: ride.id,
    client_id: ride.clientId,
    requested_by_staff_id: ride.requestedByStaffId,
    organization_id: ride.organizationId,
    pickup_address: ride.pickupAddress,
    pickup_lat: ride.pickupLatitude,
    pickup_lng: ride.pickupLongitude,
    destination_id: ride.destinationId,
    destination_address: ride.destinationAddress,
    destination_lat: ride.destinationLatitude,
    destination_lng: ride.destinationLongitude,
    requested_pickup_at: ride.requestedPickupAt.toISOString(),
    passenger_count: ride.passengerCount,
    accessibility_needs: ride.accessibilityNeeds.join(", "),
    accessibility_need_list: [...ride.accessibilityNeeds],
    notes: ride.notes,
    status: ride.status,
    driver_id: ride.driverId,
    approved_by_user_id: ride.approvedByStaffId,
    approved_at: ride.acceptedAt?.toISOString() ?? null,
    accepted_at: ride.acceptedAt?.toISOString() ?? null,
    ride_option: ride.rideOption,
    created_at: ride.createdAt.toISOString(),
    updated_at: ride.updatedAt.toISOString(),
    completed_at: ride.completedAt?.toISOString() ?? null,
    cancelled_reason: ride.cancelledReason,
    is_client_picked_up: ride.clientPickedUp,
    is_client_dropped_off: ride.clientDroppedOff,
    trip_group_id: ride.tripGroupId,
    linked_ride_id: ride.linkedRideId,
    trip_leg: ride.tripLeg,
    client_name: `${ride.client.firstName} ${ride.client.lastName}`,
    driver_name: ride.driver
      ? `${ride.driver.firstName} ${ride.driver.lastName}`
      : null,
    driver_phone: ride.driver?.phone ?? null,
    vehicle: ride.vehicle,
    sample: ride.id === "66666666-6666-4666-8666-666666666601",
  }
}
