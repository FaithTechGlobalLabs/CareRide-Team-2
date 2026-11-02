import type { StartedPostgreSqlContainer } from "@testcontainers/postgresql"
import type { TestProject } from "vitest/node"

import { PostgreSqlContainer } from "@testcontainers/postgresql"
import { FileMigrationProvider, Migrator } from "kysely/migration"
import { randomBytes } from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"

import {
  createDatabaseClient,
  type DatabaseConnectionConfig,
} from "../../src/infrastructure/persistence/databaseClient.js"
import { TEST_DATABASE_CONFIG, TEST_DATABASE_NAME } from "./databaseContext.js"

// The real migrations require PostGIS. This image is published for amd64 only.
const POSTGRES_IMAGE = "postgis/postgis:18-3.6"
const MIGRATION_FOLDER = path.resolve(
  import.meta.dirname,
  "../../src/infrastructure/persistence/migrations"
)

let container: StartedPostgreSqlContainer | undefined

export async function setup(project: TestProject): Promise<void> {
  const password = randomBytes(24).toString("base64url")
  container = await new PostgreSqlContainer(POSTGRES_IMAGE)
    .withPlatform("linux/amd64")
    .withDatabase(TEST_DATABASE_NAME)
    .withUsername("careride_test")
    .withPassword(password)
    .withStartupTimeout(120_000)
    .start()

  const databaseConfig: DatabaseConnectionConfig = {
    database: container.getDatabase(),
    host: container.getHost(),
    port: container.getPort(),
    user: container.getUsername(),
    password: container.getPassword(),
    maxConnections: 10,
  }
  try {
    const databaseClient = createDatabaseClient(databaseConfig)
    try {
      const migrator = new Migrator({
        db: databaseClient,
        provider: new FileMigrationProvider({
          fs,
          path,
          migrationFolder: MIGRATION_FOLDER,
        }),
      })
      const { error } = await migrator.migrateToLatest()

      if (error) {
        throw error
      }

      project.provide(TEST_DATABASE_CONFIG, databaseConfig)
    } finally {
      await databaseClient.destroy()
    }
  } catch (error) {
    await container.stop()
    container = undefined
    throw error
  }
}

export async function teardown(): Promise<void> {
  await container?.stop()
  container = undefined
}
