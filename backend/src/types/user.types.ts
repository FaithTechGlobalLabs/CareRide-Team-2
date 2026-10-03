export type StaffRole =
  | "staff"
  | "admin"
  | "dispatcher"
  | "driver";

export interface Staff {
  id: string;
  organization_id: string;
  name: string;
  email: string;
  phone: string;
  password_hash: string;
  role: StaffRole;
  is_active: boolean;
}

export interface Client {
  id: string;
  first_name: string;
  last_name: string;
  dob: Date;
  address?: string;
  has_smartphone: boolean;
  phone?: string;
  email?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  notes?: string;
  created_at: Date;
}