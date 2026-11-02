import type { Generated } from "kysely"

import type { CalendarDate } from "./columns.js"

export interface DriversTable {
  id: Generated<string>
  first_name: string
  last_name: string
  dob: CalendarDate
  email: string
  phone: string
  password_hash: string
}
