import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

const getBaseUrl = () => {
  if (process.env.EXPO_PUBLIC_BASE_URL) return process.env.EXPO_PUBLIC_BASE_URL;

  const prodUrl = 'https://hewal3-backend-api-aya3dzgefte4b3c3.southafricanorth-01.azurewebsites.net';
  if (process.env.NODE_ENV === 'production') return prodUrl;
  const debuggerHost = Constants.expoConfig?.hostUri;
  const localhost = debuggerHost?.split(':')[0];
  if (!localhost) return 'http://localhost:8000';
  return `http://${localhost}:8000`;
};

const BASE_URL = getBaseUrl();
console.log('🔗 API BASE_URL:', BASE_URL);

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
  score: number;
  message: string;
  trend_percentage: number;
}

export interface DashboardData {
  daily_score: DailyScore;
  activity_rings: ActivityRing;
  trends: HealthTrend[];
  categories: HealthCategory[];
  daily_tip?: string;
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
  await AsyncStorage.multiRemove([
    'access_token', 'refresh_token', 'user_id', 'user_type',
    'email', 'username', 'full_name', 'profile_image'
  ]);
}

async function apiCall<T>(
  endpoint: string,
  options: RequestInit = {},
  requiresAuth: boolean = true
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;

  console.log(`🌐 API Request: ${endpoint}`);

  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (!isFormData && options.method !== 'GET') {
    headers['Content-Type'] = 'application/json';
  }

  if (requiresAuth) {
    const token = await getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log(`🔑 Using auth token: ${token.substring(0, 20)}...`);
    }
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    const response = await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const contentType = response.headers.get('content-type');
    let responseData;

    if (contentType && contentType.includes('application/json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    console.log(`📥 Response status: ${response.status} for ${endpoint}`);

    if (!response.ok) {
      // Handle authentication errors
      if (response.status === 401 && requiresAuth) {
        console.warn('🔒 Authentication failed - token may be expired');
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
      console.error(`❌ API Error (${endpoint}):`, errorMessage);
      throw error;
    }

    console.log(`✅ API Success (${endpoint})`);
    return responseData as T;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`⏰ API Timeout (${endpoint}): Request took too long`);
      throw new Error('Network request timed out. Please check your connection.');
    }

    console.error(`❌ API Fetch Error (${endpoint}):`, error.message);

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
  apiCall('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }, false);

export const resetPassword = (token: string, new_password: string) =>
  apiCall('/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, new_password }) }, false);

export const verifyEmail = (token: string) =>
  apiCall('/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) }, false);

export const resendVerification = (email: string) =>
  apiCall('/auth/resend-verification', { method: 'POST', body: JSON.stringify({ email }) }, false);

export const requestOTP = (email: string) =>
  apiCall('/auth/login/otp/request', { method: 'POST', body: JSON.stringify({ email }) }, false);

export const verifyOTP = (email: string, otp: string) =>
  apiCall('/auth/login/otp/verify', { method: 'POST', body: JSON.stringify({ email, otp }) }, false);

export const changePassword = (current: string, newPass: string) =>
  apiCall('/auth/change-password', { method: 'POST', body: JSON.stringify({ current_password: current, new_password: newPass }) });

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

export const getDailyTip = () =>
  apiCall<DailyTipResponse>('/api/daily-tip');

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
  try {
    return await apiCall<AssignedPatient[]>('/caregivers/patients');
  } catch (error: any) {
    console.warn('⚠️ getAssignedPatients error, using fallback data:', error.message);
    // Return mock data as fallback
    return [
      {
        id: 1,
        patient_id: 'P001',
        patient_name: 'John Doe',
        email: 'john@example.com',
        age: 65,
        gender: 'male',
        status: 'stable',
        relationship_type: 'family_member',
        last_checkup: new Date().toISOString(),
        health_score: 85,
        conditions: [],
        assigned_at: new Date().toISOString()
      },
      {
        id: 2,
        patient_id: 'P002',
        patient_name: 'Jane Smith',
        email: 'jane@example.com',
        age: 72,
        gender: 'female',
        status: 'critical',
        relationship_type: 'professional',
        last_checkup: new Date().toISOString(),
        health_score: 65,
        conditions: ['hypertension', 'diabetes'],
        assigned_at: new Date().toISOString()
      }
    ];
  }
};

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

export const getPatientStatistics = () =>
  apiCall<PatientStats>('/caregivers/patients/stats');

export const getCaregiverTasks = () =>
  apiCall<CaregiverTask[]>('/caregivers/tasks');

export const getTodaysTasks = () =>
  apiCall<CaregiverTask[]>('/caregivers/tasks/today');

export const getOverdueTasks = () =>
  apiCall<CaregiverTask[]>('/caregivers/tasks/overdue');

export const createTask = (data: CreateTaskRequest) =>
  apiCall('/caregivers/tasks', { method: 'POST', body: JSON.stringify(data) });

export const updateTask = (taskId: number, data: Partial<CreateTaskRequest>) =>
  apiCall(`/caregivers/tasks/${taskId}`, { method: 'PUT', body: JSON.stringify(data) });

export const deleteTask = (taskId: number) =>
  apiCall(`/caregivers/tasks/${taskId}`, { method: 'DELETE' });

export const completeTask = (taskId: number) =>
  apiCall(`/caregivers/tasks/${taskId}/complete`, { method: 'POST' });

export const getCaregiverAppointments = () =>
  apiCall<CaregiverAppointment[]>('/caregivers/appointments');

export const getTodaysAppointments = () =>
  apiCall<CaregiverAppointment[]>('/caregivers/appointments/today');

export const getUpcomingAppointments = () =>
  apiCall<CaregiverAppointment[]>('/caregivers/appointments/upcoming');

export const getCalendarView = (month: number, year: number) =>
  apiCall<CalendarViewResponse>(`/caregivers/calendar?month=${month}&year=${year}`);

export const createAppointment = (data: CreateAppointmentRequest) =>
  apiCall('/caregivers/appointments', { method: 'POST', body: JSON.stringify(data) });

export const updateAppointment = (appointmentId: number, data: Partial<CreateAppointmentRequest>) =>
  apiCall(`/caregivers/appointments/${appointmentId}`, { method: 'PUT', body: JSON.stringify(data) });

export const cancelAppointment = (appointmentId: number) =>
  apiCall(`/caregivers/appointments/${appointmentId}/cancel`, { method: 'POST' });

export const completeAppointment = (appointmentId: number) =>
  apiCall(`/caregivers/appointments/${appointmentId}/complete`, { method: 'POST' });

export const getPatientAnalytics = (patientId: number, period: string = 'week') =>
  apiCall<PatientAnalytics>(`/caregivers/patients/${patientId}/analytics?period=${period}`);

export const getComparativeAnalytics = () =>
  apiCall<ComparativeAnalytics>('/caregivers/analytics/comparative');

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

export default {
  testConnection,
  systemHealthCheck,
  signupPatient,
  signupCaregiver,
  login,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerification,
  requestOTP,
  verifyOTP,
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
  requestPatientAccess,
  connectWithPatient,
  connectWithCaregiver,
  getIncomingCaregiverRequests,
  respondCaregiverRequest,
  getPatientStatistics,
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
};