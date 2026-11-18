import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { resolveBaseUrl } from './baseUrl';

const getBaseUrl = resolveBaseUrl;

const BASE_URL = getBaseUrl();
console.log('API BASE_URL:', BASE_URL);
/** Uploaded images may come back as a relative path when stored locally, or a full URL from cloud storage. */
export const assetUrl = (u: string | null | undefined) => (!u ? '' : /^https?:/.test(u) ? u : `${BASE_URL}${u}`);

export interface PatientSignupData {
  email: string;
  password: string;
  username: string;
  phone_number?: string;
}

export interface CaregiverSignupData {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  confirm_password: string;
  phone_number?: string;
  caregiver_type: string;
  years_of_experience?: number;
  credentials?: string;
  specialties?: string;
  agree_to_terms: boolean;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user_type: string;
  user_id: number;
  email: string;
  username?: string;
  is_email_verified: boolean;
  is_caregiver?: boolean;
  caregiver_id?: string | null;
  profile_image?: string;
}

export interface CaregiverAuthResponse {
  user_type: "patient" | "caregiver" | "doctor";
  caregiver_id: string;
  email: string;
  first_name: string;
  last_name: string;
  caregiver_type: string;
  message: string;
  access_token: string;
  refresh_token: string;
}

export interface ActivityRing {
  move: number;
  move_goal: number;
  exercise: number;
  exercise_goal: number;
  stand: number;
  stand_goal: number;
}

export interface HealthTrend {
  category: string;
  icon: string;
  value: string;
  trend: 'up' | 'down' | 'neutral';
  message: string;
}

export interface HealthCategory {
  id: string;
  title: string;
  value: string;
  unit: string;
  icon: string;
  color: string;
  is_workout: boolean;
}

export interface DailyScore {
  score: number | null;                 // how far today's goals are met, from the goals being tracked
  message: string;
  trend_percentage: number | null;
  breakdown: { key: string; label: string; pct: number; detail: string }[];
}

export interface DashboardData {
  daily_score: DailyScore;
  activity_rings: ActivityRing;
  trends: HealthTrend[];
  categories: HealthCategory[];
  daily_tip?: string;
  personalized_recommendations?: {
    title: string;
    message: string;
    action: string;
    source: string;
    based_on: string[];
  }[];
  risk_alerts?: {
    code: string;
    title: string;
    message: string;
    severity: string;
    source: string;
    based_on: string[];
  }[];
  welcome_message?: string;
  health_snapshot?: any;
  weekly_progress?: any;
  recent_meals?: any[];
  meal_count_today?: number;
}

export interface HealthData {
  steps?: number;
  water_intake?: number;
  sleep_time?: number;
  heart_rate?: number;
  blood_pressure?: string;
  glucose?: number;
  weight?: number;
}

export interface FoodLogData {
  meal_type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  food_items?: string[];
  calories?: number;
  carbs?: number;
  protein?: number;
  fats?: number;
  notes?: string;
  diet_score?: number;
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
  is_primary?: boolean;
}

export interface Notification {
  id: number;
  notification_type: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationGroup {
  system: Notification[];
  caregiver: Notification[];
  doctor: Notification[];
}

export interface ProfileResponse {
  user_id: number;
  email: string;
  username: string;
  full_name: string;
  gender: string;
  age: number;
  profile_image_url: string;
  chronic_conditions: string[];
  family_history: string[];
  weight: number;
  height: number;
  bmi: number;
  blood_pressure: string;
  heart_rate: number;
  blood_glucose: number;
  daily_habits: string[];
  profile_completed: boolean;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  emergency_contact_relationship: string;
  is_caregiver: boolean;
  patient_id: string;
  caregiver_id?: string;
  created_at: string;
}

export interface LeaderboardEntry {
  rank: number;
  user_id: number;
  username: string;
  score: number;
  avatar_url?: string;
}

export interface Achievement {
  id: number;
  title: string;
  description: string;
  icon: string;
  unlocked: boolean;
  unlocked_at?: string;
  progress?: number;
  target?: number;
}

export interface DashboardStats {
  total_patients: number;
  active_patients: number;
  critical_patients: number;
  pending_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  todays_appointments: number;
  weekly_appointments: number;
  avg_health_score: number;
}

export interface PatientOverview {
  id: string;
  name: string;
  email: string;
  patient_id: string;
  age?: number;
  gender?: string;
  status: string;
  health_score: number;
  last_checkup?: string;
  conditions: string[];
  image: string;
  isConfirmed: boolean;
  isPinned: boolean;
  lastActive: string;
  recent_vitals?: {
    heart_rate?: number;
    blood_pressure?: string;
    blood_glucose?: number;
  };
}

export interface TaskOverview {
  id: number;
  title: string;
  patient_id: number;
  patient_name: string;
  task_type: string;
  status: string;
  priority: string;
  due_date?: string;
  is_overdue: boolean;
}

export interface AppointmentOverview {
  id: number;
  title: string;
  patient_id: number;
  patient_name: string;
  appointment_type: string;
  status: string;
  start_time: string;
  end_time: string;
  location?: string;
  is_virtual: boolean;
}

export interface CaregiverDashboardData {
  stats: DashboardStats;
  recent_patients: PatientOverview[];
  upcoming_tasks: TaskOverview[];
  todays_appointments: AppointmentOverview[];
  recent_alerts: any[];
  vital_trends: any[];
  caregiver_info: {
    name: string;
    caregiver_id: string;
  };
  last_updated: string;
}

export interface CaregiverTask {
  id: number;
  caregiver_id: number;
  patient_id: number;
  patient_name: string;
  title: string;
  description?: string;
  task_type: string;
  status: string;
  priority: string;
  due_date?: string;
  start_time?: string;
  end_time?: string;
  completed_at?: string;
  is_recurring: boolean;
  recurrence_rule?: string;
  recurrence_days?: number[];
  notes?: string;
  attachments?: string[];
  is_overdue: boolean;
  created_at: string;
  updated_at?: string;
}

export interface CaregiverAppointment {
  id: number;
  caregiver_id: number;
  patient_id: number;
  patient_name: string;
  patient_email: string;
  title: string;
  description?: string;
  appointment_type: string;
  status: string;
  start_time: string;
  end_time: string;
  duration_minutes?: number;
  location?: string;
  is_virtual: boolean;
  meeting_link?: string;
  meeting_platform?: string;
  doctor_id?: number;
  other_caregivers: number[];
  participant_notes?: string;
  notes?: string;
  attachments: string[];
  color: string;
  created_at: string;
}

export interface PatientAnalytics {
  patient_info: {
    id: number;
    name: string;
    patient_id: string;
  };
  analysis_period: {
    days: number;
    start_date: string;
    end_date: string;
  };
  health_trends: any;
  task_analytics: any;
  appointment_analytics: any;
  overall_score: number;
  risk_assessment: any;
  recommendations: string[];
}

export interface CreateTaskRequest {
  patient_id: number;
  title: string;
  description?: string;
  task_type: string;
  priority: string;
  due_date?: string;
  start_time?: string;
  end_time?: string;
  is_recurring?: boolean;
  recurrence_rule?: string;
  recurrence_days?: number[];
  notes?: string;
}

export interface CreateAppointmentRequest {
  patient_id: number;
  title: string;
  description?: string;
  appointment_type: string;
  start_time: string;
  end_time: string;
  location?: string;
  is_virtual?: boolean;
  meeting_link?: string;
  meeting_platform?: string;
  doctor_id?: number;
  other_caregivers?: number[];
  participant_notes?: string;
  send_reminder?: boolean;
  reminder_minutes_before?: number;
  notes?: string;
}

export interface CaregiverProfile {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  full_name: string;
  phone_number?: string;
  caregiver_type?: string;
  experience_years?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AssignedPatient {
  id: number;
  patient_id: string;
  patient_name: string;
  email: string;
  age?: number;
  gender?: string;
  status: string;
  health_score?: number;
  last_checkup?: string;
  conditions: string[];
  assigned_at: string;
  relationship_type: string;
}

export interface PatientStats {
  total_patients: number;
  active_patients: number;
  pending_requests: number;
  critical_patients: number;
  average_health_score: number;
}

export interface PatientAccessRequest {
  patient_id: string;
  relationship_type: string;
}

export interface PatientConnectionRequest {
  patient_caregiver_id: string;
}

export interface CalendarEvent {
  id: number;
  title: string;
  start_time: string;
  end_time: string;
  type: 'task' | 'appointment';
  patient_name: string;
  color: string;
  status: string;
}

export interface CalendarViewResponse {
  month: number;
  year: number;
  events: CalendarEvent[];
}

export interface ComparativeAnalytics {
  patient_count: number;
  average_health_score: number;
  task_completion_rate: number;
  appointment_attendance_rate: number;
  patient_comparison: {
    patient_id: number;
    patient_name: string;
    health_score: number;
    task_completion: number;
    appointment_attendance: number;
  }[];
  trends: {
    category: string;
    average: number;
    best_patient: string;
    worst_patient: string;
  }[];
}

export interface DailyTipResponse {
  message: string;
  success: boolean;
  tip: string;
  personalized?: boolean;
  timestamp?: string;
  ai?: boolean;
  language?: string;
  date?: string;
}

export async function getAuthToken(): Promise<string | null> {
  const token = await AsyncStorage.getItem('access_token');
  return token;
}

export async function getUserId(): Promise<string | null> {
  return await AsyncStorage.getItem('user_id');
}

export async function getUserType(): Promise<string | null> {
  return await AsyncStorage.getItem('user_type');
}

export async function saveAuthData(data: AuthResponse | CaregiverAuthResponse): Promise<void> {
  try {
    if ('access_token' in data) {
      await AsyncStorage.setItem('access_token', data.access_token);
    }
    if ('refresh_token' in data) {
      await AsyncStorage.setItem('refresh_token', data.refresh_token);
    }

    if ('user_id' in data) {
      await AsyncStorage.setItem('user_id', data.user_id.toString());
    } else if ('caregiver_id' in data) {
      await AsyncStorage.setItem('user_id', data.caregiver_id);
    }

    if ('user_type' in data) await AsyncStorage.setItem('user_type', data.user_type);
    if ('email' in data) await AsyncStorage.setItem('email', data.email);
    if ('username' in data && data.username) {
      await AsyncStorage.setItem('username', data.username);
    }
  } catch (error) {
    console.error('Error saving auth data:', error);
    throw error;
  }
}

export async function clearAuthData(): Promise<void> {
  invalidateApiCache();
  await AsyncStorage.multiRemove([
    'access_token', 'refresh_token', 'user_id', 'user_type',
    'email', 'username', 'full_name', 'profile_image'
  ]);
}

// ---- Read cache -------------------------------------------------------------------------------------------------------------
// What you have already loaded is shown at once and reused for FRESH_MS, so switching tabs and reopening the app do not refetch
// everything. It is also kept on the phone: when the app opens, the last data you saw appears immediately (for up to OPEN_STALE_MS)
// and is refreshed quietly in the background. Identical requests in flight are shared. Any write clears the cache, so you never see
// your own change as stale. If the network fails, the last good answer is shown instead of an error. Pull-to-refresh calls
// invalidateApiCache(). Live endpoints (vitals, emergencies, messages) are never cached.
const FRESH_MS = 3 * 60_000;
const OPEN_STALE_MS = 30 * 60_000;       // on app start, data this old is shown at once and refreshed behind it
const OFFLINE_STALE_MS = 24 * 3600_000;  // when the network is down, anything up to a day old beats an error screen
const DISK_KEY = 'hewal3.apicache.v1';
const NO_CACHE = /^\/(vitals\/live|emergency|messages|doctor-portal|my-doctor\/(thread|appointments|prescriptions|notes)|behavior\/(supporting|cheers|nudges|groups|shares|supporters)|care-notes|care-team|rtc\/ice|notifications\/unread)/;
type Entry = { at: number; data: unknown; disk?: boolean; short?: boolean };
const SHORT = /^\/(explore\/(score|challenges)|activity\/summary|health\/dashboard|vitals\/summary|ai\/insights)/;
const SHORT_MS = 15_000;
const cache = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
let persistTimer: ReturnType<typeof setTimeout> | null = null;

const hydrated: Promise<void> = (async () => {
  try {
    const [raw, owner] = await Promise.all([AsyncStorage.getItem(DISK_KEY), AsyncStorage.getItem('user_id')]);
    if (!raw || !owner) return;
    const saved = JSON.parse(raw) as { owner: string; entries: [string, { at: number; data: unknown }][] };
    if (saved.owner !== owner) return;                                  // never show another account's data
    const now = Date.now();
    for (const [k, v] of saved.entries) if (now - v.at < OFFLINE_STALE_MS) cache.set(k, { at: v.at, data: v.data, disk: true });
  } catch { /* a damaged cache is just an empty cache */ }
})();

function persistSoon() {
  if (persistTimer) return;
  persistTimer = setTimeout(async () => {
    persistTimer = null;
    try {
      const owner = await AsyncStorage.getItem('user_id');
      if (!owner) return;
      const entries = Array.from(cache.entries()).filter(([, v]) => !v.short && JSON.stringify(v.data ?? null).length < 120_000).map(([k, v]) => [k, { at: v.at, data: v.data }]);
      await AsyncStorage.setItem(DISK_KEY, JSON.stringify({ owner, entries }));
    } catch { /* storage full or blocked: the in-memory cache still works */ }
  }, 1500);
}

export const invalidateApiCache = () => { cache.clear(); inflight.clear(); AsyncStorage.removeItem(DISK_KEY).catch(() => {}); };

async function apiCall<T>(endpoint: string, options: RequestInit = {}, requiresAuth: boolean = true): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  if (method !== 'GET' || !requiresAuth) {
    const result = await apiCallRaw<T>(endpoint, options, requiresAuth);
    if (method !== 'GET' && !/^\/(vitals\/ingest|activity\/steps|emergency\/.*\/location|my-doctor\/(thread|appointments\/\d+\/cancel)|care-notes|messages\/|push\/|rtc\/|activity\/(weight|sleep)\/import)/.test(endpoint)) invalidateApiCache();   // a user write may change any screen; background telemetry does not
    return result;
  }
  const live = NO_CACHE.test(endpoint);
  if (!live) await hydrated;
  const hit = live ? undefined : cache.get(endpoint);
  const age = hit ? Date.now() - hit.at : Infinity;
  const short = SHORT.test(endpoint);
  if (hit && age < (short ? SHORT_MS : FRESH_MS)) return hit.data as T;
  const running = inflight.get(endpoint);
  if (running) return running as Promise<T>;
  const fetchFresh = apiCallRaw<T>(endpoint, options, requiresAuth)
    .then((data) => { if (!live) { cache.set(endpoint, { at: Date.now(), data, short }); persistSoon(); } return data; })
    .finally(() => { inflight.delete(endpoint); });
  // Just opened the app: show what was on screen last time straight away, and refresh behind it.
  if (hit && hit.disk && !short && age < OPEN_STALE_MS) {
    hit.disk = false;
    inflight.set(endpoint, fetchFresh);
    fetchFresh.catch(() => {});
    return hit.data as T;
  }
  const p = fetchFresh.catch((e) => {
    if (hit && age < OFFLINE_STALE_MS && !(e && e.status)) return hit.data as T;      // offline: show the last good data
    throw e;
  });
  inflight.set(endpoint, fetchFresh);
  return p;
}

let renewing: Promise<boolean> | null = null;
/** An expired access token is renewed with the saved refresh token, once at a time, so a person is not sent back to the login screen. */
async function renewSession(): Promise<boolean> {
  if (!renewing) {
    renewing = (async () => {
      try {
        const refresh = await AsyncStorage.getItem('refresh_token');
        if (!refresh) return false;
        const r = await fetch(`${BASE_URL}/auth/token/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...(BASE_URL.includes('ngrok') ? { 'ngrok-skip-browser-warning': 'true' } : {}) },
          body: JSON.stringify({ refresh_token: refresh }),
        });
        if (!r.ok) return false;
        const d = await r.json();
        if (!d?.access_token) return false;
        await AsyncStorage.setItem('access_token', d.access_token);
        return true;
      } catch { return false; }
      finally { setTimeout(() => { renewing = null; }, 0); }
    })();
  }
  return renewing;
}

async function apiCallRaw<T>(
  endpoint: string,
  options: RequestInit = {},
  requiresAuth: boolean = true,
  _retried: boolean = false
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;

  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(BASE_URL.includes('ngrok') ? { 'ngrok-skip-browser-warning': 'true' } : {}),
    ...(options.headers as Record<string, string>),
  };

  if (!isFormData && options.method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  if (requiresAuth) {
    const token = await getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
  }

  try {
    const controller = new AbortController();
    // Keep optional dashboard panels from holding the first screen for 30 seconds
    // when the phone briefly loses the Wi-Fi route to the local API.
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    let response: Response;
    const isGet = !options.method || options.method.toUpperCase() === 'GET';
    try {
      try {
        response = await fetch(url, { ...options, headers, signal: controller.signal });
      } catch (first: any) {
        // A hotspot or Wi-Fi hiccup cancels requests that are in flight. Reading data is safe to repeat once; writes are not.
        const transient = /canceled|network request failed|failed to fetch/i.test(first?.message || '');
        if (!isGet || !transient) throw first;
        await new Promise((r) => setTimeout(r, 500));
        response = await fetch(url, { ...options, headers });
      }
    } finally {
      clearTimeout(timeoutId);
    }

    const contentType = response.headers.get('content-type');
    let responseData;

    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    if (!response.ok) {
      // Handle authentication errors
      if (response.status === 401 && requiresAuth) {
        if (!_retried && (await renewSession())) return apiCallRaw<T>(endpoint, options, requiresAuth, true);
        console.warn('Authentication failed - token may be expired');
        // Clear invalid tokens and auth data
        await AsyncStorage.multiRemove([
          'access_token', 'refresh_token', 'user_id', 'user_type',
          'email', 'username', 'full_name', 'profile_image'
        ]);
        const errorMessage = 'Your session has expired. Please log in again.';
        const error: any = new Error(errorMessage);
        error.status = response.status;
        error.responseData = responseData;
        throw error;
      }

      const errorMessage = responseData.detail || responseData.message || 'API Request Failed';
      const error: any = new Error(typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage));
      error.status = response.status;
      error.responseData = responseData;
      console.error(`API Error (${endpoint}):`, errorMessage);
      throw error;
    }

    return responseData as T;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`API Timeout (${endpoint}): Request took too long`);
      throw new Error('Network request timed out. Please check your connection.');
    }

    if (error.message?.toLowerCase().includes('request has been canceled')) {
      console.warn(`API request canceled (${endpoint}): the phone lost the connection to the backend for a moment`);   // expected when the network drops; not an app error
      throw new Error('Network request was canceled. Check that the device can reach the backend.');
    }

    console.error(`API Fetch Error (${endpoint}):`, error.message);

    if (error.message.includes('Failed to fetch')) {
      throw new Error('Cannot connect to server. Please check if the backend is running.');
    }

    throw error;
  }
}

async function uploadFileToBackend(endpoint: string, formData: FormData) {
  const url = `${BASE_URL}${endpoint}`;
  const token = await getAuthToken();

  if (!token) {
    throw new Error('Authentication token missing.');
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
      ...(BASE_URL.includes('ngrok') ? { 'ngrok-skip-browser-warning': 'true' } : {}),
    },
    body: formData,
  });

  const result = await response.json();
  if (!response.ok) {
    throw new Error(JSON.stringify(result));
  }
  return result;
}

export const systemHealthCheck = () => apiCall('/system/health-check', {}, false);
export const testConnection = async () => {
  try {
    const res = await fetch(`${BASE_URL}/health`);
    return res.ok;
  } catch { return false; }
};

export const signupPatient = (data: PatientSignupData) =>
  apiCall<AuthResponse>('/auth/signup', { method: 'POST', body: JSON.stringify(data) }, false);

export const signupCaregiver = (data: CaregiverSignupData) =>
  apiCall<CaregiverAuthResponse>('/auth/signup/caregiver', { method: 'POST', body: JSON.stringify(data) }, false);

export const login = (data: LoginData) =>
  apiCall<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(data) }, false);

export const forgotPassword = (email: string) =>
  apiCall<{ message: string }>('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }, false);

export const resetPassword = (token: string, new_password: string) =>
  apiCall('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, new_password }) }, false);

export const resetPasswordWithCode = (email: string, code: string, new_password: string) =>
  apiCall<{ message: string }>('/auth/reset-password-code', { method: 'POST', body: JSON.stringify({ email, code, new_password }) }, false);

export const verifyEmailCode = (email: string, code: string) =>
  apiCall<{ message: string }>('/auth/verify-email-code', { method: 'POST', body: JSON.stringify({ email, code }) }, false);

export const verifyEmail = (token: string) =>
  apiCall('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }, false);

export const resendVerification = (email: string) =>
  apiCall<{ message: string }>('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }, false);

export const requestOTP = (email: string) =>
  apiCall<{ message: string }>('/auth/login/otp/request', { method: 'POST', body: JSON.stringify({ email }) }, false);

export const verifyOTP = (email: string, otp: string) =>
  apiCall<AuthResponse>('/auth/login/otp/verify', { method: 'POST', body: JSON.stringify({ email, otp }) }, false);

/** Reviewer sandbox: no sign-up, demo data, nothing reaches real people. */
export const guestLogin = () =>
  apiCall<AuthResponse>('/auth/guest', { method: 'POST', body: JSON.stringify({ role: 'patient' }) }, false);

export const changePassword = (current: string, newPass: string) =>
  apiCall<{ message: string }>('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password: current, new_password: newPass }) });

export const logout = () =>
  apiCall('/auth/logout', { method: 'POST' });

export const getCurrentUser = () =>
  apiCall<any>('/auth/me');

export const refreshToken = (refreshToken: string) =>
  apiCall('/auth/token/refresh', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) }, false);

export const getUserSessions = () =>
  apiCall('/auth/sessions');

export const revokeSession = (sessionId: number) =>
  apiCall(`/auth/sessions/${sessionId}`, { method: 'DELETE' });

export const googleLogin = () =>
  apiCall('/auth/google/login', {}, false);

export const googleCallback = (code: string, state: string) =>
  apiCall(`/auth/google/callback?code=${code}&state=${state}`, {}, false);

export const googleTokenAuth = (token: string) =>
  apiCall('/auth/google/token-auth', { method: 'POST', body: JSON.stringify({ token }) }, false);

export const getProfile = () =>
  apiCall<ProfileResponse>('/users/profile');

export const updateProfile = (data: any) =>
  apiCall('/users/profile', { method: 'PUT', body: JSON.stringify(data) });

export const uploadProfileImage = (imageData: FormData) =>
  uploadFileToBackend('/users/upload-profile-image', imageData);

export const getProfileImage = () =>
  apiCall('/users/profile-image');

export const getCurrentUserInfo = () =>
  apiCall('/users/me');

export const searchUsers = (query: string) =>
  apiCall(`/users/search?query=${encodeURIComponent(query)}`);

export const getEmergencyContacts = () =>
  apiCall('/users/emergency-contacts');

export const addEmergencyContact = (data: EmergencyContact) =>
  apiCall('/users/emergency-contacts', { method: 'POST', body: JSON.stringify(data) });

export const deleteEmergencyContact = (id: number) =>
  apiCall(`/users/emergency-contacts/${id}`, { method: 'DELETE' });

export const getDailyTip = (lang = 'en') =>
  apiCall<DailyTipResponse>(`/api/daily-tip?lang=${encodeURIComponent(lang)}`);

export const getHealthDashboard = () =>
  apiCall<DashboardData>('/health/dashboard');

export const getHealthSnapshot = () =>
  apiCall('/health/health-snapshot');

export const addHealthData = (data: HealthData) =>
  apiCall('/health/health-data', { method: 'POST', body: JSON.stringify(data) });

export const getWeeklyProgress = () =>
  apiCall('/health/weekly-progress');

export const getFoodLogs = (skip: number = 0, limit: number = 10) =>
  apiCall<any[]>(`/health/food-logs?skip=${skip}&limit=${limit}`);

export const logFood = (data: FoodLogData) =>
  apiCall('/health/food-log', { method: 'POST', body: JSON.stringify(data) });

export const updateWeeklyProgress = (progressScore: number) =>
  apiCall('/health/update-progress', { method: 'POST', body: JSON.stringify({ progress_score: progressScore }) });

export const getNotifications = () =>
  apiCall<NotificationGroup>('/notifications/');

export const markNotificationRead = (id: number) =>
  apiCall(`/notifications/mark-read/${id}`, { method: 'POST' });

export const getUnreadCount = () =>
  apiCall<{ unread_count: number }>('/notifications/unread-count');

export const getCaregiverProfile = () =>
  apiCall<CaregiverProfile>('/caregivers/profile');

export const updateCaregiverProfile = (data: Partial<CaregiverProfile>) =>
  apiCall<CaregiverProfile>('/caregivers/profile', { method: 'PUT', body: JSON.stringify(data) });

export const getCaregiverDashboard = () =>
  apiCall<CaregiverDashboardData>('/caregivers/dashboard');

export const getCaregiverMyId = () =>
  apiCall<{ caregiver_id: string }>('/caregivers/my-id');

export const getAssignedPatients = async (): Promise<AssignedPatient[]> => {
  return apiCall<AssignedPatient[]>('/caregivers/patients');
};

export const getMyCaregivers = () =>
  apiCall<any[]>('/caregivers/my-caregivers');

export const requestPatientAccess = (data: PatientAccessRequest) =>
  apiCall('/caregivers/request-access', { method: 'POST', body: JSON.stringify(data) });

export const connectWithPatient = (data: PatientConnectionRequest) =>
  apiCall('/caregivers/connect-patient', { method: 'POST', body: JSON.stringify(data) });

export const connectWithCaregiver = (data: { caregiver_id: string }) =>
  apiCall('/caregivers/connect-caregiver', { method: 'POST', body: JSON.stringify(data) });

export const getIncomingCaregiverRequests = () =>
  apiCall<any[]>('/caregivers/requests/incoming');

export const respondCaregiverRequest = (requestId: number, action: 'approve' | 'reject') =>
  apiCall(`/caregivers/requests/${requestId}/respond`, { method: 'POST', body: JSON.stringify({ action }) });

export interface CarePatientOverview {
  patient: AssignedPatient & { reasons: string[]; vitals: { heart_rate: number | null; blood_oxygen: number | null; systolic: number | null; diastolic: number | null; steps: number | null; glucose: number | null; at: string | null } };
  vitals_series: { at: string; heart_rate: number | null; blood_oxygen: number | null; systolic: number | null; diastolic: number | null }[];
  medications: { name: string; dose: string | null; doses: { time: string; taken: boolean }[] }[];
  emergencies: { id: number; reason: string; status: string; created_at: string | null; location_url: string | null; escalated_at: string | null }[];
  doctor: { name: string; specialization: string; hospital: string } | null;
}
export type MyDoctor = { doctor: { doctor_id: string; full_name: string; specialization: string; hospital: string } | null };
export const getMyDoctor = () => apiCall<MyDoctor>('/my-doctor');
export const linkMyDoctor = (doctor_id: string) => apiCall<MyDoctor>('/my-doctor', { method: 'PUT', body: JSON.stringify({ doctor_id }) });
export const unlinkMyDoctor = () => apiCall<MyDoctor>('/my-doctor', { method: 'DELETE' });
export type DoctorRequest = { id: number; message: string | null; sent_at: string | null; doctor: NonNullable<MyDoctor['doctor']> };
export const getDoctorRequests = () => apiCall<{ requests: DoctorRequest[] }>('/my-doctor/requests');
export const answerDoctorRequest = (id: number, accept: boolean) => apiCall<{ status: string; replaced_previous_doctor?: boolean; doctor: MyDoctor['doctor'] }>(`/my-doctor/requests/${id}`, { method: 'POST', body: JSON.stringify({ accept }) });
export type DoctorChatMessage = { id: number; sender_role: 'doctor' | 'patient'; content: string; created_at: string | null; read_at: string | null };
export type DoctorThread = { messages: DoctorChatMessage[]; doctor: NonNullable<MyDoctor['doctor']>; peer_online: boolean; peer_id: number };
export type DoctorAppt = { id: number; doctor: string | null; starts_at: string; duration_min: number; mode: 'in_person' | 'video' | 'phone'; reason: string | null; status: 'requested' | 'confirmed' | 'declined' | 'cancelled' | 'completed'; doctor_message: string | null };
export type DoctorRx = { id: number; name: string; dose: string | null; times: string[]; instructions: string | null; status: 'active' | 'stopped'; stop_reason: string | null; prescribed: string | null; stopped: string | null; doctor: string | null };
export type DoctorNoteItem = { id: number; text: string; at: string | null };
export const getDoctorAppointments = () => apiCall<{ appointments: DoctorAppt[] }>('/my-doctor/appointments');
export const requestDoctorAppointment = (b: { starts_at: string; duration_min: number; mode: string; reason?: string }) => apiCall<DoctorAppt>('/my-doctor/appointments', { method: 'POST', body: JSON.stringify(b) });
export const cancelDoctorAppointment = (id: number) => apiCall<DoctorAppt>(`/my-doctor/appointments/${id}/cancel`, { method: 'POST' });
export const getDoctorPrescriptions = () => apiCall<{ prescriptions: DoctorRx[] }>('/my-doctor/prescriptions');
export const getDoctorNotes = () => apiCall<{ notes: DoctorNoteItem[] }>('/my-doctor/notes');
export const registerPushToken = (token: string, platform: string) => apiCall<{ ok: boolean }>('/push/register', { method: 'POST', body: JSON.stringify({ token, platform }) });
export const unregisterPushToken = (token: string) => apiCall<{ ok: boolean }>('/push/unregister', { method: 'POST', body: JSON.stringify({ token }) });
export const getIceServers = () => apiCall<{ iceServers: any[]; relay: boolean }>('/rtc/ice');
export type CareNoteItem = { id: number; text: string; author: string; mine: boolean; at: string | null };
export type CareTeam = { patient: { id: number; name: string }; caregivers: { id: number; name: string; type: string | null; relationship: string; online: boolean; me: boolean }[]; doctor: { name: string; specialization: string | null; hospital: string | null } | null };
export const getCareTeam = (patientId: number) => apiCall<CareTeam>(`/care-team/${patientId}`);
export const getCareNotes = (patientId: number) => apiCall<{ can_write: boolean; notes: CareNoteItem[] }>(`/care-notes/${patientId}`);
export const addCareNote = (patientId: number, text: string) => apiCall<CareNoteItem>(`/care-notes/${patientId}`, { method: 'POST', body: JSON.stringify({ text }) });
export const deleteCareNote = (noteId: number) => apiCall<{ ok: boolean }>(`/care-notes/${noteId}`, { method: 'DELETE' });
export const importWeightFromHealth = (entries: { kg: number; at: string }[]) =>
  apiCall<{ added: number }>('/activity/weight/import', { method: 'POST', body: JSON.stringify({ entries }) });
export type SleepImportNight = { start: string; end: string; asleep_min: number; awake_min: number; deep_min: number; rem_min: number; light_min: number; stages?: { stage: 'awake' | 'light' | 'deep' | 'rem'; start: string; end: string }[] };
export const importSleepFromHealth = (sessions: SleepImportNight[]) =>
  apiCall<{ added: number }>('/activity/sleep/import', { method: 'POST', body: JSON.stringify({ sessions }) });
export const getDoctorThread = () => apiCall<DoctorThread>('/my-doctor/thread');
export const sendDoctorMessage = (message: string) => apiCall<DoctorChatMessage>('/my-doctor/thread', { method: 'POST', body: JSON.stringify({ message }) });
export const markDoctorThreadRead = () => apiCall<{ read: number }>('/my-doctor/thread/read', { method: 'POST' });

export const getCarePatientOverview = (patientId: number) =>
  apiCall<CarePatientOverview>(`/caregivers/patients/${patientId}/overview`);

export const getPatientStatistics = () =>
  apiCall<PatientStats>('/caregivers/patients/stats');

export const getCaregiverTasks = () =>
  apiCall<CaregiverTask[]>('/caregiver/tasks');

export const getTodaysTasks = () =>
  apiCall<CaregiverTask[]>('/caregiver/tasks/today');

export const getOverdueTasks = () =>
  apiCall<CaregiverTask[]>('/caregiver/tasks/overdue');

export const createTask = (data: CreateTaskRequest) =>
  apiCall('/caregiver/tasks', { method: 'POST', body: JSON.stringify(data) });

export const updateTask = (taskId: number, data: Partial<CreateTaskRequest>) =>
  apiCall(`/caregiver/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteTask = (taskId: number) =>
  apiCall(`/caregiver/tasks/${taskId}`, { method: 'DELETE' });

export const completeTask = (taskId: number) =>
  apiCall(`/caregiver/tasks/${taskId}/complete`, { method: 'POST' });

export const getCaregiverAppointments = () =>
  apiCall<CaregiverAppointment[]>('/caregiver/schedule/');

export const getTodaysAppointments = () =>
  apiCall<CaregiverAppointment[]>('/caregiver/schedule/today');

export const getUpcomingAppointments = () =>
  apiCall<CaregiverAppointment[]>('/caregiver/schedule/upcoming');

export const getCalendarView = (month: number, year: number) =>
  apiCall<CalendarViewResponse>(`/caregiver/schedule/calendar?month=${month}&year=${year}`);

export const createAppointment = (data: CreateAppointmentRequest) =>
  apiCall('/caregiver/schedule/', { method: 'POST', body: JSON.stringify(data) });

export const updateAppointment = (appointmentId: number, data: Partial<CreateAppointmentRequest>) =>
  apiCall(`/caregiver/schedule/${appointmentId}`, { method: 'PUT', body: JSON.stringify(data) });

export const cancelAppointment = (appointmentId: number) =>
  apiCall(`/caregiver/schedule/${appointmentId}/cancel`, { method: 'POST' });

export const completeAppointment = (appointmentId: number) =>
  apiCall(`/caregiver/schedule/${appointmentId}/complete`, { method: 'POST' });

export const getPatientAnalytics = (patientId: number, period: string = 'week') =>
  apiCall<PatientAnalytics>(`/caregiver/analytics/patient/${patientId}?period=${period}`);

export const getComparativeAnalytics = () =>
  apiCall<ComparativeAnalytics>('/caregiver/analytics/comparative');

export const getWeeklyLeaderboard = () =>
  apiCall<LeaderboardEntry[]>('/gamification/leaderboard/weekly');

export const getUserProgressHistory = () =>
  apiCall<any[]>('/gamification/progress-history');

export const getUserAchievements = () =>
  apiCall<Achievement[]>('/gamification/achievements');

export const analyzeMeal = (imageData: FormData) =>
  uploadFileToBackend('/api/analyze-meal', imageData);

export const getRecentMeals = () =>
  apiCall<any[]>('/api/recent-meals');

export const logMealManual = (data: any) =>
  apiCall('/api/log-meal-manual', { method: 'POST', body: JSON.stringify(data) });

export const doctorLogin = (data: LoginData) =>
  apiCall<AuthResponse>('/auth/login/doctor', { method: 'POST', body: JSON.stringify(data) }, false);

export const getDoctorProfile = () =>
  apiCall<any>('/doctors/profile');

export const getDoctorDashboard = () =>
  apiCall<any>('/doctors/dashboard');

export const getDoctorPatients = () =>
  apiCall<any[]>('/doctors/patients');

export const adminLogin = (data: LoginData) =>
  apiCall('/superadmin/login', { method: 'POST', body: JSON.stringify(data) }, false);

export const createDoctor = (data: any) =>
  apiCall('/admin/create-doctor', { method: 'POST', body: JSON.stringify(data) });

export const listDoctors = () =>
  apiCall('/admin/doctors');

export const chatWithBot = (message: string) =>
  apiCall<{ reply: string }>('/ai/chat', { method: 'POST', body: JSON.stringify({ message }) });

export const testAI = () =>
  apiCall<{ status: string, message: string }>('/ai/test');

export const removePatientConnection = (patientId: number) =>
  apiCall(`/caregivers/patients/${patientId}`, { method: 'DELETE' });

// Export the apiCall function for use by messaging service
export { apiCall };

// ---- Behaviour change (adaptive plans) ----
export type HabitCheer = 'proud' | 'keep_going' | 'thinking_of_you';
export const getBehaviorContext = () => apiCall<any>('/behavior/context');
export const updateBehaviorContext = (d: Record<string, unknown>) => apiCall<any>('/behavior/context', { method: 'PUT', body: JSON.stringify(d) });
export const getBehaviorRecommendations = () => apiCall<{ recommendations: any[] }>('/behavior/recommendations');
export const getBehaviorApproaches = () => apiCall<any>('/behavior/approaches');
export const getBehaviorNudges = () => apiCall<any>('/behavior/nudges');
export const exportBehaviorData = () => apiCall<any>('/behavior/my-data');
export const getBehaviorSupporters = () => apiCall<{ eligible: any[] }>('/behavior/supporters');
export const getBehaviorShares = () => apiCall<{ shares: any[] }>('/behavior/shares');
export const shareBehaviorPlan = (d: { plan_id: number; supporter_id: number; level: 'cheers' | 'progress' }) => apiCall<any>('/behavior/shares', { method: 'POST', body: JSON.stringify(d) });
export const stopBehaviorShare = (id: number) => apiCall<any>(`/behavior/shares/${id}`, { method: 'DELETE' });
export const getBehaviorSupporting = () => apiCall<{ people: any[]; cheers: string[] }>('/behavior/supporting');
export const sendBehaviorCheer = (to_user_id: number, kind: HabitCheer) => apiCall<any>('/behavior/cheers', { method: 'POST', body: JSON.stringify({ to_user_id, kind }) });
export const getBehaviorCheers = () => apiCall<{ cheers: { text: string; at: string | null }[] }>('/behavior/cheers');
export const getBehaviorGroups = () => apiCall<{ groups: any[] }>('/behavior/groups');
export const createBehaviorGroup = (name: string, kind: string) => apiCall<any>('/behavior/groups', { method: 'POST', body: JSON.stringify({ name, kind }) });
export const joinBehaviorGroup = (code: string) => apiCall<any>('/behavior/groups/join', { method: 'POST', body: JSON.stringify({ code }) });
export const leaveBehaviorGroup = (id: number) => apiCall<any>(`/behavior/groups/${id}/membership`, { method: 'DELETE' });
export const getBehaviorToday = () => apiCall<any>('/behavior/today');
export const getBehaviorOutcomes = () => apiCall<any[]>('/behavior/outcomes');
export const getBehaviorSettings = () => apiCall<any>('/behavior/settings');
export const updateBehaviorSettings = (data: any) =>
  apiCall<any>('/behavior/settings', { method: 'PUT', body: JSON.stringify(data) });
export const getBehaviorTechniques = () => apiCall<any[]>('/behavior/techniques');
export const createBehaviorPlan = (data: { behavior: string; goal_text?: string; baseline_value?: number; goal_value?: number }) =>
  apiCall<any>('/behavior/plans', { method: 'POST', body: JSON.stringify(data) });
export const stopBehaviorPlan = (id: number) =>
  apiCall<any>(`/behavior/plans/${id}`, { method: 'DELETE' });
export const checkInBehaviorAction = (id: number, data: { status?: string; value_done?: number; barrier?: string }) =>
  apiCall<any>(`/behavior/actions/${id}/checkin`, { method: 'POST', body: JSON.stringify(data) });
export const syncBehaviorWearable = () => apiCall<any>('/behavior/sync-wearable', { method: 'POST' });
export const seedBehaviorDemo = () => apiCall<any>('/behavior/demo/seed', { method: 'POST' });
export const deleteBehaviorData = () => apiCall<any>('/behavior/my-data', { method: 'DELETE' });
export const getGoals = () => apiCall<any>('/behavior/goals');
export const applyGoals = (ids: string[]) => apiCall<any>('/behavior/goals/apply', { method: 'POST', body: JSON.stringify({ ids }) });
export const getReminderPlan = () => apiCall<any>('/behavior/reminder-plan');
export const setReminderSettings = (mode: 'auto' | 'off' | 'fixed', hour?: number) => apiCall<any>('/behavior/reminder-settings', { method: 'PUT', body: JSON.stringify({ mode, hour }) });
export const getComeback = (barrier?: string) => apiCall<any>(`/behavior/comeback${barrier ? `?barrier=${barrier}` : ''}`);
export const chooseComeback = (barrier: string, option: string, when?: string) => apiCall<any>('/behavior/comeback', { method: 'POST', body: JSON.stringify({ barrier, option, when }) });
export const getAgentLoop = () => apiCall<any>('/agent/loop');
export const actAgent = (action: 'smaller' | 'stop_messages' | 'not_helpful') => apiCall<any>('/agent/act', { method: 'POST', body: JSON.stringify({ action }) });

// ---- Assistant and live vitals ----
export interface AssistantMessage {
  id: number; role: 'user' | 'assistant'; content: string; emergency: boolean; source: string; created_at: string | null;
}
export const getAssistantHistory = (limit = 50) => apiCall<AssistantMessage[]>(`/assistant/history?limit=${limit}`);
export const sendAssistantMessage = (content: string) =>
  apiCall<{ user: AssistantMessage; assistant: AssistantMessage; suggestions: string[] }>('/assistant/message', { method: 'POST', body: JSON.stringify({ content }) });
export const getAssistantSuggestions = () => apiCall<{ suggestions: string[]; ai: boolean }>('/assistant/suggestions');

/**
 * Sends a message and receives the answer as it is being written (server-sent events). Words reach `onToken` within about a second,
 * instead of the whole reply arriving after the full wait. Throws before any word arrives if the stream cannot start, so the caller
 * can use sendAssistantMessage instead.
 */
export async function streamAssistantMessage(content: string, on: {
  onMeta?: (user: AssistantMessage) => void;
  onToken: (text: string) => void;
  onDone: (assistant: AssistantMessage, suggestions: string[]) => void;
}, signal?: AbortSignal): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { fetch: streamFetch } = require('expo/fetch');
  const token = await getAuthToken();
  const res = await streamFetch(`${BASE_URL}/assistant/stream`, {
    method: 'POST', signal,
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream', Authorization: `Bearer ${token}`, ...(BASE_URL.includes('ngrok') ? { 'ngrok-skip-browser-warning': 'true' } : {}) },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) {
    let detail = '';
    try { detail = (await res.json()).detail; } catch { /* no body */ }
    throw Object.assign(new Error(typeof detail === 'string' && detail ? detail : `Could not send (${res.status})`), { status: res.status });
  }
  if (!res.body) throw new Error('Streaming is not supported here');
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '', finished = false;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let cut: number;
    while ((cut = buffer.indexOf('\n\n')) !== -1) {
      const block = buffer.slice(0, cut); buffer = buffer.slice(cut + 2);
      const line = block.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      let ev: any; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
      if (ev.type === 'meta') on.onMeta?.(ev.user);
      else if (ev.type === 'token') on.onToken(ev.text);
      else if (ev.type === 'done') { finished = true; on.onDone(ev.assistant, ev.suggestions || []); }
    }
  }
  if (!finished) throw new Error('The answer was cut short');
}

// ---- HUAWEI Health, connected directly (Health Kit cloud API) ----
export interface HuaweiStatus { configured: boolean; linked: boolean; last_sync_at: string | null; last_error: string | null; redirect_uri: string | null }
export const getHuaweiStatus = () => apiCall<HuaweiStatus>('/huawei/status');
export const connectHuawei = () => apiCall<{ url: string }>('/huawei/connect', { method: 'POST' });
export const syncHuawei = () => apiCall<{ steps: number | null; errors: string[]; stored: string[]; last_sync_at: string | null }>('/huawei/sync', { method: 'POST' });
export const disconnectHuawei = () => apiCall<{ linked: boolean }>('/huawei/link', { method: 'DELETE' });

// ---- AI summaries ----
export interface AiInsights {
  headline: string; next_step: string; source: 'ai' | 'summary'; generated_at: string; based_on?: string;
  insights: { title: string; detail: string; tone: 'good' | 'watch' | 'neutral' }[];
}
export const getAiInsights = (refresh = false) => apiCall<AiInsights>(`/ai/insights${refresh ? '?refresh=true' : ''}`);
export const clearAssistantHistory = () => apiCall<{ deleted: number }>('/assistant/history', { method: 'DELETE' });
export interface LiveVitals {
  is_live: boolean; age_seconds: number | null;
  latest: { heart_rate: number | null; blood_oxygen: number | null; blood_pressure_systolic?: number | null; blood_pressure_diastolic?: number | null; is_emergency?: boolean; timestamp: string } | null;
  history: { t: string; hr: number | null; spo2: number | null; bp_sys?: number | null; bp_dia?: number | null; is_emergency?: boolean }[];
}
export const getLiveVitals = (minutes = 10) => apiCall<LiveVitals>(`/vitals/live?minutes=${minutes}`);
export const getVitalsSummary = (days = 7) => apiCall<{ days: number; readings: any[]; alert_count: number }>(`/vitals/summary?days=${days}`);
export const ingestVitals = (data: {
  device_id: string;
  device_name?: string;
  heart_rate?: number | null;
  blood_oxygen?: number | null;
  steps?: number | null;
  blood_pressure_systolic?: number | null;
  blood_pressure_diastolic?: number | null;
  measured_at?: string | null;      // when the device took the reading; without it the server uses its own clock
  calories?: number | null; active_minutes?: number | null; distance_m?: number | null; steps_source?: string | null;   // today's totals from the watch
}) => {
  return apiCall<{ ok: boolean; alert_reasons: string[] }>('/vitals/ingest', { method: 'POST', body: JSON.stringify(data) });
};
export type AccessibilitySettings = {
  fontSize: number; contrast: 'default' | 'high' | 'dark' | 'yellow' | 'sepia'; colorBlind: string;
  grayscale: boolean; saturation: number; dimmer: number; zoom: number; hideImages: boolean;
  boldText: boolean; underlineLinks: boolean; highlightLinks: boolean; stopAnimations: boolean;
  readingGuide: boolean; keyboardNavigation: boolean; screenReader: boolean; language: string;
};
export const getAccessibilityPreferences = () =>
  apiCall<{ settings: AccessibilitySettings }>('/accessibility/preferences');
export const updateAccessibilityPreferences = (settings: AccessibilitySettings) =>
  apiCall<{ settings: AccessibilitySettings }>('/accessibility/preferences', {
    method: 'PUT', body: JSON.stringify(settings),
  });

// ---- Emergency, risk, meals and medicines ----
export interface SosEvent {
  id: number; user_id: number; patient_name: string; trigger: 'manual' | 'auto_vitals'; reason: string; severity: string;
  status: 'pending' | 'active' | 'acknowledged' | 'escalated' | 'cancelled' | 'resolved';
  attempts: number; max_attempts: number; vitals?: any; created_at: string | null; grace_until: string | null;
  next_action_at: string | null; acknowledged_by: number | null; escalated_at: string | null;
  lat: number | null; lng: number | null; location_url: string | null; dispatch_mode: string; emergency_number: string;
  patient_phone: string | null; timeline?: { at: string | null; kind: string; detail: string }[];
}
export const getEmergencyConfig = () => apiCall<{ emergency_number: string; dispatch_mode: string; simulation: boolean; grace_seconds: number; ack_wait_seconds: number; max_attempts: number }>('/emergency/config');
export const sendSos = (reason?: string, grace_seconds?: number) =>
  apiCall<SosEvent>('/emergency/sos', { method: 'POST', body: JSON.stringify({ reason, grace_seconds }) });
export const getActiveEmergencies = () => apiCall<{ mine: SosEvent | null; patients: SosEvent[] }>('/emergency/active');
export const getEmergency = (id: number) => apiCall<SosEvent>(`/emergency/${id}`);
export const ackEmergency = (id: number) => apiCall<SosEvent>(`/emergency/${id}/ack`, { method: 'POST' });
export const cancelEmergency = (id: number) => apiCall<SosEvent>(`/emergency/${id}/cancel`, { method: 'POST' });
export const resolveEmergency = (id: number) => apiCall<SosEvent>(`/emergency/${id}/resolve`, { method: 'POST' });
export const shareEmergencyLocation = (id: number, lat: number, lng: number, accuracy?: number | null) =>
  apiCall<{ ok: boolean }>(`/emergency/${id}/location`, { method: 'POST', body: JSON.stringify({ lat, lng, accuracy }) });
export const simulateCriticalVitals = (v: { heart_rate?: number; blood_oxygen?: number; systolic?: number; diastolic?: number }) =>
  apiCall<SosEvent>('/emergency/simulate-vitals', { method: 'POST', body: JSON.stringify(v) });

export interface RiskFactor { key: string; label: string; detail: string; points: number }
export interface RiskSummary {
  tier: 'low' | 'moderate' | 'high' | 'urgent'; label: string; score: number; summary: string; factors: RiskFactor[];
  missing: string[]; anomalies: { key: string; label: string; detail: string }[]; method: string; disclaimer: string;
}
export interface Recommendation { id: string; priority: number; title: string; why: string; action: string; route: string }
export const getRiskSummary = () => apiCall<RiskSummary>('/risk/summary');
export const getRiskRecommendations = () => apiCall<{ tier: string; items: Recommendation[]; disclaimer: string }>('/risk/recommendations');
export const getPatientsRisk = () => apiCall<any[]>('/risk/patients');

export interface FoodSummary { id: string; name: string; aka: string[]; serving: string; kcal: number; gi: string; tags: string[] }
export interface MealAssessment { diet_score: number; warning_level: 'low' | 'medium' | 'high'; concerns: string[]; positives: string[]; advice: string; portion_note: string }
export interface MealNutrients { kcal: number; carbs: number; protein: number; fat: number; fibre: number; sodium_mg: number; calories: number }
export const searchFoods = (q: string) => apiCall<{ items: FoodSummary[]; portions: string[]; note: string }>(`/meals/foods?q=${encodeURIComponent(q)}`);
export interface MealCoach { tone: 'danger' | 'warning' | 'success' | 'info'; headline: string; message: string; based_on: string[] }
export const getFoodDetail = (id: string, portion: string) =>
  apiCall<FoodSummary & { portion: string; nutrients: MealNutrients; assessment: MealAssessment; coach: MealCoach }>(`/meals/foods/${id}?portion=${portion}`);
export const identifyMealPhoto = (form: FormData) =>
  uploadFileToBackend('/meals/identify', form) as Promise<{ provider: string; candidates: { id: string; name: string; confidence: number }[]; suggestions: FoodSummary[]; note: string; notice: string }>;
export const logMeal = (dish_id: string, portion: string, meal_type: string) =>
  apiCall<{ id: number; nutrients: MealNutrients; assessment: MealAssessment; today: { calories: number; target: number; percent: number; meals: any[] } }>(
    '/meals/log', { method: 'POST', body: JSON.stringify({ dish_id, portion, meal_type }) });
export interface MealsToday {
  calories: number; target: number; percent: number; meals: { id: number; meal_type: string; name: string; calories: number; diet_score: number | null }[];
  macros: { carbs_g: number; protein_g: number; fat_g: number; fibre_g: number; sodium_mg: number; kcal_from: { carbs: number; protein: number; fat: number } };
}
export const getMealsToday = () => apiCall<MealsToday>('/meals/today');
export interface HeatDayData { date: string; weekday: number; score: number | null }
export const getBehaviorHeatmap = (weeks = 8) => apiCall<{ weeks: number; start: string; days: HeatDayData[] }>(`/behavior/heatmap?weeks=${weeks}`);

export interface MedDose { medication_id: number; name: string; dose: string | null; time: string; status: 'pending' | 'overdue' | 'taken' | 'skipped' }
export const getMedications = () => apiCall<{ id: number; name: string; dose: string | null; times: string[]; notes: string | null }[]>('/medications');
export const addMedication = (data: { name: string; dose?: string; times: string[]; notes?: string }) =>
  apiCall<any>('/medications', { method: 'POST', body: JSON.stringify(data) });
export const removeMedication = (id: number) => apiCall<{ removed: boolean }>(`/medications/${id}`, { method: 'DELETE' });
export const getMedicationsToday = () => apiCall<{ date: string; doses: MedDose[]; taken: number; total: number; weekly_adherence: number | null }>('/medications/today');
export const logDose = (id: number, time: string, status: 'taken' | 'skipped') =>
  apiCall<{ ok: boolean }>(`/medications/${id}/log`, { method: 'POST', body: JSON.stringify({ time, status }) });

// ---- Learning, privacy centre, wellbeing and clinician summary ----
export interface LearningInsights {
  plans: { plan_id: number; behavior: string; days_of_data: number; learning: boolean; learned: string[];
    by_weekday: { day: string; n: number; rate: number | null }[]; by_technique: { technique: string; n: number; rate: number }[]; overall_rate: number | null }[];
  min_days_for_insights: number; how: string;
}
export const getBehaviorInsights = () => apiCall<LearningInsights>('/behavior/insights');

export interface PrivacyAccess {
  people: { relationship_id: number; name: string; relationship: string; status: string; since: string | null }[];
  emergency_contacts: { name: string; relationship: string; note: string }[];
  can_see: string[]; never_shared: string[]; employers_and_insurers: string;
}
export const getPrivacyAccess = () => apiCall<PrivacyAccess>('/privacy/access');
export const revokeAccess = (relationshipId: number) => apiCall<{ revoked: boolean }>(`/privacy/access/${relationshipId}/revoke`, { method: 'POST' });
export const getAccessLog = () => apiCall<{ items: { id: number; viewer: string; role: string; what: string; at: string | null }[] }>('/privacy/log');
export const exportMyData = () => apiCall<any>('/privacy/export');
export const deleteMyAccount = (password: string, confirm: string) =>
  apiCall<{ deleted: boolean }>('/privacy/delete-account', { method: 'POST', body: JSON.stringify({ password, confirm }) });

export interface WellbeingQuestionnaire {
  stem: string; items: { id: string; scale: string; text: string }[]; options: { value: number; label: string }[]; safety_question: string; cutoff: number; note: string;
}
export interface WellbeingStep { level: string; title: string; text: string; eligibility: string }
export interface WellbeingSummary { history: { id: number; at: string | null; phq2: number; gad2: number; total: number }[]; trend: string | null; link: string | null; count: number }
export interface WellbeingResult {
  phq2: number; gad2: number; band: 'low' | 'elevated' | 'high'; screen_positive: boolean; crisis: boolean; headline: string;
  next_steps: WellbeingStep[]; disclaimer: string; summary: WellbeingSummary;
}
export const getWellbeingQuestionnaire = () => apiCall<WellbeingQuestionnaire>('/wellbeing/questionnaire');
export const getWellbeingDue = () => apiCall<{ due: boolean; last_at: string | null }>('/wellbeing/due');
export const submitWellbeing = (answers: number[], safety: boolean) =>
  apiCall<WellbeingResult>('/wellbeing/checkin', { method: 'POST', body: JSON.stringify({ answers, safety }) });
export const getWellbeingSummary = () => apiCall<WellbeingSummary>('/wellbeing/summary');
export const askCareTeamForSupport = () => apiCall<{ notified: number; message: string }>('/wellbeing/ask-for-support', { method: 'POST' });

export const getClinicianSummary = (days = 30, includeWellbeing = false) =>
  apiCall<{ text: string; period_days: number; patient: { name: string } }>(`/reports/clinician-summary?days=${days}&include_wellbeing=${includeWellbeing}`);

// ---- Activity, leaderboard and community ----
export type WorkoutKind = 'run' | 'walk' | 'cycle';
export interface WorkoutBrief {
  id: number; kind: WorkoutKind; started_at: string; duration_s: number; distance_m: number; calories: number;
  avg_pace_s_km: number | null; steps: number | null; flagged: boolean;
}
export interface WorkoutFull extends WorkoutBrief {
  avg_hr: number | null; max_hr: number | null; fastest_pace_s_km: number | null; route: number[][] | null;
  splits: { km: number; pace_s: number; partial: boolean; distance_m?: number }[] | null; source: string; flag_note: string | null; new_achievements?: string[];
  hr_source?: "workout" | "vitals" | null; cadence_spm?: number | null; estimate?: { distance_m: number; avg_pace_s_km: number | null; basis: string } | null;
}
export interface ActivitySummary {
  date: string; rings: { steps: { value: number; goal: number }; calories: { value: number; goal: number; estimated?: boolean }; minutes: { value: number; goal: number; estimated?: boolean } };
  distance_m?: number | null; steps_source?: string | null; apple_health_synced_at?: string | null;
  streak_days: number; latest_workout: WorkoutBrief | null; weight: { kg: number; at: string; target_kg: number | null } | null;
  heart_rate: { bpm: number; at: string } | null; sleep: { total_min: number; score: number | null; end: string } | null; estimates_note: string;
}
export const getActivitySummary = () => apiCall<ActivitySummary>('/activity/summary');
export const getActivityGoals = () => apiCall<{ steps: number; calories: number; active_minutes: number; target_weight_kg: number | null }>('/activity/goals');
export const setActivityGoals = (g: { steps?: number; calories?: number; active_minutes?: number; target_weight_kg?: number }) =>
  apiCall<any>('/activity/goals', { method: 'PUT', body: JSON.stringify(g) });
export const syncSteps = (steps: number, date?: string) =>
  apiCall<{ steps: number; new_achievements: string[] }>('/activity/steps', { method: 'POST', body: JSON.stringify({ steps, date }) });
export const createWorkout = (w: { kind: WorkoutKind; started_at: string; duration_s: number; distance_m?: number; steps?: number; avg_hr?: number; max_hr?: number; route?: number[][]; source?: string }) =>
  apiCall<WorkoutFull>('/activity/workouts', { method: 'POST', body: JSON.stringify(w) });
export const listWorkouts = (limit = 20) => apiCall<WorkoutBrief[]>(`/activity/workouts?limit=${limit}`);
export const getWorkout = (id: number) => apiCall<WorkoutFull>(`/activity/workouts/${id}`);
export const deleteWorkout = (id: number) => apiCall<{ deleted: boolean }>(`/activity/workouts/${id}`, { method: 'DELETE' });
export interface WeightReport {
  report: string; points: { id: number; at: string; kg: number }[]; buckets: { label: string; avg_kg: number; n: number }[];
  stats: { count: number; first_kg?: number; latest_kg?: number; change_kg?: number; slope_kg_per_week?: number | null; trend?: string | null; bmi?: number; target_kg?: number; to_go_kg?: number; goal_progress?: number; notes?: string[] };
}
export const addWeight = (kg: number) => apiCall<{ id: number; kg: number }>('/activity/weight', { method: 'POST', body: JSON.stringify({ kg }) });
export const deleteWeight = (id: number) => apiCall<{ deleted: boolean }>(`/activity/weight/${id}`, { method: 'DELETE' });
export const getWeightReport = (report: 'weekly' | 'monthly') => apiCall<WeightReport>(`/activity/weight?report=${report}`);
export interface SleepNight {
  id: number; start: string; end: string; total_min: number; asleep_min: number; awake_min: number; light_min: number; deep_min: number; rem_min: number;
  score: number | null; stages: { stage: 'awake' | 'light' | 'deep' | 'rem'; start: string; end: string }[] | null; has_stages: boolean; source: string;
}
export interface SleepReport { nights: SleepNight[]; last: SleepNight | null; avg_hours: number | null; avg_deep_pct: number | null; avg_awake_pct: number | null; bedtime_spread_min: number | null; advice: string[]; stage_note: string | null }
export const logSleep = (b: { start: string; end: string; stages?: { stage: string; start: string; end: string }[]; source?: string }) =>
  apiCall<SleepNight>('/activity/sleep', { method: 'POST', body: JSON.stringify(b) });
export const getSleepReport = (days = 14) => apiCall<SleepReport>(`/activity/sleep?days=${days}`);
export const getKnowledge = () => apiCall<{ items: { id: string; title: string; topic: string; summary: string; body: string[] }[]; note: string }>('/activity/knowledge');

export type BoardCategory = 'steps' | 'distance' | 'minutes' | 'points';
export type BoardPeriod = 'today' | 'week' | 'month';
export interface BoardRow { rank: number; participant_id: number; name: string; value: number; is_me: boolean }
export interface Board { category: string; label: string; period: string; participants: number; rows: BoardRow[]; me: BoardRow | null; podium: BoardRow[]; updated_at: string }
export interface CompetitionMe { joined_community: boolean; on_leaderboard: boolean; display_name: string | null; suggested_name: string; rules: string[]; visible_to_others: string[]; never_visible: string[] }
export const getCompetitionMe = () => apiCall<CompetitionMe>('/competition/me');
export const joinLeaderboard = (display_name: string | undefined, accept_rules: boolean) =>
  apiCall<CompetitionMe>('/competition/join', { method: 'POST', body: JSON.stringify({ display_name, accept_rules }) });
export const leaveLeaderboard = () => apiCall<CompetitionMe>('/competition/leave', { method: 'POST' });
export const getBoard = (category: BoardCategory, period: BoardPeriod, q = '') =>
  apiCall<Board>(`/competition/board?category=${category}&period=${period}&q=${encodeURIComponent(q)}`);
export const getAchievements = () => apiCall<{ items: { key: string; title: string; description: string; icon: string; earned: boolean; earned_at: string | null }[] }>('/competition/achievements');

export interface CommunityPost {
  id: number; category: 'discussion' | 'tip' | 'marketplace'; title: string | null; body: string; image_url: string | null; image_urls: string[]; product_category: string | null;
  price: number | null; currency: string; contact_phone: string | null; author: string; mine: boolean; status: string; created_at: string | null;
  likes: number; comments: number; liked: boolean; support_notice?: string; comment_list?: { id: number; body: string; author: string; mine: boolean; created_at: string | null }[];
}
export interface CommunityMe { joined: boolean; display_name: string | null; suggested_name: string; rules: string[]; product_categories: string[]; disclaimer: string }
export interface CommunityReview {
  id: number; title: string; body: string; rating: number; author: string; mine: boolean; created_at: string | null; edited?: boolean;
}
export interface ReviewsResult { items: CommunityReview[]; count: number; average: number | null; distribution: Record<string, number>; mine: CommunityReview | null }
export const getCommunityMe = () => apiCall<CommunityMe>('/community/me');
export const joinCommunity = (display_name: string | undefined, accept_rules: boolean) =>
  apiCall<CommunityMe>('/community/join', { method: 'POST', body: JSON.stringify({ display_name, accept_rules }) });
export const getFeed = (category?: string, beforeId?: number, group?: string) =>
  apiCall<{ items: CommunityPost[]; next_before_id: number | null; disclaimer: string }>(`/community/posts?limit=15${category ? `&category=${category}` : ''}${group ? `&group=${group}` : ''}${beforeId ? `&before_id=${beforeId}` : ''}`);
export const createPost = async (form: FormData): Promise<CommunityPost> => {
  try { return (await uploadFileToBackend('/community/posts', form)) as CommunityPost; }
  catch (e: any) { let msg = e.message; try { const j = JSON.parse(msg); msg = typeof j.detail === 'string' ? j.detail : 'Could not post'; } catch { /* keep message */ } throw new Error(msg); }
};
export const getPost = (id: number) => apiCall<CommunityPost>(`/community/posts/${id}`);
export const commentOnPost = (id: number, body: string) => apiCall<any>(`/community/posts/${id}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
export const toggleLike = (id: number) => apiCall<{ liked: boolean; likes: number }>(`/community/posts/${id}/like`, { method: 'POST' });
export const deletePost = (id: number) => apiCall<{ deleted: boolean }>(`/community/posts/${id}`, { method: 'DELETE' });
export const deleteComment = (id: number) => apiCall<{ deleted: boolean }>(`/community/comments/${id}`, { method: 'DELETE' });
export const reportPost = (id: number, reason: string) => apiCall<{ reported: boolean; hidden: boolean }>(`/community/posts/${id}/report`, { method: 'POST', body: JSON.stringify({ reason }) });
export const getCommunityReviews = (limit = 20) => apiCall<ReviewsResult>(`/community/reviews?limit=${limit}`);
export const createCommunityReview = (data: { title: string; body: string; rating: number }) =>
  apiCall<CommunityReview>('/community/reviews', { method: 'POST', body: JSON.stringify(data) });
export const deleteMyReview = () => apiCall<{ deleted: boolean }>('/community/reviews/mine', { method: 'DELETE' });

// ---- Wellbeing hub: challenges, score, library, interest groups
export interface ChallengeCard {
  key: string; title: string; tagline: string; image: string | null; icon: string; unit: string; target: number; domain: string; about: string; joined: boolean; members: number | null; days_left: number;
  value?: number; percent?: number; done?: boolean; daily?: (number | null)[] | null; week_start?: string;
}
export interface ChallengeList { week_start: string; days_left: number; items: ChallengeCard[]; completed: number }
export interface ChallengeBoard { key: string; target: number; unit: string; members: number; me_opted_in: boolean; rows: { name: string; value: number; rank: number; percent: number; is_me: boolean }[] }
export interface WellbeingDomain { key: string; label: string; weight: number; has_data: boolean; value: number | null; detail: string; improve: string }
export interface WellbeingScore { score: number | null; band: string | null; domains: WellbeingDomain[]; parts_used: number; message: string | null; note: string; method: string }
export interface Article { key: string; category: string; category_label: string; title: string; summary: string; minutes: number; featured: boolean; image?: string | null; for_you?: boolean; read?: boolean; saved?: boolean; body?: string[]; notice?: string }
export interface InterestGroup { key: string; title: string; icon: string; about: string; image: string | null; joined: boolean; members: number | null }
export const getChallenges = () => apiCall<ChallengeList>('/explore/challenges');
export const getChallenge = (key: string) => apiCall<{ challenge: ChallengeCard; board: ChallengeBoard }>(`/explore/challenges/${key}`);
export const joinChallenge = (key: string) => apiCall<ChallengeList>(`/explore/challenges/${key}/join`, { method: 'POST' });
export const leaveChallenge = (key: string) => apiCall<ChallengeList>(`/explore/challenges/${key}/leave`, { method: 'POST' });
export const getWellbeingScore = () => apiCall<WellbeingScore>('/explore/score');
export const getLibrary = (category?: string, q = '') =>
  apiCall<{ categories: { key: string; label: string }[]; items: Article[]; notice: string }>(`/explore/library?q=${encodeURIComponent(q)}${category ? `&category=${category}` : ''}`);
export const getArticle = (key: string) => apiCall<Article>(`/explore/library/${key}`);
export const markArticleRead = (key: string) => apiCall<{ read: boolean }>(`/explore/library/${key}/read`, { method: 'POST' });
export const toggleArticleSave = (key: string) => apiCall<{ saved: boolean }>(`/explore/library/${key}/save`, { method: 'POST' });
export const getGroups = () => apiCall<{ items: InterestGroup[] }>('/explore/groups');
export const joinGroup = (key: string) => apiCall<{ items: InterestGroup[] }>(`/explore/groups/${key}/join`, { method: 'POST' });
export const leaveGroup = (key: string) => apiCall<{ items: InterestGroup[] }>(`/explore/groups/${key}/leave`, { method: 'POST' });

export default {
  invalidateApiCache,
  testConnection,
  systemHealthCheck,
  signupPatient,
  signupCaregiver,
  login,
  forgotPassword,
  resetPassword,
  resetPasswordWithCode,
  verifyEmailCode,
  verifyEmail,
  resendVerification,
  requestOTP,
  verifyOTP,
  guestLogin,
  changePassword,
  logout,
  getCurrentUser,
  refreshToken,
  getUserSessions,
  revokeSession,
  googleLogin,
  googleCallback,
  googleTokenAuth,
  getProfile,
  updateProfile,
  uploadProfileImage,
  getProfileImage,
  getCurrentUserInfo,
  searchUsers,
  getEmergencyContacts,
  addEmergencyContact,
  deleteEmergencyContact,
  getHealthDashboard,
  getHealthSnapshot,
  addHealthData,
  getWeeklyProgress,
  getFoodLogs,
  logFood,
  updateWeeklyProgress,
  getNotifications,
  markNotificationRead,
  getUnreadCount,
  getCaregiverProfile,
  updateCaregiverProfile,
  getCaregiverDashboard,
  getCaregiverMyId,
  getAssignedPatients,
  getMyCaregivers,
  requestPatientAccess,
  connectWithPatient,
  connectWithCaregiver,
  getIncomingCaregiverRequests,
  respondCaregiverRequest,
  getPatientStatistics,
  getCarePatientOverview,
  getMyDoctor,
  getDoctorRequests,
  answerDoctorRequest,
  linkMyDoctor,
  unlinkMyDoctor,
  importWeightFromHealth,
  importSleepFromHealth,
  getDoctorThread,
  getCareTeam,
  getCareNotes,
  addCareNote,
  deleteCareNote,
  getDoctorAppointments,
  requestDoctorAppointment,
  cancelDoctorAppointment,
  getDoctorPrescriptions,
  getDoctorNotes,
  registerPushToken,
  unregisterPushToken,
  getIceServers,
  sendDoctorMessage,
  markDoctorThreadRead,
  getCaregiverTasks,
  getTodaysTasks,
  getOverdueTasks,
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  getCaregiverAppointments,
  getTodaysAppointments,
  getUpcomingAppointments,
  getCalendarView,
  createAppointment,
  updateAppointment,
  cancelAppointment,
  completeAppointment,
  getPatientAnalytics,
  getComparativeAnalytics,
  getWeeklyLeaderboard,
  getUserProgressHistory,
  getUserAchievements,
  analyzeMeal,
  getDailyTip,
  getRecentMeals,
  logMealManual,
  doctorLogin,
  getDoctorProfile,
  getDoctorDashboard,
  getDoctorPatients,
  adminLogin,
  createDoctor,
  listDoctors,
  getAuthToken,
  getUserId,
  getUserType,
  saveAuthData,
  clearAuthData,
  chatWithBot,
  testAI,
  removePatientConnection,
  getBehaviorToday,
  getBehaviorContext,
  updateBehaviorContext,
  getBehaviorRecommendations,
  getBehaviorApproaches,
  getBehaviorNudges,
  exportBehaviorData,
  getBehaviorSupporters,
  getBehaviorShares,
  shareBehaviorPlan,
  stopBehaviorShare,
  getBehaviorSupporting,
  sendBehaviorCheer,
  getBehaviorCheers,
  getBehaviorGroups,
  createBehaviorGroup,
  joinBehaviorGroup,
  leaveBehaviorGroup,
  getBehaviorOutcomes,
  getBehaviorSettings,
  updateBehaviorSettings,
  getBehaviorTechniques,
  createBehaviorPlan,
  stopBehaviorPlan,
  checkInBehaviorAction,
  syncBehaviorWearable,
  seedBehaviorDemo,
  deleteBehaviorData,
  getGoals,
  applyGoals,
  getReminderPlan,
  setReminderSettings,
  getComeback,
  chooseComeback,
  getAgentLoop,
  actAgent,
  getAssistantHistory,
  getAssistantSuggestions,
  streamAssistantMessage,
  getAiInsights,
  getHuaweiStatus,
  connectHuawei,
  syncHuawei,
  disconnectHuawei,
  sendAssistantMessage,
  clearAssistantHistory,
  getLiveVitals,
  getVitalsSummary,
  ingestVitals,
  getAccessibilityPreferences,
  updateAccessibilityPreferences,
  getEmergencyConfig,
  sendSos,
  getActiveEmergencies,
  getEmergency,
  ackEmergency,
  cancelEmergency,
  resolveEmergency,
  shareEmergencyLocation,
  simulateCriticalVitals,
  getRiskSummary,
  getRiskRecommendations,
  getPatientsRisk,
  searchFoods,
  getFoodDetail,
  identifyMealPhoto,
  logMeal,
  getMealsToday,
  getMedications,
  addMedication,
  removeMedication,
  getMedicationsToday,
  logDose,
  getBehaviorInsights,
  getPrivacyAccess,
  revokeAccess,
  getAccessLog,
  exportMyData,
  deleteMyAccount,
  getWellbeingQuestionnaire,
  getWellbeingDue,
  submitWellbeing,
  getWellbeingSummary,
  askCareTeamForSupport,
  getClinicianSummary,
  getBehaviorHeatmap,
  getActivitySummary,
  getActivityGoals,
  setActivityGoals,
  syncSteps,
  createWorkout,
  listWorkouts,
  getWorkout,
  deleteWorkout,
  deleteWeight,
  addWeight,
  getWeightReport,
  logSleep,
  getSleepReport,
  getKnowledge,
  getCompetitionMe,
  joinLeaderboard,
  leaveLeaderboard,
  getBoard,
  getAchievements,
  getCommunityMe,
  joinCommunity,
  getFeed,
  createPost,
  getPost,
  commentOnPost,
  toggleLike,
  deletePost,
  deleteComment,
  reportPost,
  getCommunityReviews,
  createCommunityReview,
  deleteMyReview,
  getChallenges,
  getChallenge,
  joinChallenge,
  leaveChallenge,
  getWellbeingScore,
  getLibrary,
  getArticle,
  markArticleRead,
  toggleArticleSave,
  getGroups,
  joinGroup,
  leaveGroup,
};