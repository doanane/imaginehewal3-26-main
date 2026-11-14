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

async function call<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const s = loadSession();
  const headers: Record<string, string> = { Accept: 'application/json', 'ngrok-skip-browser-warning': 'true' };
  if (opts.body) headers['Content-Type'] = 'application/json';
  if (s) headers.Authorization = `Bearer ${s.token}`;
  let r: Response;
  try {
    r = await fetch(`/doctor-portal${path}`, { method: opts.method || 'GET', headers, body: opts.body ? JSON.stringify(opts.body) : undefined });
  } catch {
    throw new Error('Cannot reach the server. Check the connection.');
  }
  // a 401 on the login form only means wrong details; with a session it means the session ended
  if (r.status === 401 && s) { onExpired(); throw new Error('Your session ended. Please sign in again.'); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(typeof j.detail === 'string' ? j.detail : `Something went wrong (${r.status}).`);
  return j as T;
}

export const login = (doctor_id: string, password: string) =>
  call<{ access_token: string; doctor: DoctorInfo }>('/login', { method: 'POST', body: { doctor_id, password } });
export const getOverview = () => call<Overview>('/overview');
export const getPatient = (id: number) => call<Detail>(`/patients/${id}`);
export const getAnalytics = (id: number, days: number) => call<Analytics>(`/patients/${id}/analytics?days=${days}`);
export const getCohort = (days: number) => call<Cohort>(`/cohort?days=${days}`);
export const getBrief =(id: number, refresh = false) => call<Brief>(`/patients/${id}/brief${refresh ? '?refresh=true' : ''}`);
export const sendMessage = (id: number, message: string) => call<{ ok: boolean }>(`/patients/${id}/message`, { method: 'POST', body: { message } });
