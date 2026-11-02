import type { Kysely, Transaction } from "kysely"

import type { DatabaseSchema } from "../../infrastructure/persistence/databaseClient.js"

/** Deliberate clean-architecture exception: application coordination and its
 * persistence ports forward real Kysely transactions. See the rationale in
 * docs/ride-acceptance-architecture.md. Database rows and SQL stay in infrastructure.
 */
export type DatabaseTransaction = Transaction<DatabaseSchema>

/** The use case needs transaction coordination, not access to query builders. */
export type TransactionalDatabase = Pick<Kysely<DatabaseSchema>, "transaction">
