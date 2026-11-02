import type { Generated } from "kysely"

export interface AddressesTable {
  id: Generated<string>
  organization_id: string
  name: string
  address: string
  latitude: number
  longitude: number
  location_type: Generated<"hospital" | "shelter" | "service">
  is_active: Generated<boolean>
}
