import type { DatabaseTransaction } from "./database.js"

/** A staff-only notification command cannot accidentally name two recipients. */
export interface StaffNotification {
  staffId: string
  rideId: string
  title: string
  message: string
  actionUrl: string
  metadata: { passengerCount: number; tripLeg: "outbound" | "return" | null }
}

export interface INotificationsRepository {
  addForStaff(
    notification: StaffNotification,
    transaction: DatabaseTransaction
  ): Promise<void>
}
