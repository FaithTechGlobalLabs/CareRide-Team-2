import type { IClock } from "../../ports/clock.js"
import type { TransactionalDatabase } from "../../ports/database.js"
import type { IDriverEligibilityQuery } from "../../ports/driverEligibilityQuery.js"
import type { INotificationsRepository } from "../../ports/notificationsRepository.js"
import type { IRideQueries, RideDetails } from "../../ports/rideQueries.js"
import type { IRideRequestsRepository } from "../../ports/rideRequestsRepository.js"
import type { AuthenticatedActor } from "../../ports/tokenVerifier.js"

import { RideAcceptancePolicy } from "../../../domain/rides/rideAcceptancePolicy.js"
import { RideAssignmentConflict } from "../../ports/rideRequestsRepository.js"
import { driverAssignedNotification } from "./driverAssignedNotification.js"

export interface AcceptRideInput {
  rideId: string
  actor: AuthenticatedActor
}

export type AcceptRideResult =
  | { kind: "accepted"; ride: RideDetails | null }
  | {
      kind:
        | "notFound"
        | "alreadyAssigned"
        | "timedOut"
        | "notEligible"
        | "forbidden"
    }

export interface IRideRequestsService {
  acceptRide(input: AcceptRideInput): Promise<AcceptRideResult>
}

export class RideRequestsService implements IRideRequestsService {
  constructor(
    private readonly database: TransactionalDatabase,
    private readonly ridesRepository: IRideRequestsRepository,
    private readonly eligibilityQuery: IDriverEligibilityQuery,
    private readonly notificationsRepository: INotificationsRepository,
    private readonly rideQueries: IRideQueries,
    private readonly clock: IClock,
    private readonly rideAcceptancePolicy: RideAcceptancePolicy
  ) {}

  async acceptRide(input: AcceptRideInput): Promise<AcceptRideResult> {
    if (input.actor.kind !== "driver") return { kind: "forbidden" }

    let outcome: Exclude<AcceptRideResult["kind"], "forbidden">
    try {
      // Keep the transaction open from the locking read through all writes.
      // Passing Kysely transactions explicitly is a documented architecture exception.
      outcome = await this.database
        .transaction()
        .execute(async (transaction) => {
          const ride = await this.ridesRepository.findForAcceptance(
            input.rideId,
            transaction
          )
          if (!ride) return "notFound"

          const now = this.clock.now()
          const readiness = ride.prepareAcceptance(now)
          if (readiness === "alreadyAssigned") return readiness
          if (readiness === "timedOut") {
            await this.ridesRepository.saveTimeout(ride, transaction)
            return readiness // Commit the timeout rather than throwing it away.
          }

          const facts = await this.eligibilityQuery.getFacts(
            ride.id,
            input.actor.id,
            transaction
          )
          const eligibility = this.rideAcceptancePolicy.evaluate(
            ride.requirements,
            facts
          )
          const acceptance = ride.accept(input.actor.id, eligibility, now)
          if (acceptance !== "accepted") return acceptance
          if (!(await this.ridesRepository.saveAcceptance(ride, transaction)))
            return "notEligible"

          const notificationContext =
            await this.rideQueries.getNotificationContext(ride.id, transaction)
          if (notificationContext) {
            await this.notificationsRepository.addForStaff(
              driverAssignedNotification(ride.id, notificationContext),
              transaction
            )
          }
          return "accepted"
        })
    } catch (error) {
      if (error instanceof RideAssignmentConflict)
        return { kind: "alreadyAssigned" }
      throw error
    }

    if (outcome !== "accepted") return { kind: outcome }
    // Deliberately preserve the original post-commit lookup, including null.
    return {
      kind: "accepted",
      ride: await this.rideQueries.getDetails(input.rideId),
    }
  }
}
