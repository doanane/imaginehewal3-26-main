/**
 * Optional native modules. Expo Go (or an older build) may not contain every module, and importing a missing one at the top of a
 * file crashes the whole app. These loaders return null instead, so each feature can show a clear message and the rest keeps working.
 */
import { requireOptionalNativeModule } from 'expo-modules-core';
import { NativeModules, TurboModuleRegistry } from 'react-native';
import type * as LocationT from 'expo-location';
import type * as SpeechT from 'expo-speech';
import type { Pedometer as PedometerT } from 'expo-sensors';
import type NetInfoT from '@react-native-community/netinfo';

export type LocationModule = typeof LocationT;
export type SpeechModule = typeof SpeechT;

function safe<T>(load: () => T): T | null { try { return load() ?? null; } catch { return null; } }

// In development, Metro reports a failed module load to the red error screen BEFORE a try/catch can see it, so a missing native
// module has to be detected first, without loading its JavaScript. These checks never throw.
/** The native module name each package registers. A test (services/__tests__/nativeNames.test.tsx) reads them from node_modules, so a wrong name cannot go unnoticed. */
export const NATIVE_NAMES = { location: 'ExpoLocation', speech: 'ExpoSpeech', pedometer: 'ExponentPedometer', clipboard: 'ExpoClipboard', netinfo: 'RNCNetInfo', bluetooth: 'BlePlx', webrtc: 'WebRTCModule', push: 'ExpoPushTokenManager', audio: 'ExpoAudio' } as const;

export const expoModulePresent = (name: string): boolean => { try { return !!requireOptionalNativeModule(name); } catch { return false; } };
export const rnModulePresent = (name: string): boolean => {
  try { return !!(NativeModules as any)[name] || !!TurboModuleRegistry.get(name); } catch { return false; }
};
export const webrtcModulePresent = () => rnModulePresent(NATIVE_NAMES.webrtc);
export const bluetoothModulePresent = () => rnModulePresent(NATIVE_NAMES.bluetooth);
export const healthKitModulePresent = () => rnModulePresent('NitroModules') || expoModulePresent('NitroModules');

let loc: LocationModule | null | undefined, sp: SpeechModule | null | undefined, ped: typeof PedometerT | null | undefined, ni: typeof NetInfoT | null | undefined;
export const getLocation = (): LocationModule | null => (loc === undefined ? (loc = expoModulePresent(NATIVE_NAMES.location) ? safe(() => require('expo-location')) : null) : loc);
export const getSpeech = (): SpeechModule | null => (sp === undefined ? (sp = expoModulePresent(NATIVE_NAMES.speech) ? safe(() => require('expo-speech')) : null) : sp);
export const getPedometer = (): typeof PedometerT | null => (ped === undefined ? (ped = expoModulePresent(NATIVE_NAMES.pedometer) ? safe(() => require('expo-sensors').Pedometer) : null) : ped);
export const getNetInfo = (): typeof NetInfoT | null => (ni === undefined ? (ni = rnModulePresent(NATIVE_NAMES.netinfo) ? safe(() => require('@react-native-community/netinfo').default) : null) : ni);
