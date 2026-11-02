import type { StaffNotification } from "../../ports/notificationsRepository.js"
import type { RideNotificationContext } from "../../ports/rideQueries.js"

export function driverAssignedNotification(
  rideId: string,
  context: RideNotificationContext
): StaffNotification {
  const when = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Vancouver",
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(context.pickupAt)
  const people =
    context.passengerCount === 1
      ? "1 passenger"
      : `${context.passengerCount} passengers`
  const leg = context.tripLeg === "return" ? "Return leg" : "One way"
  return {
    staffId: context.requestedByStaffId,
    rideId,
    title: "Driver assigned",
    message: `${context.clientFirstName}: ${when}: ${context.pickupName} to ${context.destinationName}. ${leg}, ${people}.`,
    actionUrl: `/rides/${rideId}`,
    metadata: {
      passengerCount: context.passengerCount,
      tripLeg: context.tripLeg,
    },
  }
}
