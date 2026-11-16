/**
 * One place that decides where the backend is.
 *
 * Development: the phone already reached Metro at the laptop's current address (Constants.expoConfig.hostUri), so the backend is
 * on that same address, port 8000. This follows the laptop across Wi-Fi, hotspot and network changes with no editing.
 * A fixed http:// EXPO_PUBLIC_BASE_URL is deliberately ignored in development because it goes stale every time the network changes.
 * Tunnel mode (a public host name) cannot reach port 8000, so there EXPO_PUBLIC_BASE_URL (an https tunnel to the backend) is used.
 * Production: EXPO_PUBLIC_BASE_URL (https).
 */
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const PROD_FALLBACK = 'https://hewal3-backend-api-aya3dzgefte4b3c3.southafricanorth-01.azurewebsites.net';
const isAddress = (h: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h === 'localhost' || h.endsWith('.local');

export function resolveBaseUrl(): string {
  const configured = process.env.EXPO_PUBLIC_BASE_URL?.trim().replace(/\/$/, '');
  if (configured?.startsWith('https://')) return configured;                                   // explicit secure backend always wins

  if (Platform.OS === 'web') {
    const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
    return `http://${host}:8000`;
  }
  if (typeof __DEV__ !== 'undefined' && !__DEV__) return configured || PROD_FALLBACK;

  const host = (Constants.expoConfig?.hostUri || (Constants as any).manifest2?.extra?.expoGo?.debuggerHost || '').split(':')[0];
  if (host && isAddress(host)) return `http://${host}:8000`;
  if (configured) return configured;                                                          // tunnel mode or no host: use what was set
  return 'http://localhost:8000';
}
