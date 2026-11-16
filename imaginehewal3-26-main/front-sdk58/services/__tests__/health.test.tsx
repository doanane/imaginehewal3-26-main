/** Which app's steps count, what is uploaded, and what happens when a permission is missing. */
const mockNative: any = {};
jest.mock('expo-constants', () => ({ __esModule: true, default: { executionEnvironment: 'bare' } }));
jest.mock('@kingstinct/react-native-healthkit', () => mockNative, { virtual: true });

const sample = (v: number, iso: string, src: string) => ({ quantity: v, endDate: iso, sourceRevision: { source: { name: src } } });
function install(over: Partial<Record<string, any>> = {}) {
  const row = (name: string, q: number) => ({ source: { name }, sumQuantity: { quantity: q } });
  Object.assign(mockNative, {
    isHealthDataAvailable: () => true,
    requestAuthorization: async () => true,
    queryStatisticsForQuantity: async (id: string) => ({ sumQuantity: { quantity: ({ StepCount: 760, ActiveEnergyBurned: 31, DistanceWalkingRunning: 600, AppleExerciseTime: 6 } as any)[id.replace('HKQuantityTypeIdentifier', '')] ?? 0 }, sources: [{ name: 'iPhone' }] }),
    queryStatisticsForQuantitySeparateBySource: async (id: string) => {
      const k = id.replace('HKQuantityTypeIdentifier', '');
      if (k === 'StepCount') return [row('iPhone', 750), row('HUAWEI Health', 8420)];
      if (k === 'ActiveEnergyBurned') return [row('HUAWEI Health', 412), row('iPhone', 30)];
      if (k === 'AppleExerciseTime') return [row('HUAWEI Health', 47)];
      return [row('HUAWEI Health', 6100)];
    },
    getMostRecentQuantitySample: async (id: string) => {
      const m: any = { HeartRate: sample(88, new Date(Date.now() - 60_000).toISOString(), 'HUAWEI Health'), OxygenSaturation: sample(0.97, new Date(Date.now() - 3600_000).toISOString(), 'HUAWEI Health') };
      return m[id.replace('HKQuantityTypeIdentifier', '')] ?? null;
    },
    ...over,
  });
}

import AsyncStorage from '@react-native-async-storage/async-storage';
import { chooseSource, COMBINED, readHealthKitSnapshot, setStepSourcePref, syncHealthKitToBackend } from '../healthkit';

beforeEach(async () => { await AsyncStorage.clear(); install(); });

const per = [{ name: 'iPhone', steps: 750, energy: 30, distance: 520, minutes: null }, { name: 'HUAWEI Health', steps: 8420, energy: 412, distance: 6100, minutes: 47 }];
const merged = { steps: 760, energy: 31, distance: 600, minutes: 6 };

test('automatic counts the app with the most steps, so a watch is not hidden by the phone', () => {
  const c = chooseSource(per, merged, 'auto');
  expect(c.name).toBe('HUAWEI Health'); expect(c.steps).toBe(8420); expect(c.energy).toBe(412); expect(c.minutes).toBe(47); expect(c.auto).toBe(true);
});
test('a chosen app wins, and an app that wrote no minutes falls back to the combined figure for that one item', () => {
  const c = chooseSource(per, merged, 'iPhone');
  expect(c.name).toBe('iPhone'); expect(c.steps).toBe(750); expect(c.auto).toBe(false); expect(c.minutes).toBe(6);
});
test('a chosen app that has nothing today is ignored in favour of automatic', () => {
  expect(chooseSource(per, merged, 'oraimo health').name).toBe('HUAWEI Health');
});
test('if the combined total is larger than any one app, it is used', () => {
  expect(chooseSource([{ name: 'iPhone', steps: 100, energy: null, distance: null, minutes: null }], { steps: 500, energy: 20, distance: null, minutes: null }, 'auto').name).toBe(COMBINED);
});
test('no data at all yields zero steps from the combined figure, never a made-up number', () => {
  const c = chooseSource([], { steps: 0, energy: null, distance: null, minutes: null }, 'auto');
  expect(c.steps).toBe(0); expect(c.energy).toBeNull();
});

test('the snapshot reads every app separately and picks the watch', async () => {
  const snap = await readHealthKitSnapshot();
  expect(snap.steps).toBe(8420); expect(snap.stepsSource).toBe('HUAWEI Health');
  expect(snap.stepsBySource).toEqual([{ name: 'HUAWEI Health', steps: 8420 }, { name: 'iPhone', steps: 750 }]);
  expect(snap.activeEnergyKcal).toBe(412); expect(snap.activeMinutes).toBe(47); expect(snap.distanceM).toBe(6100);
  expect(snap.heartRate).toBe(88); expect(snap.heartRateSource).toBe('HUAWEI Health'); expect(snap.oxygenSaturation).toBe(97);
  expect(snap.sources).toEqual(expect.arrayContaining(['HUAWEI Health', 'iPhone']));
});
test('the person can switch to the phone count, and it sticks', async () => {
  await setStepSourcePref('iPhone');
  const snap = await readHealthKitSnapshot();
  expect(snap.steps).toBe(750); expect(snap.stepsSource).toBe('iPhone'); expect(snap.stepsAuto).toBe(false);
});
test('one denied permission does not blank the rest', async () => {
  install({ queryStatisticsForQuantitySeparateBySource: async () => { throw new Error('denied'); }, getMostRecentQuantitySample: async () => { throw new Error('denied'); } });
  const snap = await readHealthKitSnapshot();
  expect(snap.steps).toBe(760); expect(snap.heartRate).toBeNull(); expect(snap.stepsSource).toBe(COMBINED);
});

test('the upload carries the day totals and the source, with the time the watch measured the heart rate', async () => {
  const snap = await readHealthKitSnapshot();
  const sent: any[] = [];
  expect(await syncHealthKitToBackend(snap, async (p) => { sent.push(p); }, true)).toBe(true);
  expect(sent[0]).toMatchObject({ device_id: 'apple-health', steps: 8420, steps_source: 'HUAWEI Health', calories: 412, active_minutes: 47, distance_m: 6100, heart_rate: 88 });
  expect(sent[0].measured_at).toBe(snap.heartRateAt);
});
test('an identical reading is not uploaded twice, and an empty snapshot uploads nothing', async () => {
  const snap = await readHealthKitSnapshot();
  const send = jest.fn(async () => {});
  await syncHealthKitToBackend(snap, send, true);
  expect(await syncHealthKitToBackend(snap, send, false)).toBe(false);
  expect(await syncHealthKitToBackend({ ...snap, steps: null, activeEnergyKcal: null, activeMinutes: null, distanceM: null, heartRate: null, oxygenSaturation: null, bloodPressure: { systolic: null, diastolic: null } }, send, true)).toBe(false);
});
