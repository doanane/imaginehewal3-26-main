import type { Analytics, Brief, Cohort, Detail, DoctorInfo, Overview } from './types';

const KEY = 'hewal3.doctor.session';
export interface Session { token: string; doctor: DoctorInfo }

export function loadSession(): Session | null {
  try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; }
}
export function saveSession(s: Session | null) {
  try { if (s) sessionStorage.setItem(KEY, JSON.stringify(s)); else sessionStorage.removeItem(KEY); } catch { /* storage blocked */ }
}

let onExpired: () => void = () => {};
export const setExpiredHandler = (f: () => void) => { onExpired = f; };

async function call<T>(path: string, opts: { method?: string; body?: unknown; form?: FormData } = {}): Promise<T> {
  const s = loadSession();
  const headers: Record<string, string> = { Accept: 'application/json', 'ngrok-skip-browser-warning': 'true' };
  if (opts.body) headers['Content-Type'] = 'application/json';
  if (s) headers.Authorization = `Bearer ${s.token}`;
  let r: Response;
  try {
    r = await fetch(path.startsWith('/rtc') || path.startsWith('/auth/') || path.startsWith('/agent/story') ? path : `/doctor-portal${path}`, { method: opts.method || 'GET', headers, body: opts.form ?? (opts.body ? JSON.stringify(opts.body) : undefined) });
  } catch {
    throw new Error('Cannot reach the server. Check the connection.');
  }
  // a 401 on the login form only means wrong details; with a session it means the session ended
  if (r.status === 401 && s) { onExpired(); throw new Error('Your session ended. Please sign in again.'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(typeof j.detail === 'string' ? j.detail : Array.isArray(j.detail) && j.detail[0]?.msg ? `Please check the entry: ${String(j.detail[0].msg).toLowerCase()}.` : `Something went wrong (${r.status}).`);
  return j as T;
}

export const login = (doctor_id: string, password: string) =>
  call<{ access_token: string; doctor: DoctorInfo }>('/login', { method: 'POST', body: { doctor_id, password } });
/** Reviewer sandbox: signs in as the demo doctor, no account needed. */
export const guestLogin = () => call<{ access_token: string; doctor: DoctorInfo }>('/auth/guest', { method: 'POST', body: { role: 'doctor' } });
export const getOverview = () => call<Overview>('/overview');
export const getPatient = (id: number) => call<Detail>(`/patients/${id}`);
export const getAnalytics = (id: number, days: number) => call<Analytics>(`/patients/${id}/analytics?days=${days}`);
export const getCohort = (days: number) => call<Cohort>(`/cohort?days=${days}`);
export const getFhir = (id: number) => call<unknown>(`/patients/${id}/fhir`);
export const getBrief =(id: number, refresh = false) => call<Brief>(`/patients/${id}/brief${refresh ? '?refresh=true' : ''}`);

export interface ChatMessage { id: number; sender_role: 'doctor' | 'patient'; content: string; created_at: string | null; read_at: string | null }
export const getThread = (id: number) => call<{ messages: ChatMessage[]; peer_online: boolean; peer_id: number }>(`/patients/${id}/thread`);
export const postThread = (id: number, message: string) => call<ChatMessage>(`/patients/${id}/thread`, { method: 'POST', body: { message } });
export const readThread = (id: number) => call<{ read: number }>(`/patients/${id}/thread/read`, { method: 'POST' });
export const getInbox = () => call<{ unread: Record<string, number>; total: number }>('/inbox');

export interface Profile { doctor_id: string; full_name: string; specialization: string | null; hospital: string | null; email: string | null; member_since: string | null; patients: number; photo_url?: string | null }
export const getMe = () => call<Profile>('/me');
export const updateMe = (body: Partial<Pick<Profile, 'full_name' | 'specialization' | 'hospital' | 'email'>>) => call<Profile>('/me', { method: 'PATCH', body });
export const uploadPhoto = (file: File) => { const form = new FormData(); form.append('file', file); return call<{ photo_url: string | null }>('/me/photo', { method: 'POST', form }); };
export const removePhoto = () => call<{ photo_url: string | null }>('/me/photo', { method: 'DELETE' });
export const changePassword = (current_password: string, new_password: string) => call<{ ok: boolean }>('/me/password', { method: 'POST', body: { current_password, new_password } });

export type ApptStatus = 'requested' | 'confirmed' | 'declined' | 'cancelled' | 'completed';
export interface Appointment { id: number; patient_id: number; patient: string | null; starts_at: string; duration_min: number; mode: 'in_person' | 'video' | 'phone'; reason: string | null; status: ApptStatus; requested_by: string; doctor_message: string | null }
export const getAppointments = (scope: 'upcoming' | 'past' = 'upcoming') => call<{ appointments: Appointment[] }>(`/appointments?scope=${scope}`);
export const bookAppointment = (patientId: number, b: { starts_at: string; duration_min: number; mode: string; reason?: string }) => call<Appointment>(`/patients/${patientId}/appointments`, { method: 'POST', body: b });
export const patchAppointment = (id: number, b: { status?: ApptStatus; starts_at?: string; doctor_message?: string }) => call<Appointment>(`/appointments/${id}`, { method: 'PATCH', body: b });
export interface Note { id: number; text: string; shared: boolean; at: string | null }
export const getNotes = (id: number) => call<{ notes: Note[] }>(`/patients/${id}/notes`);
export const addNote = (id: number, text: string, shared: boolean) => call<Note>(`/patients/${id}/notes`, { method: 'POST', body: { text, shared } });
export const deleteNote = (noteId: number) => call<{ ok: boolean }>(`/notes/${noteId}`, { method: 'DELETE' });
export interface Rx { id: number; name: string; dose: string | null; times: string[]; instructions: string | null; status: 'active' | 'stopped'; stop_reason: string | null; prescribed: string | null; stopped: string | null }
export const getPrescriptions = (id: number) => call<{ prescriptions: Rx[] }>(`/patients/${id}/prescriptions`);
export const prescribe = (id: number, b: { name: string; dose?: string; times: string[]; instructions?: string }) => call<Rx>(`/patients/${id}/prescriptions`, { method: 'POST', body: b });
export const stopPrescription = (rxId: number, reason: string) => call<Rx>(`/prescriptions/${rxId}/stop`, { method: 'POST', body: { reason } });

// ------------------------------------------------------------------ health record: labs, radiology, allergies, immunisations, visits
export interface RecAllergy { id: number; substance: string; reaction: string | null; severity: 'mild' | 'moderate' | 'severe'; source: 'patient' | 'doctor'; at: string | null }
export interface RecLab { id: number; test: string; value: string; unit: string | null; ref_range: string | null; flag: 'normal' | 'low' | 'high' | 'critical'; taken_at: string | null; note: string | null }
export interface RecRad { id: number; modality: string; body_part: string; facility: string | null; performed_at: string | null; findings: string | null; impression: string | null; image_url: string | null }
export interface RecImm { id: number; vaccine: string; dose: string | null; given_on: string | null; facility: string | null; source: 'patient' | 'doctor' }
export interface RecVisit { id: number; facility: string | null; kind: 'clinic' | 'emergency' | 'admission'; reason: string | null; doctor: string | null; checked_in_at: string | null; checked_out_at: string | null; open: boolean; summary: string | null }
export interface RecIns { provider: string; plan: string | null; member_no: string | null; valid_until: string | null; expired: boolean; coverage_notes: string | null }
export interface HealthRecord { allergies: RecAllergy[]; labs: RecLab[]; radiology: RecRad[]; immunisations: RecImm[]; insurance: RecIns | null; visits: RecVisit[]; open_visit: RecVisit | null }
export const getRecord = (id: number) => call<HealthRecord>(`/patients/${id}/records`);
export const addLab = (id: number, b: { test: string; value: string; unit?: string; ref_range?: string; flag: string; note?: string }) => call<RecLab>(`/patients/${id}/labs`, { method: 'POST', body: b });
export const addRadiology = (id: number, b: { modality: string; body_part: string; findings?: string; impression?: string; image_url?: string }) => call<RecRad>(`/patients/${id}/radiology`, { method: 'POST', body: b });
export const addAllergy = (id: number, b: { substance: string; reaction?: string; severity: string }) => call<RecAllergy>(`/patients/${id}/allergies`, { method: 'POST', body: b });
export const addImmunisation = (id: number, b: { vaccine: string; dose?: string; given_on: string }) => call<RecImm>(`/patients/${id}/immunisations`, { method: 'POST', body: b });
export const checkIn = (id: number, b: { kind: string; reason?: string }) => call<RecVisit>(`/patients/${id}/visits`, { method: 'POST', body: b });
export const checkOut = (id: number, visit: number, summary: string) => call<RecVisit>(`/patients/${id}/visits/${visit}/check-out`, { method: 'POST', body: { summary } });

export const getIce = () => call<{ iceServers: RTCIceServer[]; relay: boolean }>('/rtc/ice');

export const getPatientBehavior = (id: number) => call<any>(`/patients/${id}/behavior`);
export const getPanelImpact = () => call<any>('/behavior/impact');


// ------------------------------------------------------------------ clinic workflow: today, schedule, hours, messages, consultations, documents
import type { Group } from './types';
const tz = () => new Date().getTimezoneOffset();             // minutes behind UTC, so the server cuts "today" where the doctor is

export interface Hours { days: number[]; start: string; end: string; slot_min: number }
export interface TodayAppt extends Appointment { group: Group | null; age: number | null; gender: string | null; consultation: { id: number; status: 'draft' | 'signed' } | null; is_now: boolean }
export interface Today {
  date: string; appointments: TodayAppt[]; next_up: TodayAppt | null; hours: Hours;
  counts: { today: number; done: number; waiting_requests: number; week: number; unread_messages: number; open_drafts: number };
}
export const getToday = () => call<Today>(`/today?offset=${tz()}`);
export interface Schedule { start: string; days: number; appointments: Appointment[]; hours: Hours }
export const getSchedule = (start: string, days = 7) => call<Schedule>(`/schedule?start=${start}&days=${days}&offset=${tz()}`);
export const getAvailability = () => call<Hours>('/me/availability');
export const setAvailability = (h: Hours) => call<Hours>('/me/availability', { method: 'PUT', body: h });

export interface Conversation { patient_id: number; patient: string; last: string; from: 'doctor' | 'patient'; at: string | null; unread: number; online: boolean }
export const getConversations = () => call<{ conversations: Conversation[]; unread_total: number }>('/conversations');

export interface DxRef { code: string; label: string; group: string }
export interface MedRef { name: string; cls: string; doses: string[]; times: string[]; how: string }
export const searchDiagnoses = (q: string) => call<{ results: DxRef[]; note: string }>(`/reference/diagnoses?q=${encodeURIComponent(q)}`);
export const searchMedicines = (q: string) => call<{ results: MedRef[] }>(`/reference/medicines?q=${encodeURIComponent(q)}`);
export interface RxCheck { known: boolean; medicine?: string; class?: string; usual_doses?: string[]; usual_times?: string[]; how?: string; note?: string; warnings: { level: 'caution' | 'avoid'; text: string }[] }
export const checkRx = (patientId: number, name: string) => call<RxCheck>(`/patients/${patientId}/prescriptions/check`, { method: 'POST', body: { name } });

export interface Dx { code: string | null; label: string }
export interface ClinicVitals { systolic?: number; diastolic?: number; heart_rate?: number; spo2?: number; temperature?: number; weight?: number; glucose?: number }
export interface Consultation {
  id: number; patient_id: number; patient: string | null; appointment_id: number | null; status: 'draft' | 'signed'; complaint: string | null;
  subjective: string | null; objective: string | null; assessment: string | null; plan: string | null; diagnoses: Dx[]; clinic_vitals: ClinicVitals;
  follow_up_at: string | null; share_plan: boolean; addenda: { text: string; at: string }[]; started_at: string | null; updated_at: string | null; signed_at: string | null;
}
export type ConsultPatch = Partial<Pick<Consultation, 'complaint' | 'subjective' | 'objective' | 'assessment' | 'plan' | 'share_plan'>> & { diagnoses?: Dx[]; clinic_vitals?: ClinicVitals; follow_up_at?: string; clear_follow_up?: boolean };
export const startConsultation = (patientId: number, appointmentId?: number) => call<Consultation>(`/patients/${patientId}/consultations`, { method: 'POST', body: { appointment_id: appointmentId ?? null } });
export const getConsultation = (id: number) => call<Consultation>(`/consultations/${id}`);
export const patchConsultation = (id: number, b: ConsultPatch) => call<Consultation>(`/consultations/${id}`, { method: 'PATCH', body: b });
export const signConsultation = (id: number) => call<Consultation>(`/consultations/${id}/sign`, { method: 'POST' });
export const addAddendum = (id: number, text: string) => call<Consultation>(`/consultations/${id}/addendum`, { method: 'POST', body: { text } });
export const deleteConsultation = (id: number) => call<{ ok: boolean }>(`/consultations/${id}`, { method: 'DELETE' });
export const getPatientConsultations = (patientId: number) => call<{ consultations: Consultation[] }>(`/patients/${patientId}/consultations`);

export type DocKind = 'referral' | 'sick_note' | 'letter';
export interface ClinicDoc {
  id: number; ref: string; kind: DocKind; title: string; body: Record<string, any>; revoked: boolean; issued_at: string | null; patient_id: number; patient: string | null;
  consultation_id: number | null; doctor?: { name: string; specialization: string | null; hospital: string | null; doctor_id: string }; patient_info?: { age: number | null; gender: string | null };
}
export const createDocument = (patientId: number, b: { kind: DocKind; title?: string; consultation_id?: number | null; body: Record<string, unknown> }) => call<ClinicDoc>(`/patients/${patientId}/documents`, { method: 'POST', body: b });
export const getDocuments = () => call<{ documents: ClinicDoc[] }>('/documents');
export const getPatientDocuments = (patientId: number) => call<{ documents: ClinicDoc[] }>(`/patients/${patientId}/documents`);
export const getDocument = (id: number) => call<ClinicDoc>(`/documents/${id}`);
export const revokeDocument = (id: number) => call<{ ok: boolean }>(`/documents/${id}/revoke`, { method: 'POST' });
export interface DocCheck { valid: boolean; revoked?: boolean; kind?: string; issued_on?: string; doctor?: string | null; hospital?: string | null; specialization?: string | null; reason?: string | null }
export async function verifyDocument(ref: string): Promise<DocCheck> {
  const r = await fetch(`/verify/document/${encodeURIComponent(ref.trim())}`, { headers: { Accept: 'application/json', 'ngrok-skip-browser-warning': 'true' } });
  if (r.status === 429) throw new Error('Too many checks. Please wait a minute.');
  return r.json();
}

// ---- care agent
export const agentStory = (scenario: 'lapse' | 'safety') => call<any>(`/agent/story?scenario=${scenario}`);
export const agentQueue = () => call<{ pending: any[]; reviewed: any[] }>('/agent/queue');
export const getPatientAgent = (id: number) => call<any>(`/patients/${id}/agent`);
export const agentReview = (id: number, decision: 'approve' | 'override' | 'dismiss', note: string, message: string) =>
  call<{ ok: boolean; review_status: string }>(`/agent/runs/${id}/review`, { method: 'POST', body: { decision, note: note || null, message: message || null } });

// ---- ask a patient to link
export const findPatient = (q: string) => call<any>(`/find?q=${encodeURIComponent(q)}`);
export const sendLinkRequest = (patient_user_id: number, message: string) => call<{ id: number; status: string }>('/link-requests', { method: 'POST', body: { patient_user_id, message: message || null } });
export const getLinkRequests = () => call<{ requests: any[] }>('/link-requests');
export const withdrawLinkRequest = (id: number) => call<{ ok: boolean }>(`/link-requests/${id}`, { method: 'DELETE' });
export const redeemShare = (code: string) => call<unknown>('/exchange/redeem', { method: 'POST', body: { code } });

// ------------------------------------------------------------------ workplace heat safety
export interface Workplace { id: number; name: string; region: string; latest: { temp_c: number; humidity_pct: number; source: string; note: string | null; at: string | null } | null; level: string | null; title: string | null; heat_index_c: number | null; members: number | null; members_hidden: boolean; has_sensor_key: boolean; last_alert_at: string | null; last_alert_level: string | null }
export interface WorkplaceReading { id: number; temp_c: number; humidity_pct: number; source: string; note: string | null; at: string | null; level: string; heat_index_c: number }
export const getWorkplaces = () => call<{ workplaces: Workplace[] }>('/workplaces');
export const createWorkplace = (name: string, region: string) => call<Workplace & { join_code: string; site_key: string; note: string }>('/workplaces', { method: 'POST', body: { name, region } });
export const addSiteReading = (id: number, b: { temp_c: number; humidity_pct: number; note?: string }) => call<Workplace>(`/workplaces/${id}/readings`, { method: 'POST', body: b });
export const getSiteReadings = (id: number, hours = 48) => call<{ readings: WorkplaceReading[] }>(`/workplaces/${id}/readings?hours=${hours}`);
export const rotateWorkplace = (id: number) => call<{ join_code: string; site_key: string; note: string }>(`/workplaces/${id}/rotate`, { method: 'POST' });
export const deleteWorkplace = (id: number) => call<{ ok: boolean }>(`/workplaces/${id}`, { method: 'DELETE' });

