export interface Driver {
  id: string;
  name: string;
  dob: string;
  password_hash: string;
  email: string;
  phone: string;
  organization_id?: string;
  license_verified: boolean;
}

export interface Vehicle {
  id: string;
  driver_id: string;
  make: string;
  model: string;
  plate: string;
  seats: number;
  wheelchair_accessible: boolean;
}

export type AvailabilityKind = "one_time" | "weekly" | "monthly";

export interface DriverAvailability {
  id: string;
  driver_id: string;

  // PostGIS geography point is represented differently at the DB level.
  centre_lat: number;
  centre_lng: number;
  radius_km: number;

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
  minimum_notice_minutes: number;
  max_wait_minutes: number;
}

export type DriverVerificationStatus =
  "pending" | "approved" | "rejected" | "expired";

export interface DriverVerification {
  id: string;
  driver_id: string;
  approved_by_org_id: string;
  approved_by_user_id?: string;

  check_type: string;
  document_ref?: string;

  issued_on?: string;
  expires_on?: string;

  status: DriverVerificationStatus;
  reviewed_at?: string;
  reject_reason?: string;
}
