export type PushDeliveryScope =
  | { kind: "global" }
  | { kind: "notifications"; notificationIds: readonly string[] };

export interface PushDelivery {
  notificationId: string;
  endpoint: string;
}

export interface PushSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushTarget {
  kind: "staff" | "driver";
  type: string | null;
  subscription: PushSubscription;
}

export type PushOutcome =
  | { kind: "sent" }
  | { kind: "skipped" }
  | { kind: "gone"; status: number }
  | { kind: "rejected" | "transient"; status?: number };

export interface IPushDeliveriesRepository {
  /** Create missing delivery records, then snapshot due deliveries for one pass. */
  enqueueAndListDueDeliveries(
    scope: PushDeliveryScope
  ): Promise<PushDelivery[]>;
  /** Claim still-due deliveries for two minutes; return only those claimed. */
  claimDueDeliveries(
    deliveries: readonly PushDelivery[]
  ): Promise<PushDelivery[]>;
  getTarget(delivery: PushDelivery): Promise<PushTarget | null>;
  record(delivery: PushDelivery, outcome: PushOutcome): Promise<void>;
}

export interface PushMessage {
  title: string;
  body: string;
  url: "/driver" | "/notifications";
  tag: string;
}

export interface IPushTransport {
  readonly configured: boolean;
  send(
    subscription: PushSubscription,
    message: PushMessage
  ): Promise<PushOutcome>;
}
