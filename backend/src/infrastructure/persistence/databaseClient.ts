import { Kysely, PostgresDialect } from "kysely"
import { Pool } from "pg"

import type { RideRequestsTable } from "./schemas/rideRequestsTable.js"

export interface DatabaseSchema {
  ride_requests: RideRequestsTable
}

export type DatabaseClient = Kysely<DatabaseSchema>

export interface DatabaseConnectionConfig {
  database: string
  host: string
  port: number
  user: string
  password: string
  maxConnections?: number
}

export function createDatabaseClient(
  config: DatabaseConnectionConfig
): DatabaseClient {
  return new Kysely<DatabaseSchema>({
    dialect: new PostgresDialect({
      pool: new Pool({
        database: config.database,
        host: config.host,
        port: config.port,
        user: config.user,
        password: config.password,
        max: config.maxConnections ?? 10,
      }),
    }),
  })
}

function loadDatabaseConfigFromEnv(): DatabaseConnectionConfig {
  return {
    database: process.env.POSTGRES_DB || process.env.DB_NAME || "postgres",
    host: process.env.POSTGRES_HOST || process.env.DB_HOST || "localhost",
    port: Number(process.env.POSTGRES_PORT || process.env.DB_PORT || 5432),
    user: process.env.POSTGRES_USER || process.env.DB_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || process.env.DB_PASS || "",
    maxConnections: Number(process.env.DB_POOL_MAX) || 10,
  }
}

export const databaseClient = createDatabaseClient(loadDatabaseConfigFromEnv())
