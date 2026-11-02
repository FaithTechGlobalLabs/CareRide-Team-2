import type { RideStatus } from "../../domain/rides/rideRequest.js"
import type { DatabaseTransaction } from "./database.js"

/** Read model owned by the query port, independent of SQL rows and HTTP JSON. */
export interface RideDetails {
  id: string
  clientId: string
  requestedByStaffId: string
  organizationId: string
  pickupAddress: string
  pickupLatitude: number
  pickupLongitude: number
  destinationId: string
  destinationAddress: string
  destinationLatitude: number
  destinationLongitude: number
  requestedPickupAt: Date
  passengerCount: number
  accessibilityNeeds: string[]
  notes: string | null
  status: RideStatus
  driverId: string | null
  approvedByStaffId: string | null
  acceptedAt: Date | null
  rideOption: "free" | "paid_external"
  createdAt: Date
  updatedAt: Date
  completedAt: Date | null
  cancelledReason: string | null
  clientPickedUp: boolean
  clientDroppedOff: boolean
  tripGroupId: string | null
  linkedRideId: string | null
  tripLeg: "outbound" | "return" | null
  client: { firstName: string; lastName: string }
  driver: {
    firstName: string
    lastName: string
    phone: string
  } | null
  vehicle: {
    make: string
    model: string
    plate: string
    seats: number
  } | null
}

export interface RideNotificationContext {
  requestedByStaffId: string
  clientFirstName: string
  pickupAt: Date
  passengerCount: number
  pickupName: string
  destinationName: string
  tripLeg: "outbound" | "return" | null
}

export interface IRideQueries {
  getDetails(rideId: string): Promise<RideDetails | null>
  getNotificationContext(
    rideId: string,
    transaction?: DatabaseTransaction
  ): Promise<RideNotificationContext | null>
}
