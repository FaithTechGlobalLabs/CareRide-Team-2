import type { IOpenRideNoticesRepository } from "../../ports/openRideNotices.js";
import type { PushDeliveryService } from "./pushDeliveryService.js";

export class BookingNotificationService {
  constructor(
    private readonly openRideNoticesRepository: IOpenRideNoticesRepository,
    private readonly pushDeliveryService: Pick<PushDeliveryService, "deliver">
  ) {}

  async notify(rideIds: readonly string[]) {
    const notificationIds =
      await this.openRideNoticesRepository.createForBooking(rideIds);
    const delivery = await this.pushDeliveryService.deliver({
      kind: "notifications",
      notificationIds,
    });
    return { noticesCreated: notificationIds.length, ...delivery };
  }
}
