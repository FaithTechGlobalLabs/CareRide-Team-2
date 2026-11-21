import { pool } from "../db/db.js";
import { ensureNotificationSchema } from "../infrastructure/persistence/notificationSchema.js";
export { ensureNotificationSchema };

export async function sqlPreference(userId: string, kind: "staff" | "driver") {
  await ensureNotificationSchema();
  await pool.query(
    `INSERT INTO notification_preferences (user_id, kind) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, kind]
  );
  const result = await pool.query(
    `SELECT * FROM notification_preferences WHERE user_id = $1 AND kind = $2`,
    [userId, kind]
  );
  const p = result.rows[0];
  if (!p) throw new Error("Notification preferences unavailable");
  return p;
}
