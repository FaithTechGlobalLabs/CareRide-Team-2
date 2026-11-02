import type { RideRequest } from "../../domain/rides/rideRequest.js"
import type { DatabaseTransaction } from "./database.js"

export interface IRideRequestsRepository {
  /** Load the ride with its active dispatch, protecting it until transaction end. */
  findForAcceptance(
    rideId: string,
    transaction: DatabaseTransaction
  ): Promise<RideRequest | null>
  saveTimeout(
    ride: RideRequest,
    transaction: DatabaseTransaction
  ): Promise<void>
  /** Atomically persist the assignment and dispatch. False means the final
   * claimability or authoritative eligibility guard rejected the claim.
   */
  saveAcceptance(
    ride: RideRequest,
    transaction: DatabaseTransaction
  ): Promise<boolean>
}

/** A persistence adapter translates a competing assignment into this outcome. */
export class RideAssignmentConflict extends Error {}
