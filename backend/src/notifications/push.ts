import webpush from "web-push";
import { pool } from "../db/db.js";
import { ensureNotificationSchema } from "./sqlStore.js";

export function pushConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  return {
    configured: !!(publicKey && privateKey && subject),
    public_key: publicKey ?? null,
  };
}

let pending: Promise<void> | null = null;
export function flushPush(): Promise<void> {
  if (pending) return pending;
  pending = deliver().finally(() => {
    pending = null;
  });
  return pending;
}

async function deliver(): Promise<void> {
  if (!pushConfig().configured) return;
  await ensureNotificationSchema();
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  await pool.query(`INSERT INTO push_deliveries (notification_id, endpoint)
    SELECT n.id, s.endpoint FROM notifications n
    JOIN push_subscriptions s ON (s.kind = 'staff' AND n.staff_id = s.user_id) OR (s.kind = 'driver' AND n.driver_id = s.user_id)
    JOIN notification_preferences p ON p.user_id = s.user_id AND p.kind = s.kind
    WHERE p.push_enabled AND NOT n.is_read AND n.created_at >= s.created_at
      AND (CASE WHEN s.kind = 'driver' THEN p.available_rides_enabled ELSE p.updates_enabled END)
    ON CONFLICT DO NOTHING`);
  // Lease a batch atomically so multiple Cloud Run workers don't send the same batch.
  const leased = await pool.query(`UPDATE push_deliveries d
    SET next_attempt_at = now() + interval '2 minutes'
    FROM (SELECT notification_id, endpoint FROM push_deliveries
      WHERE NOT failed AND delivered_at IS NULL AND next_attempt_at <= now()
      ORDER BY next_attempt_at FOR UPDATE SKIP LOCKED LIMIT 40) due
    WHERE d.notification_id = due.notification_id AND d.endpoint = due.endpoint
    RETURNING d.notification_id, d.endpoint`);
  for (let offset = 0; offset < leased.rows.length; offset += 8) {
    await Promise.all(
      leased.rows.slice(offset, offset + 8).map(async (delivery) => {
        const result = await pool.query(
          `SELECT s.endpoint, s.p256dh, s.auth, s.kind, n.id, n.is_read,
          p.push_enabled, p.updates_enabled, p.available_rides_enabled
        FROM notifications n JOIN push_subscriptions s ON s.endpoint = $2
        JOIN notification_preferences p ON p.user_id = s.user_id AND p.kind = s.kind
        WHERE n.id = $1 AND ((s.kind = 'staff' AND n.staff_id = s.user_id) OR (s.kind = 'driver' AND n.driver_id = s.user_id))`,
          [delivery.notification_id, delivery.endpoint],
        );
        const row = result.rows[0];
        let success = false;
        let gone = false;
        let terminal =
          !row ||
          row.is_read ||
          !row.push_enabled ||
          !(row.kind === "driver"
            ? row.available_rides_enabled
            : row.updates_enabled);
        if (!terminal) {
          try {
            await webpush.sendNotification(
              {
                endpoint: row.endpoint,
                keys: { p256dh: row.p256dh, auth: row.auth },
              },
              JSON.stringify({
                title: "CareRide",
                body:
                  row.kind === "driver"
                    ? "A ride fits your availability. Open CareRide for details."
                    : "There is an update for your organization. Open CareRide for details.",
                url: "/notifications",
                tag: row.id,
              }),
              { TTL: 3600, timeout: 5000 },
            );
            success = true;
          } catch (error) {
            const code = (error as { statusCode?: number }).statusCode;
            gone = code === 404 || code === 410;
            terminal =
              gone ||
              (code !== undefined && code >= 400 && code < 500 && code !== 429);
          }
        }
        if (gone) {
          await pool.query(
            `DELETE FROM push_subscriptions WHERE endpoint = $1`,
            [delivery.endpoint],
          );
        } else {
          await pool.query(
            `UPDATE push_deliveries SET attempts = attempts + 1,
          delivered_at = CASE WHEN $3 THEN now() ELSE delivered_at END,
          failed = $4 OR (NOT $3 AND attempts >= 4),
          next_attempt_at = now() + LEAST(interval '1 hour', interval '30 seconds' * power(2, attempts + 1))
          WHERE notification_id = $1 AND endpoint = $2`,
            [delivery.notification_id, delivery.endpoint, success, terminal],
          );
        }
      }),
    );
  }
}
