import type { Generated } from "kysely"

export interface VehiclesTable {
  id: Generated<string>
  driver_id: string
  make: string
  model: string
  plate_number: string
  seats: number
  wheelchair_accessible: Generated<boolean>
}
