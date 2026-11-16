// front/types/dashboard.ts
export interface PatientCardData {
  id: string;
  name: string;
  patient_id: string;
  status: string;
  health_score: number;
  image: string;
  conditions: string[];
  last_checkup?: string;
  age?: number;
  gender?: string;
  email?: string;
  isConfirmed?: boolean;
  isPinned?: boolean;
  lastActive?: string;
}

export interface QuickActionType {
  id: number;
  title: string;
  icon: string;
  color: string;
  screen: string;
}