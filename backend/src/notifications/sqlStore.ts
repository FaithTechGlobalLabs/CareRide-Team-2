import fs from "node:fs/promises";
import { pool } from "../db/db.js";

let schemaReady: Promise<void> | undefined;
export function ensureNotificationSchema(): Promise<void> {
  schemaReady ??= (async () => {
    const sql = await fs.readFile(
      new URL("../../db/002_notifications.sql", import.meta.url),
      "utf8",
    );
    await pool.query(sql);
  })().catch((error) => {
    schemaReady = undefined;
    throw error;
  });
  return schemaReady;
}

export async function sqlPreference(userId: string, kind: "staff" | "driver") {
  await ensureNotificationSchema();
  await pool.query(
    `INSERT INTO notification_preferences (user_id, kind) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, kind],
  );
  const result = await pool.query(
    `SELECT * FROM notification_preferences WHERE user_id = $1 AND kind = $2`,
    [userId, kind],
  );
  const p = result.rows[0];
  if (!p) throw new Error("Notification preferences unavailable");
  return p;
}
