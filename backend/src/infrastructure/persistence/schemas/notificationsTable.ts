import type { Generated } from "kysely"

import type { GeneratedTimestamp } from "./columns.js"

export interface NotificationsTable {
  id: Generated<string>
  driver_id: string | null
  staff_id: string | null
  ride_request_id: string | null
  title: string
  message: string
  action_url: string | null
  channel: Generated<"push" | "sms" | "email" | "in_app">
  metadata: Generated<Record<string, unknown>>
  is_read: Generated<boolean>
  created_at: GeneratedTimestamp
}
