/**
 * The app decides whether a feature exists by asking whether its native module is in the installed build. That only works if the
 * module name is right. A wrong name once made Listen claim the speech module was missing in a build that had it. So each name is
 * checked here against what the installed package itself registers.
 */
import * as fs from 'fs';
import * as path from 'path';

jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: () => null }), { virtual: true });

import { NATIVE_NAMES } from '../native';

const read = (rel: string) => fs.readFileSync(path.join(__dirname, '..', '..', 'node_modules', rel), 'utf8');
const expoName = (rel: string) => /requireNativeModule\('([^']+)'\)/.exec(read(rel))?.[1];

test('expo packages register the module names the app checks for', () => {
  expect(expoName('expo-speech/build/ExponentSpeech.js')).toBe(NATIVE_NAMES.speech);
  expect(expoName('expo-location/build/ExpoLocation.js')).toBe(NATIVE_NAMES.location);
  expect(expoName('expo-sensors/build/ExponentPedometer.js')).toBe(NATIVE_NAMES.pedometer);
  expect(expoName('expo-clipboard/build/ExpoClipboard.js')).toBe(NATIVE_NAMES.clipboard);
  expect(expoName('expo-audio/build/AudioModule.js')).toBe(NATIVE_NAMES.audio);
});

test('react-native packages register the names the app checks for', () => {
  expect(/NativeModules\.(\w+)/.exec(read('@react-native-community/netinfo/src/internal/nativeModule.ts'))?.[1]).toBe(NATIVE_NAMES.netinfo);
  expect(/NativeModules\.(\w+)/.exec(read('react-native-ble-plx/src/BleModule.js'))?.[1]).toBe(NATIVE_NAMES.bluetooth);
  expect(/const \{ WebRTCModule \} = NativeModules/.test(read('react-native-webrtc/src/MediaDevices.ts'))).toBe(true);
  expect(NATIVE_NAMES.webrtc).toBe('WebRTCModule');
  expect(expoName('expo-notifications/build/PushTokenManager.native.js')).toBe(NATIVE_NAMES.push);
});
