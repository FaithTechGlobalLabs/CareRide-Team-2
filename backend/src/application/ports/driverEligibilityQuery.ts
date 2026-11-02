import type { DriverEligibilityFacts } from "../../domain/rides/rideAcceptancePolicy.js"
import type { DatabaseTransaction } from "./database.js"

export interface IDriverEligibilityQuery {
  /** Authoritative facts for this ride's organization and pickup, from one
   * statement snapshot. Does not promise to lock concurrent eligibility edits.
   */
  getFacts(
    rideId: string,
    driverId: string,
    transaction: DatabaseTransaction
  ): Promise<DriverEligibilityFacts>
}
