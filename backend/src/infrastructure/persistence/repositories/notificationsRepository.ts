import type { DatabaseTransaction } from "../../../application/ports/database.js"
import type {
  INotificationsRepository,
  StaffNotification,
} from "../../../application/ports/notificationsRepository.js"

import { RideAssignmentConflict } from "../../../application/ports/rideRequestsRepository.js"

export class NotificationsRepository implements INotificationsRepository {
  async addForStaff(
    notification: StaffNotification,
    transaction: DatabaseTransaction
  ): Promise<void> {
    try {
      await transaction
        .insertInto("notifications")
        .values({
          driver_id: null,
          staff_id: notification.staffId,
          ride_request_id: notification.rideId,
          title: notification.title,
          message: notification.message,
          action_url: notification.actionUrl,
          channel: "in_app",
          metadata: {
            passenger_count: notification.metadata.passengerCount,
            trip_leg: notification.metadata.tripLeg,
          },
        })
        .execute()
    } catch (error) {
      // Preserve the old transaction adapter's unique-violation outcome.
      if (error instanceof Error && "code" in error && error.code === "23505") {
        throw new RideAssignmentConflict("Already assigned", { cause: error })
      }
      throw error
    }
  }
}
