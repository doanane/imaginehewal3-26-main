/**
 * Text to speech and copy, in one place, so every "Listen" and "Copy" in the app behaves the same and never fails silently.
 *
 * Reading aloud uses the phone's own voice (expo-speech): free, works offline, no data sent anywhere. It needs the speech module
 * to be part of the installed app build. If this build was made before the module was added, speak() reports 'unavailable' and the
 * caller tells the person plainly why, instead of doing nothing.
 *
 * iPhones also keep text-to-speech silent while the ring/silent switch is on silent. The app cannot override that, so the first time
 * speech starts the person is reminded where to look if they hear nothing.
 */
import { Alert, Share } from 'react-native';
import { expoModulePresent, getSpeech, NATIVE_NAMES } from './native';

export type SpeakResult = 'started' | 'unavailable';

const VOICE: Record<string, string> = { en: 'en-GB', tw: 'en-GH', fr: 'fr-FR', ar: 'ar-SA' };
const MAX_CHUNK = 3000;                                   // the system voice refuses very long strings, so long answers are read in pieces

export const speechAvailable = (): boolean => getSpeech() !== null;

/** Splits at sentence ends so a long answer is read naturally, in pieces the system voice accepts. */
export function chunkForSpeech(text: string): string[] {
  const clean = text.replace(/\s+\n/g, '\n').trim();
  if (clean.length <= MAX_CHUNK) return clean ? [clean] : [];
  const out: string[] = [];
  let rest = clean;
  while (rest.length > MAX_CHUNK) {
    let cut = Math.max(rest.lastIndexOf('. ', MAX_CHUNK), rest.lastIndexOf('\n', MAX_CHUNK));
    if (cut < MAX_CHUNK / 2) cut = rest.lastIndexOf(' ', MAX_CHUNK);
    if (cut <= 0) cut = MAX_CHUNK;
    out.push(rest.slice(0, cut + 1).trim());
    rest = rest.slice(cut + 1);
  }
  if (rest.trim()) out.push(rest.trim());
  return out;
}

export function speak(text: string, o: { language?: string; rate?: number; onStart?: () => void; onDone?: () => void; onError?: () => void } = {}): SpeakResult {
  const Speech = getSpeech();
  if (!Speech) return 'unavailable';
  const parts = chunkForSpeech(text);
  if (!parts.length) { o.onDone?.(); return 'started'; }
  try {
    Speech.stop();
    parts.forEach((part, i) => Speech.speak(part, {
      language: VOICE[o.language || 'en'] || 'en-GB', rate: o.rate ?? 0.92,
      onStart: i === 0 ? o.onStart : undefined,
      onDone: i === parts.length - 1 ? o.onDone : undefined,
      onStopped: i === parts.length - 1 ? o.onDone : undefined,
      onError: o.onError,
    }));
    return 'started';
  } catch {
    o.onError?.();
    return 'unavailable';
  }
}

export function stopSpeaking(): void { try { getSpeech()?.stop(); } catch { /* nothing playing */ } }

let toldAboutSilentSwitch = false;
/** Shown once per session, the first time speech starts. */
export function silentSwitchHint(show: (message: string) => void): void {
  if (toldAboutSilentSwitch) return;
  toldAboutSilentSwitch = true;
  show('Reading aloud. If you hear nothing, switch off silent mode (the switch on the side of the iPhone) and turn the volume up.');
}

let toldNoSpeech = false;
export function explainNoSpeech(force = false): void {
  if (toldNoSpeech && !force) return;
  toldNoSpeech = true;
  Alert.alert('Reading aloud is not in this version of the app',
    'The speech feature was added after your HEWAL3 app was built. Rebuild the app once (eas build --profile development --platform ios, or npx expo run:ios on a Mac), then Listen will work. Nothing else is affected.');
}

/** Copies text. Returns how it went so the screen can say so. Falls back to the share sheet if copying is not possible in this build. */
export async function copyText(text: string): Promise<'copied' | 'shared' | 'failed'> {
  try {
    if (expoModulePresent(NATIVE_NAMES.clipboard)) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Clipboard = require('expo-clipboard');
      await Clipboard.setStringAsync(text);
      return 'copied';
    }
  } catch { /* fall through to sharing */ }
  try {
    await Share.share({ message: text });
    return 'shared';
  } catch {
    return 'failed';
  }
}
