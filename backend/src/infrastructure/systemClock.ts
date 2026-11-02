import type { IClock } from "../application/ports/clock.js"

export class SystemClock implements IClock {
  now(): Date {
    return new Date()
  }
}
