import webpush from "web-push";

import type {
  IPushTransport,
  PushMessage,
  PushOutcome,
  PushSubscription,
} from "../../application/ports/pushDeliveries.js";

export function pushConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  return {
    configured: !!(
      publicKey &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT
    ),
    public_key: publicKey ?? null,
  };
}

export class WebPushTransport implements IPushTransport {
  get configured(): boolean {
    return pushConfig().configured;
  }

  async send(
    subscription: PushSubscription,
    message: PushMessage
  ): Promise<PushOutcome> {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT!,
      process.env.VAPID_PUBLIC_KEY!,
      process.env.VAPID_PRIVATE_KEY!
    );
    try {
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(message),
        { TTL: 3600, timeout: 5000 }
      );
      return { kind: "sent" };
    } catch (error) {
      const status =
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error &&
        typeof error.statusCode === "number"
          ? error.statusCode
          : undefined;
      if (status === 404 || status === 410) return { kind: "gone", status };
      return {
        kind:
          status !== undefined &&
          status >= 400 &&
          status < 500 &&
          status !== 429
            ? "rejected"
            : "transient",
        ...(status === undefined ? {} : { status }),
      };
    }
  }
}
