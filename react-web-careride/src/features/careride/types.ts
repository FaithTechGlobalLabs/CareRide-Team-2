export type Role = "admin" | "staff" | "driver"
export interface Session {
  token: string
  user: {
    id: string
    name: string
    email: string
    role: Role
    organization_id?: string
    organization_name?: string
  }
  organization?: Organization
}
export interface Organization {
  id: string
  name: string
  type: "partner_org" | "transport_provider"
  address: string
  contact_name?: string
  email?: string
  phone?: string
}
export interface Client {
  id: string
  first_name: string
  last_name: string
  dob: string
  address?: string
  has_smartphone: boolean
  phone?: string
  email?: string
  emergency_contact_name?: string
  emergency_contact_phone?: string
  notes?: string
}
export interface Destination {
  id: string
  name: string
  type: "hospital" | "shelter" | "service"
  address: string
  lat: number
  lng: number
  is_active: boolean
}
export type Status =
  | "requested"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show"
export interface Driver {
  id: string
  name: string
  email: string
  phone: string
  vehicle?: Vehicle
}
export interface Vehicle {
  make: string
  model: string
  plate: string
  seats: number
  wheelchair_accessible: boolean
}
export interface Ride {
  id: string
  client_id: string
  round_trip: boolean
  organization_id?: string
  requested_by_user_id?: string
  pickup_address: string
  pickup_lat: number
  pickup_lng: number
  destination_address: string
  destination_lat?: number
  destination_lng?: number
  destination_id?: string
  pickup_id?: string
  requested_pickup_at: string
  passenger_count: number
  accessibility_needs?: string
  notes?: string
  status: Status
  driver_id?: string
  driver?: Driver
  client?: Client
  staff?: { name: string; phone: string }
  waiting_minutes?: number
  linked_ride_id?: string
  trip_leg?: string
  accepted_at?: string
  picked_up_at?: string
  completed_at?: string
  created_at: string
  cancelled_reason?: string
  sample?: boolean
  estimated_cost_saved?: number
}
export interface Availability {
  id: string
  driver_id?: string
  centre_lat: number
  centre_lng: number
  radius_km: number
  kind: "one_time" | "weekly" | "monthly"
  start_time: string
  end_time: string
  timezone: string
  on_date?: string
  weekdays?: number[]
  month_days?: number[]
  starts_on?: string
  ends_on?: string
  minimum_notice_minutes: number
  max_wait_minutes: number
  is_active: boolean
  note?: string
}
export interface Verification {
  id: string
  driver_id: string
  approved_by_org_id: string
  check_type: string
  status: "pending" | "approved" | "rejected" | "expired"
  driver?: Driver
  organization?: Organization
  document_ref?: string
  issued_on?: string
  expires_on?: string
  reject_reason?: string
}
export interface Notice {
  id: string
  ride_request_id: string
  type: string
  message?: string
  sent_at?: string
  read_at?: string
}
export interface Data {
  clients: Client[]
  destinations: Destination[]
  rides: Ride[]
  availableRides: Ride[]
  verifications: Verification[]
  availability: Availability[]
  notifications: Notice[]
  organizations: Organization[]
  summary: {
    completed_rides: number
    estimated_cost_saved: number
    staff_minutes_saved: number
    minutes_saved?: number
  }
}
