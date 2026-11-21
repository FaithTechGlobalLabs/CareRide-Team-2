import { sql } from "kysely";
import fs from "node:fs/promises";

import type { DatabaseClient } from "./databaseClient.js";

import { pool } from "../../db/db.js";

const ready = new WeakMap<object, Promise<void>>();

export function ensureNotificationSchema(
  database?: DatabaseClient
): Promise<void> {
  const key = database ?? pool;
  const existing = ready.get(key);
  if (existing) return existing;
  const pending = (async () => {
    const script = await fs.readFile(
      new URL("../../../db/002_notifications.sql", import.meta.url),
      "utf8"
    );
    if (database) await sql.raw(script).execute(database);
    else await pool.query(script);
  })().catch((error) => {
    ready.delete(key);
    throw error;
  });
  ready.set(key, pending);
  return pending;
}
