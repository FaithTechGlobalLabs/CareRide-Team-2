import type { DatabaseConnectionConfig } from "../../src/infrastructure/persistence/databaseClient.js"

export const TEST_DATABASE_CONFIG = "databaseConfig"
export const TEST_DATABASE_NAME = "careride_test"

declare module "vitest" {
  export interface ProvidedContext {
    databaseConfig: DatabaseConnectionConfig
  }
}
