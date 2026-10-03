export type OrganizationType =
  | "partner_org"
  | "transport_provider";

export type OrganizationStatus =
  | "pending"
  | "active"
  | "suspended";

export interface Organization {
  id: string;
  name: string;
  type: OrganizationType;
  contact_name: string;
  email: string;
  phone: string;
  address: string;
  status: OrganizationStatus;
  created_at: Date;
}

export type DestinationType =
  | "hospital"
  | "shelter"
  | "service";

export interface Destination {
  id: string;
  organization_id: string;
  name: string;
  type: DestinationType;
  address: string;
  lat: number;
  lng: number;
  is_active: boolean;
}