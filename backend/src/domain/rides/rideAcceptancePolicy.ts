import type { PassengerCount } from "./passengerCount.js"

/** Facts for one driver and ride, read together at the acceptance decision.
 * Calendar and geographic comparisons are calculated by the facts provider.
 */
export interface DriverEligibilityFacts {
  verifications: readonly {
    status: string
    daysUntilExpiry: number | null
  }[]
  vehicles: readonly {
    seats: number
    wheelchairAccessible: boolean
  }[]
  availabilities: readonly {
    active: boolean
    pickupTimeInWindow: boolean
    pickupDateInRange: boolean
    recurrenceMatches: boolean
    pickupWithinRadius: boolean
  }[]
}

export interface RideRequirements {
  readonly passengerCount: PassengerCount
  readonly accessibilityNeeds: readonly string[]
}

export type EligibilityDecision = "eligible" | "notEligible"

export class RideAcceptancePolicy {
  evaluate(
    requirements: RideRequirements,
    facts: DriverEligibilityFacts
  ): EligibilityDecision {
    const approved = facts.verifications.some(
      (verification) =>
        verification.status === "approved" &&
        (verification.daysUntilExpiry === null ||
          verification.daysUntilExpiry >= 0)
    )
    const requiresWheelchair = requirements.accessibilityNeeds.some((need) =>
      need.toLowerCase().includes("wheelchair")
    )
    const suitableVehicle = facts.vehicles.some(
      (vehicle) =>
        vehicle.seats >= requirements.passengerCount.value &&
        (!requiresWheelchair || vehicle.wheelchairAccessible)
    )
    const available = facts.availabilities.some(
      (availability) =>
        availability.active &&
        availability.pickupTimeInWindow &&
        availability.pickupDateInRange &&
        availability.recurrenceMatches &&
        availability.pickupWithinRadius
    )
    return approved && suitableVehicle && available ? "eligible" : "notEligible"
  }
}
