export interface Organization {
  id: string;
  name: string;
  email: string;
  phone: string;
  created_at: string;
}

export type LocationType = "hospital" | "shelter" | "service";

export interface Destination {
  id: string;
  organization_id: string;
  name: string;
  type: LocationType;
  address: string;
  lat: number;
  lng: number;
  is_active: boolean;
}
