import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { Pool, type PoolClient } from "pg";
import { databaseConfig } from "./config.js";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(here, "../../../.env"), quiet: true });
dotenv.config({ path: path.resolve(here, "../../.env"), quiet: true });

export const pool = new Pool(databaseConfig(process.env));

pool.on("error", (error: Error & { code?: string }) => {
  // An idle connection can fail during a restart or network interruption.
  // Avoid logging connection strings or credentials.
  console.error("PostgreSQL idle connection failed", { code: error.code ?? "UNKNOWN" });
});

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
