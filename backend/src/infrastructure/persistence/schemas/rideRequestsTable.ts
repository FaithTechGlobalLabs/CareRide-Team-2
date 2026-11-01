import type { ColumnType, Generated } from "kysely"

type Timestamp = ColumnType<Date, Date | string, Date | string>

// Mirrors backend/db/001_schema.sql. Timestamp reads use pg's default Date parser.
export interface RideRequestsTable {
  id: Generated<string>
  client_id: string
  requested_by_staff_id: string
  organization_id: string
  pickup_address: string
  pickup_lat: number
  pickup_lng: number
  destination_id: string
  destination_address: string
  destination_lat: number
  destination_lng: number
  requested_pickup_at: Timestamp
  passenger_count: number
  accessibility_needs: Generated<string[]>
  notes: string | null
  status:
    | "requested"
    | "approved"
    | "in_progress"
    | "completed"
    | "cancelled"
    | "no_show"
    | "timed_out"
  driver_id: string | null
  approved_by_user_id: string | null
  approved_at: Timestamp | null
  ride_option: Generated<"free" | "paid_external">
  created_at: Generated<Timestamp>
  updated_at: Generated<Timestamp>
  completed_at: Timestamp | null
  cancelled_reason: string | null
  is_client_picked_up: Generated<boolean>
  is_client_dropped_off: Generated<boolean>
  trip_group_id: string | null
  linked_ride_id: string | null
  trip_leg: "outbound" | "return" | null
}
