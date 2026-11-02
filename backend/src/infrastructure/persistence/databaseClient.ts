import { Kysely, PostgresDialect } from "kysely"
import { Pool } from "pg"

import type { AddressesTable } from "./schemas/addressesTable.js"
import type { ClientsTable } from "./schemas/clientsTable.js"
import type { DispatchesTable } from "./schemas/dispatchesTable.js"
import type { DriverAvailabilitiesTable } from "./schemas/driverAvailabilitiesTable.js"
import type { DriversTable } from "./schemas/driversTable.js"
import type { DriverVerificationsTable } from "./schemas/driverVerificationsTable.js"
import type { NotificationsTable } from "./schemas/notificationsTable.js"
import type { RideRequestsTable } from "./schemas/rideRequestsTable.js"
import type { VehiclesTable } from "./schemas/vehiclesTable.js"

import { pool } from "../../db/db.js"

export interface DatabaseSchema {
  ride_requests: RideRequestsTable
  dispatches: DispatchesTable
  driver_verifications: DriverVerificationsTable
  driver_availabilities: DriverAvailabilitiesTable
  vehicles: VehiclesTable
  clients: ClientsTable
  addresses: AddressesTable
  drivers: DriversTable
  notifications: NotificationsTable
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

// Both versions share connection settings (including Cloud SQL / DATABASE_URL)
// and the existing pool lifecycle. index.ts closes this pool at shutdown.
export const databaseClient: DatabaseClient = new Kysely<DatabaseSchema>({
  dialect: new PostgresDialect({ pool }),
})
