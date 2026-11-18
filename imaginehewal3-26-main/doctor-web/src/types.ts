export type Group = 'critical' | 'monitor' | 'stable' | 'healthy' | 'no_data';
export interface Vitals { heart_rate: number | null; blood_oxygen: number | null; systolic: number | null; diastolic: number | null; steps: number | null; glucose: number | null; at: string | null }
export interface Snapshot {
  patient_id: number; identifier: string | null; name: string; age: number | null; gender: string | null; conditions: string[]; photo_url?: string | null;
  vitals: Vitals; status: string; group: Group; reasons: string[]; active_alerts: number; caregivers: string[]; adherence: number | null;
}
export interface DoctorInfo { doctor_id: string; full_name: string; specialization: string | null; hospital: string | null; photo_url?: string | null }
export interface Emergency { id: number; patient_id: number; patient: string | null; reason: string | null; trigger: string | null; status: string; attempts: number; escalated: boolean; location_url: string | null; at: string | null; resolved_at: string | null }
export interface Overview {
  doctor: DoctorInfo; stats: { total: number; critical: number; monitor: number; stable: number; healthy: number; no_data: number; active_alerts: number };
  alerts: Emergency[]; patients: Snapshot[]; server_time: string;
}
export interface Detail {
  patient: Snapshot; profile: { weight: number | null; height: number | null; family_history: string[]; emergency_contact: string | null };
  vitals_series: { at: string; heart_rate: number | null; blood_oxygen: number | null; systolic: number | null; diastolic: number | null }[];
  steps_week: { day: string; steps: number }[];
  medications: { name: string; dose: string | null; doses: { time: string; taken: boolean }[] }[];
  meals: { meal: string | null; score: number | null; summary: string | null; at: string | null }[];
  emergencies: Emergency[]; messages: { message: string; at: string | null }[];
}
export interface Brief { summary: string; flags: string[]; suggested_questions: string[]; source: string; figures?: Record<string, number | string>; generated_at?: string }

// ---- analytics (computed on the server from stored readings)
export interface Stats { n: number; mean: number; median: number; sd: number; min: number; max: number; p10: number; p90: number; cv: number | null }
export interface Trend {
  direction: 'rising' | 'falling' | 'steady' | 'unknown'; days_used: number; slope_per_day?: number; change_over_window?: number;
  r2?: number; p?: number; line?: [number, number]; note?: string;
}
export interface DailyPoint { day: string; mean: number; min: number; max: number; n: number }
export interface MetricBlock {
  key: 'heart_rate' | 'systolic' | 'diastolic' | 'blood_oxygen' | 'glucose'; label: string; unit: string; reference: [number | null, number | null];
  stats: Stats; latest: { value: number; at: string }; time_in_range: number; above: number; below: number;
  daily: DailyPoint[]; trend: Trend; vs_previous?: { previous_mean: number; delta: number; previous_n: number };
  outliers: { at: string; value: number; z: number }[]; by_hour: { hour: number; mean: number; n: number }[];
}
export interface Finding { level: 'critical' | 'high' | 'moderate' | 'info'; title: string; evidence: string }
export interface MedicationStats {
  /** null while fewer than 3 doses were due: there is nothing fair to judge yet, which is NOT the same as 0% */
  due: number; taken: number; skipped: number; unlogged: number;
  adherence_pct: number | null; daily: { day: string; taken: number; expected: number }[]; by_time: { time: string; taken_pct: number }[];
  weakest_time: { time: string; taken_pct: number } | null; first_half_pct: number | null; second_half_pct: number | null;
  medicines: { name: string; dose: string | null; times: string[] }[];
}
export interface Analytics {
  window_days: number; coverage: { window_days: number; days_with_readings: number; readings: number; last_reading: string | null };
  metrics: Partial<Record<MetricBlock['key'], MetricBlock>>; bp_categories: Record<string, number>;
  steps: { stats: Stats; daily: { day: string; steps: number }[]; trend: Trend } | null; medication: MedicationStats | null;
  findings: Finding[]; method: string; generated_at: string;
}
export interface Cohort {
  window_days: number; bp_control: { controlled: number; measured: number; pct: number | null };
  adherence: { mean: number | null; below_70: number; measured: number };
  silent_48h: { patient_id: number; name: string; last: string | null }[];
  review_queue: { patient_id: number; name: string; group: Group; score: number; why: string[] }[];
  per_patient: Record<string, { readings: number; days: number; mean_bp?: string; mean_hr?: number }>;
  conditions: { name: string; count: number }[]; mean_age: number | null;
}
