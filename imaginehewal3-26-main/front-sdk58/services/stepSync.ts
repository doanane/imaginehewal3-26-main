/** Real step counting from the phone's motion coprocessor, synced to the server as a running day total. */
import { getPedometer } from './native';
import { Platform } from 'react-native';
import api from './api';

export type StepReading = { steps: number | null; reason?: 'web' | 'unavailable' | 'denied' | 'android' | 'error' };

export async function readTodaySteps(): Promise<StepReading> {
  if (Platform.OS === 'web') return { steps: null, reason: 'web' };
  const Pedometer = getPedometer();
  if (!Pedometer) return { steps: null, reason: 'unavailable' };
  try {
    if (!(await Pedometer.isAvailableAsync())) return { steps: null, reason: 'unavailable' };
    const perm = await Pedometer.requestPermissionsAsync();
    if (!perm.granted) return { steps: null, reason: 'denied' };
    if (Platform.OS !== 'ios') return { steps: null, reason: 'android' };      // the phone only reports a day total on iOS
    const start = new Date(); start.setHours(0, 0, 0, 0);
    return { steps: (await Pedometer.getStepCountAsync(start, new Date())).steps };
  } catch { return { steps: null, reason: 'error' }; }
}

export const REASON_TEXT: Record<string, string> = {
  web: 'Step counting needs the phone app.', unavailable: 'This phone has no step sensor.', denied: 'Allow Motion and Fitness access to count your steps.',
  android: 'Daily steps on Android come from your watch or Health app. Connect one in Devices.', error: 'Could not read your steps right now.',
};

/** Reads today's steps and sends them. Returns the steps, or null when the phone cannot provide them. */
let lastSync = 0; let lastResult: { steps: number | null; reason?: string; achievements?: string[] } = { steps: null };
export async function syncStepsNow(force = false): Promise<{ steps: number | null; reason?: string; achievements?: string[] }> {
  if (!force && Date.now() - lastSync < 60_000) return lastResult;
  lastSync = Date.now();
  lastResult = await syncStepsOnce();
  return lastResult;
}

async function syncStepsOnce(): Promise<{ steps: number | null; reason?: string; achievements?: string[] }> {
  const r = await readTodaySteps();
  if (r.steps == null) return { steps: null, reason: r.reason };
  try {
    const res = await api.syncSteps(r.steps, new Date().toLocaleDateString('en-CA'));
    return { steps: res.steps, achievements: res.new_achievements };
  } catch { return { steps: r.steps }; }             // offline: the reading is still shown, and the next sync will send it
}
