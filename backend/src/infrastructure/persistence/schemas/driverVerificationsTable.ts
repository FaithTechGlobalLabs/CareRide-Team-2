import type { Generated } from "kysely"

import type { CalendarDate, Timestamp } from "./columns.js"

export interface DriverVerificationsTable {
  id: Generated<string>
  driver_id: string
  approved_by_org_id: string
  approved_by_staff_id: string | null
  document_type: string
  document: Buffer
  document_filename: string | null
  expires_on: CalendarDate | null
  status: "pending" | "approved" | "rejected" | "expired"
  reviewed_at: Timestamp | null
  reject_reason: string | null
}
