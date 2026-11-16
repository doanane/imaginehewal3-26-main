/**
 * Sound for calls: a ringtone and vibration while a call comes in, and the phone's audio set up for a two-way conversation.
 * Uses expo-audio (needs a build made after it was added; without it nothing here runs and calls still work, silently).
 *
 * iPhone: the audio session has to be "play and record", speaker on, playing even with the silent switch on. Without that the
 * microphone can capture nothing and the person on the other end hears silence while the phone itself plays their voice fine.
 */
import { Vibration } from 'react-native';
import { expoModulePresent, NATIVE_NAMES } from './native';

let A: typeof import('expo-audio') | null | undefined;
const lib = () => {
  if (A === undefined) { try { A = expoModulePresent(NATIVE_NAMES.audio) ? require('expo-audio') : null; } catch { A = null; } }
  return A;
};

let player: { loop: boolean; play: () => void; pause: () => void; remove: () => void } | null = null;

/** Play and record, through the loudspeaker, even when the silent switch is on. Call before opening the microphone and again once connected. */
export async function useCallAudioMode() {
  try { await lib()?.setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true, interruptionMode: 'doNotMix', shouldPlayInBackground: true, shouldRouteThroughEarpiece: false }); } catch { /* best effort */ }
}

/** Playback only, loud, for the ringtone. */
async function useRingMode() {
  try { await lib()?.setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false, interruptionMode: 'doNotMix', shouldPlayInBackground: true, shouldRouteThroughEarpiece: false }); } catch { /* best effort */ }
}

export async function startRinging() {
  stopRinging();
  Vibration.vibrate([0, 700, 500, 700, 1500], true);
  const a = lib();
  if (!a) return;
  await useRingMode();
  try {
    player = a.createAudioPlayer(require('../assets/sounds/ringtone.wav')) as any;
    if (player) { player.loop = true; player.play(); }
  } catch { player = null; }
}

export function stopRinging() {
  Vibration.cancel();
  try { player?.pause(); player?.remove(); } catch { /* already gone */ }
  player = null;
}
