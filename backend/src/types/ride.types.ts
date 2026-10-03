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

export type RideOption =
  | "free"
  | "paid_external";

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

  requested_pickup_at: Date;
  appointment_at?: Date;

  passenger_count: number;
  accessibility_needs?: string;
  notes?: string;

  status: RideStatus;

  driver_id?: string;

  approved_by_user_id?: string;
  approved_at?: Date;

  ride_option: RideOption;

  // Measurement / reporting
  distance_km?: number;
  duration_minutes?: number;
  estimated_cost_saved?: number;
  staff_minutes_spent?: number;
  missed_appointment_avoided?: boolean;

  created_at: Date;
  updated_at: Date;
  completed_at?: Date;
  cancelled_reason?: string;
}

export type DriverOfferResponse =
  | "accepted"
  | "declined"
  | "expired";

export interface DriverOffer {
  id: string;
  ride_request_id: string;
  driver_id: string;

  offered_at: Date;
  response?: DriverOfferResponse;
  responded_at?: Date;
}