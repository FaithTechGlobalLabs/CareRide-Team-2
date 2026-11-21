import { waitUntil } from "@vercel/functions";

/** HTTP/hosting integration only: the use case owns matching, notice creation and delivery. */
export function createBookingNotificationHandler(
  notifications: { notify(rideIds: readonly string[]): Promise<unknown> },
  retain: (task: Promise<unknown>) => void = waitUntil
): (rideIds: readonly string[]) => void {
  return (rideIds) => {
    const ids = [...rideIds];
    // Start after this stack so even synchronous use-case failure stays off the HTTP path.
    const task = Promise.resolve()
      .then(() => notifications.notify(ids))
      .then((result) => {
        console.info("Booking notifications processed", result);
      })
      .catch((error: unknown) => {
        console.error("Booking notifications failed", {
          name: error instanceof Error ? error.name : "Error",
        });
      });
    try {
      retain(task);
    } catch (error) {
      console.error("Booking notification retention failed", {
        name: error instanceof Error ? error.name : "Error",
      });
    }
  };
}
