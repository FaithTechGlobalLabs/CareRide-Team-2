export interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  dob: string;
  email: string;
  phone: string;
  password_hash: string;
}

export interface Vehicle {
  id: string;
  driver_id: string;
  make: string;
  model: string;
  plate_number: string;
  seats: number;
  wheelchair_accessible: boolean;
}

export type AvailabilityKind = "one_time" | "weekly" | "monthly";

export interface DriverAvailability {
  id: string;
  driver_id: string;
  centre_lat: number;
  centre_lng: number;
  radius_m: number;
  is_active: boolean;
  kind: AvailabilityKind;
  start_time: string;
  end_time: string;
  timezone: string;
  on_date?: string;
  weekdays?: number[];
  month_days?: number[];
  starts_on?: string;
  ends_on?: string;
  note?: string;
}

export type DriverVerificationStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "expired";

export interface DriverVerification {
  id: string;
  driver_id: string;
  approved_by_org_id: string;
  approved_by_staff_id?: string;
  document_type: string;
  document_filename?: string;
  expires_on?: string;
  status: DriverVerificationStatus;
  reviewed_at?: string;
  reject_reason?: string;
}
