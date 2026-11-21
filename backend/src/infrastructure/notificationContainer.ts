import type { IPushTransport } from "../application/ports/pushDeliveries.js";
import type { DatabaseClient } from "./persistence/databaseClient.js";

import { BookingNotificationService } from "../application/services/notifications/bookingNotificationService.js";
import { PushDeliveryService } from "../application/services/notifications/pushDeliveryService.js";
import { databaseClient } from "./persistence/databaseClient.js";
import { OpenRideNoticesRepository } from "./persistence/repositories/openRideNotices.js";
import { PushDeliveriesRepository } from "./persistence/repositories/pushDeliveries.js";
import { WebPushTransport } from "./push/webPushTransport.js";

export class NotificationContainer {
  readonly bookingNotificationsService: BookingNotificationService;
  readonly pushDeliveryService: PushDeliveryService;
  private pending: Promise<unknown> | null = null;

  constructor(
    database: DatabaseClient = databaseClient,
    transport: IPushTransport = new WebPushTransport()
  ) {
    this.pushDeliveryService = new PushDeliveryService(
      new PushDeliveriesRepository(database),
      transport
    );
    this.bookingNotificationsService = new BookingNotificationService(
      new OpenRideNoticesRepository(database),
      this.pushDeliveryService
    );
  }

  dispatch = (): Promise<unknown> => {
    this.pending ??= this.pushDeliveryService
      .deliver({ kind: "global" })
      .finally(() => {
        this.pending = null;
      });
    return this.pending;
  };
}

export const notificationContainer = new NotificationContainer();
