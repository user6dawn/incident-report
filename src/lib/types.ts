export type Role = "student" | "admin";
export type Status = "new" | "unresolved" | "resolved";

export interface Profile {
  id: string;
  full_name: string;
  matric_no: string | null;
  role: Role;
  created_at: string;
}

export interface Incident {
  id: number;
  reporter_id: string | null;
  is_anonymous: boolean;
  category: string;
  description: string;
  location_name: string;
  latitude: number;
  longitude: number;
  incident_date: string;
  status: Status;
  created_at: string;
  updated_at: string;
}

export interface Anomaly {
  id: number;
  incident_id: number;
  anomaly_score: number;
  raw_score: number;
  level: "medium" | "high";
  reason: string;
  reviewed: boolean;
  model_version: string | null;
  detected_at: string;
}

export interface MapPoint {
  id: number;
  lat: number;
  lng: number;
  label: string;
  status: Status;
}
