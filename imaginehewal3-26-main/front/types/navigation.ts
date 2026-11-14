// types/navigation.ts
export type PatientRoutes = 
  | '/'
  | '/home'
  | '/dashboard'
  | '/health'
  | '/health/index'
  | '/health/log-health'
  | '/health/food-log'
  | '/nutrition'
  | '/nutrition/index'
  | '/nutrition/log-food'
  | '/nutrition/log-water'
  | '/nutrition/food-log'
  | '/nutrition/goals'
  | '/nutrition/scan-food'
  | '/fitness'
  | '/fitness/index'
  | '/fitness/workouts'
  | '/fitness/log-workout'
  | '/profile'
  | '/settings'
  | '/notification-settings'
  | '/privacy'
  | '/emergency-contacts'
  | '/help'
  | '/about'
  | '/devices'
  | '/leaderboard'
  | '/notifications'
  | '/verify'
  | '/signup'
  | '/login'
  | '/forgot-password'
  | '/profile-setup'
  | '/action-menu';

export type AppRoutes = 
  | PatientRoutes
  | '/debug-auth'
  | '/connection-test'
  | '/onboarding'
  | '/index'
  | `/(auth)/${string}`
  | `/(caregiver)/${string}`;

export type CaregiverScreens = {
  'dashboard': undefined;
  'patients': undefined;
  'schedule': undefined;
  'tasks': undefined;
  'medications': undefined;
  'analytics': undefined;
  'messaging': undefined;

  'settings': undefined;
}

export type ScreenParams = {
  [K in keyof CaregiverScreens]: CaregiverScreens[K];
};