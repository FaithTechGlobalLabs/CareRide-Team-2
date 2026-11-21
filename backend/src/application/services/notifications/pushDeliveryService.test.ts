import { describe, expect, test } from "vitest";

import { PushDeliveryService } from "./pushDeliveryService.js";

describe("PushDeliveryService", () => {
  test("sends only devices successfully claimed for the current batch", async () => {
    const messages: string[] = [];
    const service = new PushDeliveryService(
      {
        enqueueAndListDueDeliveries: async () => [
          { notificationId: "notice", endpoint: "already-claimed" },
          { notificationId: "notice", endpoint: "available" },
        ],
        claimDueDeliveries: async (deliveries) =>
          deliveries.filter((delivery) => delivery.endpoint === "available"),
        getTarget: async (delivery) => ({
          kind: "staff" as const,
          type: null,
          subscription: {
            endpoint: delivery.endpoint,
            p256dh: "key",
            auth: "auth",
          },
        }),
        record: async () => {},
      },
      {
        configured: true,
        send: async (subscription) => {
          messages.push(subscription.endpoint);
          return { kind: "sent" as const };
        },
      }
    );
    await service.deliver({ kind: "global" });
    expect(messages).toEqual(["available"]);
  });

  test("sends a generic driver alert to the open ride requests page", async () => {
    const messages: unknown[] = [];
    const outcomes: unknown[] = [];
    const service = new PushDeliveryService(
      {
        enqueueAndListDueDeliveries: async () => [
          { notificationId: "notice", endpoint: "device" },
        ],
        claimDueDeliveries: async (deliveries) => [...deliveries],
        getTarget: async () => ({
          kind: "driver" as const,
          type: "available_ride",
          subscription: { endpoint: "device", p256dh: "key", auth: "auth" },
        }),
        record: async (_delivery, outcome) => {
          outcomes.push(outcome);
        },
      },
      {
        configured: true,
        send: async (_subscription, message) => {
          messages.push(message);
          return { kind: "sent" as const };
        },
      }
    );

    expect(
      await service.deliver({
        kind: "notifications",
        notificationIds: ["notice"],
      })
    ).toEqual({
      attempted: 1,
      sent: 1,
      skipped: 0,
      failed: 0,
      configured: true,
    });
    expect(messages).toEqual([
      {
        title: "CareRide",
        body: "A ride fits your availability. Tap to view available rides.",
        url: "/driver",
        tag: "notice",
      },
    ]);
    expect(outcomes).toEqual([{ kind: "sent" }]);
  });
});
