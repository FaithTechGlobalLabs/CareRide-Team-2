import type { Generated } from "kysely"

import type { CalendarDate } from "./columns.js"

export interface DriverAvailabilitiesTable {
  id: Generated<string>
  driver_id: string
  centre: unknown // PostGIS geography; accessed through spatial expressions.
  radius_m: number
  is_active: Generated<boolean>
  kind: "one_time" | "weekly" | "monthly"
  start_time: string
  end_time: string
  timezone: Generated<string>
  on_date: CalendarDate | null
  weekdays: number[] | null
  month_days: number[] | null
  starts_on: CalendarDate | null
  ends_on: CalendarDate | null
  note: string | null
}
