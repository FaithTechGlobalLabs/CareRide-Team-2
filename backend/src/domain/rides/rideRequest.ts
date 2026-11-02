import type {
  EligibilityDecision,
  RideRequirements,
} from "./rideAcceptancePolicy.js"

import { PassengerCount } from "./passengerCount.js"

export type RideStatus =
  | "requested"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show"
  | "timed_out"

/** The accepted assignment child. Its driver and timestamp change together. */
export class AcceptedDispatch {
  private readonly acceptedAtMilliseconds: number | null

  constructor(
    readonly driverId: string,
    acceptedAt: Date | null
  ) {
    if (
      !driverId ||
      (acceptedAt !== null && !Number.isFinite(acceptedAt.getTime()))
    ) {
      throw new Error(
        "An accepted dispatch requires a driver and a valid time."
      )
    }
    this.acceptedAtMilliseconds = acceptedAt?.getTime() ?? null
    Object.freeze(this)
  }

  get acceptedAt(): Date | null {
    return this.acceptedAtMilliseconds === null
      ? null
      : new Date(this.acceptedAtMilliseconds)
  }
}

export interface RideRequestState {
  id: string
  status: RideStatus
  driverId: string | null
  requestedPickupAt: Date
  passengerCount: number
  accessibilityNeeds: readonly string[]
  acceptedDispatch: AcceptedDispatch | null
}

export type AcceptanceReadiness = "ready" | "alreadyAssigned" | "timedOut"
export type AcceptanceOutcome =
  | "accepted"
  | "alreadyAssigned"
  | "timedOut"
  | "notEligible"

/** Owns ride state, state transitions, assignment invariants and its active dispatch; historical dispatches are not needed
 * to decide this command. Persistence must also protect this state under concurrency.
 */
export class RideRequest {
  readonly id: string
  readonly requirements: RideRequirements
  private readonly pickupMilliseconds: number
  private currentStatus: RideStatus
  private assignedDriverId: string | null
  private currentDispatch: AcceptedDispatch | null

  constructor(state: RideRequestState) {
    if (!Number.isFinite(state.requestedPickupAt.getTime())) {
      throw new Error("A ride requires a valid pickup time.")
    }
    this.id = state.id
    this.currentStatus = state.status
    this.assignedDriverId = state.driverId
    this.pickupMilliseconds = state.requestedPickupAt.getTime()
    this.currentDispatch = state.acceptedDispatch
    this.requirements = Object.freeze({
      passengerCount: PassengerCount.of(state.passengerCount),
      accessibilityNeeds: Object.freeze([...state.accessibilityNeeds]),
    })
  }

  get status(): RideStatus {
    return this.currentStatus
  }

  get driverId(): string | null {
    return this.assignedDriverId
  }

  get acceptedDispatch(): AcceptedDispatch | null {
    return this.currentDispatch
  }

  prepareAcceptance(now: Date): AcceptanceReadiness {
    if (
      this.currentStatus !== "requested" ||
      this.assignedDriverId !== null ||
      this.currentDispatch !== null
    ) {
      return "alreadyAssigned"
    }
    if (this.pickupMilliseconds <= now.getTime()) {
      this.currentStatus = "timed_out"
      return "timedOut"
    }
    return "ready"
  }

  accept(
    driverId: string,
    eligibility: EligibilityDecision,
    now: Date
  ): AcceptanceOutcome {
    const readiness = this.prepareAcceptance(now)
    if (readiness !== "ready") return readiness
    if (eligibility !== "eligible") return "notEligible"

    const dispatch = new AcceptedDispatch(driverId, now)
    this.currentDispatch = dispatch
    this.assignedDriverId = dispatch.driverId
    this.currentStatus = "accepted"
    return "accepted"
  }
}
