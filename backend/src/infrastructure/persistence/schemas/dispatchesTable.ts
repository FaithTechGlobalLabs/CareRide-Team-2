import type { Generated } from "kysely"

import type { GeneratedTimestamp, Timestamp } from "./columns.js"

export interface DispatchesTable {
  id: Generated<string>
  ride_request_id: string
  driver_id: string
  offered_at: GeneratedTimestamp
  response: "accepted" | "declined" | "expired" | null
  responded_at: Timestamp | null
}
