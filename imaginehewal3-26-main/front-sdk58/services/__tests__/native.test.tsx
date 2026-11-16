/** A missing native module must be detected BEFORE its JavaScript is loaded: Metro shows a red error screen for the load itself. */
const mockPresent = new Set<string>();
jest.mock('expo-modules-core', () => ({ requireOptionalNativeModule: (n: string) => (mockPresent.has(n) ? {} : null) }));

function fresh() {
  jest.resetModules();
  const loaded: string[] = [];
  jest.doMock('expo-sensors', () => { loaded.push('expo-sensors'); return { Pedometer: { isAvailableAsync: () => true } }; });
  jest.doMock('expo-location', () => { loaded.push('expo-location'); return { requestForegroundPermissionsAsync: () => null }; });
  jest.doMock('expo-speech', () => { loaded.push('expo-speech'); return { speak: () => null, stop: () => null }; });
  jest.doMock('@react-native-community/netinfo', () => { loaded.push('netinfo'); return { default: { addEventListener: () => () => null } }; }, { virtual: true });
  return { native: require('../native') as typeof import('../native'), loaded };
}

beforeEach(() => mockPresent.clear());

test('with no native modules in this build nothing is loaded and nothing throws', () => {
  const { native, loaded } = fresh();
  expect(native.getPedometer()).toBeNull();
  expect(native.getLocation()).toBeNull();
  expect(native.getSpeech()).toBeNull();
  expect(native.getNetInfo()).toBeNull();
  expect(native.bluetoothModulePresent()).toBe(false);
  expect(loaded).toEqual([]);
});

test('a module that is mockPresent is loaded, and only that one', () => {
  mockPresent.add('ExponentPedometer');
  const { native, loaded } = fresh();
  expect(native.getPedometer()).not.toBeNull();
  expect(native.getLocation()).toBeNull();
  expect(loaded).toEqual(['expo-sensors']);
});

test('all expo modules load when the build has them', () => {
  ['ExponentPedometer', 'ExpoLocation', 'ExpoSpeech'].forEach((n) => mockPresent.add(n));
  const { native, loaded } = fresh();
  expect(native.getPedometer() && native.getLocation() && native.getSpeech()).toBeTruthy();
  expect(loaded.sort()).toEqual(['expo-location', 'expo-sensors', 'expo-speech']);
});
