export type RideStatus =
  | "requested"
  | "approved"
  | "dispatched"
  | "accepted"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show"
  | "declined";

export type RideOption = "free" | "paid_external";

export interface RideRequest {
  id: string;

  client_id: string;
  requested_by_user_id: string;
  organization_id: string;

  pickup_address: string;
  pickup_lat: number;
  pickup_lng: number;

  destination_id?: string;
  destination_address?: string;

  destination_lat?: number;
  destination_lng?: number;

  trip_group_id?: string;
  linked_ride_id?: string;
  trip_leg?: "outbound" | "return";
  urgency?: "routine" | "soon" | "time_sensitive";

  requested_pickup_at: string;
  appointment_at?: string;

  passenger_count: number;
  accessibility_needs?: string;
  notes?: string;

  status: RideStatus;

  driver_id?: string;

  approved_by_user_id?: string;
  approved_at?: string;
  picked_up_at?: string;
  waiting_minutes?: number;
  sample?: boolean;

  ride_option: RideOption;

  // Measurement / reporting
  distance_km?: number;
  duration_minutes?: number;
  estimated_cost_saved?: number;
  staff_minutes_spent?: number;
  missed_appointment_avoided?: boolean;

  created_at: string;
  updated_at: string;
  completed_at?: string;
  cancelled_reason?: string;
}

export type DriverOfferResponse = "accepted" | "declined" | "expired";

export interface DriverOffer {
  id: string;
  ride_request_id: string;
  driver_id: string;

  offered_at: string;
  response?: DriverOfferResponse;
  responded_at?: string;
}
