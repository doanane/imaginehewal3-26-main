import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { AppState } from 'react-native';
import { refreshMedicineReminders } from '../services/medicationReminders';
import { configurePush, onNotificationTap, pushModulePresent, registerForPush, routeFor } from '../services/pushNotifications';

/** Mounted once at the root. Registers the phone for push after sign-in and opens the right screen when a notification is tapped. */
export default function PushHost() {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const caregiver = !!(user as any)?.is_caregiver;

  useEffect(() => { configurePush(); }, []);
  useEffect(() => {
    if (!isAuthenticated || !pushModulePresent()) return;
    registerForPush();
    return onNotificationTap((data) => { const to = routeFor(data, caregiver); if (to) router.push(to as any); });
  }, [isAuthenticated, caregiver, router]);

  // Medicine reminders are scheduled on the phone itself. Rebuild them when the app opens and each time it comes back to the front.
  useEffect(() => {
    if (!isAuthenticated || caregiver) return;
    refreshMedicineReminders();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') refreshMedicineReminders(); });
    return () => sub.remove();
  }, [isAuthenticated, caregiver]);

  return null;
}
