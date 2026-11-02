import type { Generated } from "kysely"

import type { CalendarDate, GeneratedTimestamp } from "./columns.js"

export interface ClientsTable {
  id: Generated<string>
  organization_id: string
  first_name: string
  last_name: string
  dob: CalendarDate
  address: string | null
  has_smartphone: Generated<boolean>
  phone: string | null
  email: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  notes: string | null
  created_at: GeneratedTimestamp
}
