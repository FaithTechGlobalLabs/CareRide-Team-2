export type RideStatus =
  | "requested"
  | "accepted"
  | "approved"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show"
  | "timed_out";

export type RideOption = "free" | "paid_external";

export interface RideRequest {
  requested_by_user_id?: string;
  waiting_minutes?: number;
  id: string;
  client_id: string;
  requested_by_staff_id: string;
  organization_id: string;
  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;
  destination_id: string;
  destination_address: string;
  destination_lat: number;
  destination_lng: number;
  requested_pickup_at: string;
  passenger_count: number;
  accessibility_needs: string[];
  notes?: string;
  status: RideStatus;
  driver_id?: string;
  approved_by_user_id?: string;
  approved_at?: string;
  ride_option: RideOption;
  created_at: string;
  updated_at: string;
  completed_at?: string;
  cancelled_reason?: string;
  is_client_picked_up: boolean;
  is_client_dropped_off: boolean;
  trip_group_id?: string;
  linked_ride_id?: string;
  trip_leg?: "outbound" | "return";
}

export type DispatchResponse = "accepted" | "declined" | "expired";

export interface Dispatch {
  id: string;
  ride_request_id: string;
  driver_id: string;
  offered_at: string;
  response?: DispatchResponse;
  responded_at?: string;
}
