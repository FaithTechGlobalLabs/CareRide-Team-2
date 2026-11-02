/** A booking's positive, whole number of passengers. */
export class PassengerCount {
  private constructor(readonly value: number) {}

  static of(value: number): PassengerCount {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error("Passenger count must be a positive integer.")
    }
    return Object.freeze(new PassengerCount(value))
  }
}
