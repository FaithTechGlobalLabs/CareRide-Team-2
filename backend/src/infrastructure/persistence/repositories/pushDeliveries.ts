import { sql } from "kysely";

import type {
  IPushDeliveriesRepository,
  PushDelivery,
  PushDeliveryScope,
  PushOutcome,
  PushTarget,
} from "../../../application/ports/pushDeliveries.js";
import type { DatabaseClient } from "../databaseClient.js";

import { ensureNotificationSchema } from "../notificationSchema.js";

export class PushDeliveriesRepository implements IPushDeliveriesRepository {
  constructor(private readonly databaseClient: DatabaseClient) {}

  async enqueueAndListDueDeliveries(
    scope: PushDeliveryScope
  ): Promise<PushDelivery[]> {
    await ensureNotificationSchema(this.databaseClient);
    const noticeFilter =
      scope.kind === "global"
        ? sql``
        : sql`AND n.id = ANY(${[...scope.notificationIds]}::uuid[])`;
    await sql`
      INSERT INTO push_deliveries (notification_id, endpoint)
      SELECT n.id, s.endpoint FROM notifications n
      JOIN push_subscriptions s ON (s.kind = 'staff' AND n.staff_id = s.user_id) OR (s.kind = 'driver' AND n.driver_id = s.user_id)
      JOIN notification_preferences p ON p.user_id = s.user_id AND p.kind = s.kind
      WHERE p.push_enabled AND NOT n.is_read AND n.created_at >= s.created_at
        AND (CASE WHEN s.kind = 'driver' THEN p.available_rides_enabled ELSE p.updates_enabled END)
        ${noticeFilter}
      ON CONFLICT DO NOTHING
    `.execute(this.databaseClient);
    const deliveryFilter =
      scope.kind === "global"
        ? sql``
        : sql`AND notification_id = ANY(${[...scope.notificationIds]}::uuid[])`;
    const limit = scope.kind === "global" ? sql`LIMIT 40` : sql``;
    const due = await sql<{ notification_id: string; endpoint: string }>`
      SELECT notification_id, endpoint FROM push_deliveries
      WHERE NOT failed AND delivered_at IS NULL AND next_attempt_at <= now()
        ${deliveryFilter}
      ORDER BY next_attempt_at, notification_id, endpoint ${limit}
    `.execute(this.databaseClient);
    return due.rows.map((row) => ({
      notificationId: row.notification_id,
      endpoint: row.endpoint,
    }));
  }

  async claimDueDeliveries(
    deliveries: readonly PushDelivery[]
  ): Promise<PushDelivery[]> {
    if (!deliveries.length) return [];
    const keys = JSON.stringify(
      deliveries.map((delivery) => ({
        notification_id: delivery.notificationId,
        endpoint: delivery.endpoint,
      }))
    );
    const leased = await sql<{ notification_id: string; endpoint: string }>`
      UPDATE push_deliveries target SET next_attempt_at = now() + interval '2 minutes'
      FROM (
        SELECT d.notification_id, d.endpoint FROM push_deliveries d
        JOIN jsonb_to_recordset(${keys}::jsonb) AS selected(notification_id uuid, endpoint text)
          ON selected.notification_id = d.notification_id AND selected.endpoint = d.endpoint
        WHERE NOT d.failed AND d.delivered_at IS NULL AND d.next_attempt_at <= now()
        ORDER BY d.notification_id, d.endpoint FOR UPDATE OF d SKIP LOCKED
      ) due
      WHERE target.notification_id = due.notification_id AND target.endpoint = due.endpoint
      RETURNING target.notification_id, target.endpoint
    `.execute(this.databaseClient);
    return leased.rows.map((row) => ({
      notificationId: row.notification_id,
      endpoint: row.endpoint,
    }));
  }

  async getTarget(delivery: PushDelivery): Promise<PushTarget | null> {
    const result = await sql<{
      endpoint: string;
      p256dh: string;
      auth: string;
      kind: "staff" | "driver";
      type: string | null;
    }>`
      SELECT s.endpoint, s.p256dh, s.auth, s.kind, n.metadata->>'type' AS type
      FROM notifications n JOIN push_subscriptions s ON s.endpoint = ${delivery.endpoint}
      JOIN notification_preferences p ON p.user_id = s.user_id AND p.kind = s.kind
      WHERE n.id = ${delivery.notificationId} AND NOT n.is_read AND p.push_enabled
        AND n.created_at >= s.created_at
        AND (CASE WHEN s.kind = 'driver' THEN p.available_rides_enabled ELSE p.updates_enabled END)
        AND ((s.kind = 'staff' AND n.staff_id = s.user_id) OR (s.kind = 'driver' AND n.driver_id = s.user_id))
    `.execute(this.databaseClient);
    const row = result.rows[0];
    return row
      ? {
          kind: row.kind,
          type: row.type,
          subscription: {
            endpoint: row.endpoint,
            p256dh: row.p256dh,
            auth: row.auth,
          },
        }
      : null;
  }

  async record(delivery: PushDelivery, outcome: PushOutcome): Promise<void> {
    if (outcome.kind === "gone") {
      await sql`DELETE FROM push_subscriptions WHERE endpoint = ${delivery.endpoint}`.execute(
        this.databaseClient
      );
      return;
    }
    const success = outcome.kind === "sent";
    const terminal = outcome.kind === "skipped" || outcome.kind === "rejected";
    await sql`
      UPDATE push_deliveries SET attempts = attempts + 1,
        delivered_at = CASE WHEN ${success} THEN now() ELSE delivered_at END,
        failed = ${terminal} OR (NOT ${success} AND attempts >= 4),
        next_attempt_at = now() + LEAST(interval '1 hour', interval '30 seconds' * power(2, attempts + 1))
      WHERE notification_id = ${delivery.notificationId} AND endpoint = ${delivery.endpoint}
    `.execute(this.databaseClient);
  }
}
