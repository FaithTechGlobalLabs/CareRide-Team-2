import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { Kysely, PostgresDialect } from "kysely";
import { FileMigrationProvider, Migrator } from "kysely/migration";
import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Pool } from "pg";

import type {
  DatabaseClient,
  DatabaseSchema,
} from "../src/infrastructure/persistence/databaseClient.js";

import {
  TEST_DATABASE_NAME,
  POSTGRES_IMAGE,
} from "./postgresTestDatabaseConfig.js";

const MIGRATION_FOLDER = path.resolve(
  import.meta.dirname,
  "../src/infrastructure/persistence/migrations"
);

export interface PostgresTestDatabase {
  database: DatabaseClient;
  pool: Pool;
  stop(): Promise<void>;
}

/** Each suite owns a fresh real PostgreSQL/PostGIS container, never an ambient database. */
export async function startPostgresTestDatabase(): Promise<PostgresTestDatabase> {
  const password = randomBytes(24).toString("base64url");
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withPlatform("linux/amd64")
    .withDatabase(TEST_DATABASE_NAME)
    .withUsername("careride_test")
    .withPassword(password)
    .withStartupTimeout(120_000)
    .start();

  // The URI includes the random mapped port and the container's own credentials.
  const pool = new Pool({
    connectionString: container.getConnectionUri(),
    max: 10,
  });
  const database = new Kysely<DatabaseSchema>({
    dialect: new PostgresDialect({ pool }),
  });
  const stop = async () => {
    try {
      await database.destroy();
    } finally {
      await container.stop();
    }
  };
  try {
    await migratePostgresTestDatabase(database);
    return { database, pool, stop };
  } catch (error) {
    await stop();
    throw error;
  }
}

export async function migratePostgresTestDatabase(
  database: DatabaseClient
): Promise<void> {
  const migrator = new Migrator({
    db: database,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder: MIGRATION_FOLDER,
    }),
  });
  const { error } = await migrator.migrateToLatest();
  if (error) throw error;
}
