// utils/navigation.ts
import { router } from 'expo-router';

type ValidRoutes =
    | '/'
    | '/home'
    | '/dashboard'
    | '/health'
    | '/health/log-health'
    | '/health/food-log'
    | '/nutrition/goals'
    | '/nutrition/log-food'
    | '/nutrition/log-water'
    | '/fitness'
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

export const navigateTo = (route: ValidRoutes) => {
    router.push(route as any);
};

// Or use this simpler approach
export const push = (route: string) => {
    router.push(route as any);
};