/**
 * Push notifications, so a message, an appointment change, an emergency or an incoming call reaches a phone whose app is closed.
 * The backend sends only generic text (never readings or message content). The phone is registered after sign-in, once the person
 * has allowed notifications. Needs the expo-notifications native module, so it exists only in a build made after that package was
 * added; without it nothing here runs and nothing breaks. Push delivery on iPhone also needs an Apple push key attached to the
 * Expo project (`eas credentials`); until then tokens register but no notification arrives.
 */
import Constants from 'expo-constants';
import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';
import { expoModulePresent, NATIVE_NAMES } from './native';

export const pushModulePresent = () => expoModulePresent(NATIVE_NAMES.push);

let N: typeof import('expo-notifications') | null | undefined;
const lib = () => {
  if (N === undefined) { try { N = pushModulePresent() ? require('expo-notifications') : null; } catch { N = null; } }
  return N;
};

const KEY = 'hewal3.push.token';

/** Show alerts while the app is open too: the server only pushes when the live connection is not, so this never duplicates. */
export function configurePush() {
  const n = lib();
  if (!n) return;
  // A call notification is silent while the app is open on screen: the app rings by itself with the call screen. In the background it rings and shows.
  n.setNotificationHandler({ handleNotification: async (note: any) => {
    const call = note?.request?.content?.data?.type === 'call';
    const open = AppState.currentState === 'active';
    return { shouldShowBanner: !(call && open), shouldShowList: !(call && open), shouldPlaySound: !(call && open), shouldSetBadge: false };
  } });
  if (Platform.OS === 'android') {
    n.setNotificationChannelAsync('default', { name: 'Messages and updates', importance: n.AndroidImportance.DEFAULT }).catch(() => {});
    n.setNotificationChannelAsync('reminders', { name: 'Medicine reminders', importance: n.AndroidImportance.HIGH }).catch(() => {});
    n.setNotificationChannelAsync('calls', { name: 'Calls and emergencies', importance: n.AndroidImportance.MAX, vibrationPattern: [0, 400, 200, 400], sound: 'ringtone.wav' }).catch(() => {});
  }
}

/** Ask once for permission, get this phone's token and tell the server. Returns what happened, so a screen can explain it. */
export async function registerForPush(): Promise<'registered' | 'denied' | 'unavailable' | 'failed'> {
  const n = lib();
  if (!n) return 'unavailable';
  try {
    let status = (await n.getPermissionsAsync()).status;
    if (status !== 'granted') status = (await n.requestPermissionsAsync()).status;
    if (status !== 'granted') return 'denied';
    const projectId = (Constants.expoConfig?.extra as any)?.eas?.projectId ?? (Constants as any).easConfig?.projectId;
    const token = (await n.getExpoPushTokenAsync(projectId ? { projectId } : undefined)).data;
    await api.registerPushToken(token, Platform.OS);
    await AsyncStorage.setItem(KEY, token);
    return 'registered';
  } catch {
    return 'failed';
  }
}

/** On sign-out, stop this phone receiving the previous person's notifications. */
export async function unregisterPush() {
  try {
    const token = await AsyncStorage.getItem(KEY);
    if (token) { await api.unregisterPushToken(token).catch(() => {}); await AsyncStorage.removeItem(KEY); }
  } catch { /* nothing stored */ }
}

/** Where a tapped notification should go. */
export function routeFor(data: any, isCaregiver: boolean): string | null {
  switch (data?.type) {
    case 'medicine': return '/(patient)/medications';
    case 'doctor_message': return '/(patient)/doctor-chat';
    case 'appointment': return '/(patient)/doctor-appointments';
    case 'prescription':
    case 'note': return '/(patient)/doctor-care';
    case 'emergency': return isCaregiver ? '/(caregiver)/alerts' : '/(patient)/emergency';
    case 'message': return isCaregiver ? '/(caregiver)/messaging' : '/(patient)/messages';
    default: return null;                                  // calls ring through the live connection as soon as the app opens
  }
}

export function onNotificationTap(handler: (data: any) => void): () => void {
  const n = lib();
  if (!n) return () => {};
  const sub = n.addNotificationResponseReceivedListener((r) => handler(r.notification.request.content.data));
  n.getLastNotificationResponseAsync().then((r) => { if (r) handler(r.notification.request.content.data); }).catch(() => {});
  return () => sub.remove();
}
