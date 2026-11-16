import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

type SourceInfo = { name?: string; bundleIdentifier?: string };
type QuantitySample = { quantity?: number; endDate?: Date | string; sourceRevision?: { source?: SourceInfo } };
type HealthKitNative = {
  getMostRecentQuantitySample: (identifier: string) => Promise<QuantitySample | null>;
  queryStatisticsForQuantity: (identifier: string, statistics: readonly string[], options?: { filter?: { date?: { startDate?: Date; endDate?: Date } }; unit?: string }) => Promise<{ sumQuantity?: { quantity: number }; sources?: readonly SourceInfo[] }>;
  queryStatisticsForQuantitySeparateBySource: (identifier: string, statistics: readonly string[], options?: { filter?: { date?: { startDate?: Date; endDate?: Date } }; unit?: string }) => Promise<readonly { source?: SourceInfo; sumQuantity?: { quantity: number } }[]>;
  subscribeToChanges?: (identifier: string, callback: () => void) => { remove: () => void } | (() => void);
  isHealthDataAvailable: () => boolean;
  queryCategorySamples: (identifier: string, options: { limit: number; ascending: boolean }) => Promise<readonly unknown[]>;
  queryQuantitySamples: (identifier: string, options: { unit: string; limit: number; ascending: boolean }) => Promise<readonly unknown[]>;
  queryWorkoutSamples: (options: { limit: number; ascending: boolean }) => Promise<readonly unknown[]>;
  requestAuthorization: (options: { toRead: readonly string[] }) => Promise<boolean>;
};

let nativeHealthKit: HealthKitNative | null | undefined;

function getNativeHealthKit(): HealthKitNative | null {
  if (nativeHealthKit !== undefined) return nativeHealthKit;
  try {
    // HealthKit is optional at runtime because Expo Go and older development
    // clients do not include the native Nitro module.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    nativeHealthKit = require('@kingstinct/react-native-healthkit') as HealthKitNative;
  } catch {
    nativeHealthKit = null;
  }
  return nativeHealthKit;
}

export const HEALTHKIT_READ_TYPES = [
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierOxygenSaturation',
  'HKQuantityTypeIdentifierBodyMass',
  'HKQuantityTypeIdentifierBloodPressureSystolic',
  'HKQuantityTypeIdentifierBloodPressureDiastolic',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierDistanceWalkingRunning',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierAppleExerciseTime',
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKWorkoutTypeIdentifier',
] as const;

export type HealthKitConnection = {
  available: boolean;
  connected: boolean;
  reason?: 'android' | 'expo-go' | 'permission' | 'error';
};

export type HealthKitSnapshot = {
  steps: number | null;                  // today's total, the same figure the Health app shows
  stepsSource: string | null;
  activeEnergyKcal: number | null;       // today
  activeMinutes: number | null;          // exercise minutes today
  stepsBySource: { name: string; steps: number }[];   // what each app wrote today, so a watch's steps are never hidden by the phone's
  stepsAuto: boolean;                    // true when the source was picked automatically (the one with the most steps)
  heartRateSource: string | null;
  oxygenSource: string | null;
  bloodPressureSource: string | null;
  distanceM: number | null;              // today, walking and running
  restingHeartRate: number | null;
  heartRate: number | null;
  heartRateAt: string | null;            // when the watch measured it (ISO), not when we read it
  oxygenSaturationAt: string | null;
  bloodPressureAt: string | null;
  sources: string[];                     // apps that wrote this data, for example HUAWEI Health or oraimo health
  readAt: string;
  oxygenSaturation: number | null;
  weight: number | null;
  bloodPressure: { systolic: number | null; diastolic: number | null };
  sampleCounts: {
    steps: number;
    heartRate: number;
    oxygenSaturation: number;
    weight: number;
    sleep: number;
    workouts: number;
  };
};

const HEALTHKIT_CONNECTED_KEY = 'healthkit_connected';

const EMPTY_SNAPSHOT: HealthKitSnapshot = {
  steps: null, stepsSource: null, activeEnergyKcal: null, activeMinutes: null, stepsBySource: [], stepsAuto: true, heartRateSource: null, oxygenSource: null,
  bloodPressureSource: null, distanceM: null, restingHeartRate: null,
  heartRateAt: null, oxygenSaturationAt: null, bloodPressureAt: null, sources: [], readAt: new Date(0).toISOString(),
  heartRate: null,
  oxygenSaturation: null,
  weight: null,
  bloodPressure: { systolic: null, diastolic: null },
  sampleCounts: { steps: 0, heartRate: 0, oxygenSaturation: 0, weight: 0, sleep: 0, workouts: 0 },
};

function isExpoGo(): boolean {
  return String(Constants.executionEnvironment) === 'storeClient';
}

export async function connectHealthKit(): Promise<HealthKitConnection> {
  if (Platform.OS !== 'ios') return { available: false, connected: false, reason: 'android' };
  if (isExpoGo()) return { available: false, connected: false, reason: 'expo-go' };
  const healthKit = getNativeHealthKit();
  if (!healthKit) return { available: false, connected: false, reason: 'error' };
  try {
    if (!healthKit.isHealthDataAvailable()) return { available: false, connected: false, reason: 'error' };
    const granted = await healthKit.requestAuthorization({ toRead: HEALTHKIT_READ_TYPES });
    if (granted) await AsyncStorage.setItem(HEALTHKIT_CONNECTED_KEY, (await AsyncStorage.getItem('user_id')) || 'true');   // remembered for THIS account only
    return { available: true, connected: granted, reason: granted ? undefined : 'permission' };
  } catch {
    return { available: true, connected: false, reason: 'error' };
  }
}

export async function getHealthKitConnection(): Promise<HealthKitConnection> {
  if (Platform.OS !== 'ios') return { available: false, connected: false, reason: 'android' };
  if (isExpoGo()) return { available: false, connected: false, reason: 'expo-go' };
  if (!getNativeHealthKit()) return { available: false, connected: false, reason: 'error' };
  const [flag, uid] = await Promise.all([AsyncStorage.getItem(HEALTHKIT_CONNECTED_KEY), AsyncStorage.getItem('user_id')]);
  const connected = !!flag && flag === (uid || 'true');   // a new account on the same phone starts disconnected: no data until its owner connects Apple Health
  return { available: true, connected };
}

export async function disconnectHealthKit(): Promise<void> {
  await AsyncStorage.removeItem(HEALTHKIT_CONNECTED_KEY);
}

const iso = (d?: Date | string): string | null => (d ? new Date(d).toISOString() : null);
const settled = <T,>(r: PromiseSettledResult<T>): T | null => (r.status === 'fulfilled' ? r.value : null);

// ---- Which app's steps count -------------------------------------------------------------------------------------------------
// Apple Health merges every app that writes steps and drops the ones that overlap in time, with the iPhone ahead of third-party apps.
// A watch worn all day through HUAWEI Health or oraimo health can therefore be mostly hidden in the merged total, which is why the
// Health app and the watch's own app can disagree wildly. So each app's own total is read separately, and the person can choose.
export type Totals = { steps: number; energy: number | null; distance: number | null; minutes: number | null };
export type SourceTotal = Totals & { name: string };
export const COMBINED = 'Apple Health (all sources combined)';
const STEP_SOURCE_KEY = 'hewal3.health.stepSource';

export const getStepSourcePref = async (): Promise<string> => (await AsyncStorage.getItem(STEP_SOURCE_KEY).catch(() => null)) || 'auto';
export const setStepSourcePref = (name: string) => AsyncStorage.setItem(STEP_SOURCE_KEY, name).catch(() => {});

/** Pure: picks the figures to use. 'auto' takes whichever app counted the most steps today; otherwise the app the person chose. */
export function chooseSource(per: SourceTotal[], merged: Totals, pref: string): SourceTotal & { auto: boolean } {
  const withSteps = per.filter((p) => p.steps > 0);
  let pick: SourceTotal | undefined, auto = true;
  if (pref !== 'auto') {
    pick = per.find((p) => p.name === pref);
    if (pick) auto = false;
  }
  if (!pick) {
    pick = [...withSteps].sort((x, y) => y.steps - x.steps)[0];
    if (!pick || merged.steps > pick.steps) pick = { name: COMBINED, ...merged };
  }
  return {
    ...pick, auto,
    // an app that did not write calories, distance or exercise minutes falls back to Apple's combined figure for that one item
    energy: pick.energy ?? merged.energy, distance: pick.distance ?? merged.distance, minutes: pick.minutes ?? merged.minutes,
  };
}

/**
 * Reads what Apple Health holds right now. Apple Health merges everything written to it: the iPhone, an Apple Watch, and apps such as
 * HUAWEI Health or oraimo health that sync their watch into it. Steps, calories, distance and exercise minutes are today's totals from
 * the chosen app (see above); heart rate, oxygen and blood pressure are the newest measurements, each with the time the device took it
 * and the app that wrote it. Each value is read on its own, so one missing permission never blanks the others.
 */
export async function readHealthKitSnapshot(): Promise<HealthKitSnapshot> {
  const healthKit = getNativeHealthKit();
  if (Platform.OS !== 'ios' || isExpoGo() || !healthKit || !healthKit.isHealthDataAvailable()) {
    return EMPTY_SNAPSHOT;
  }
  const now = new Date();
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const today = { filter: { date: { startDate: start, endDate: now } } };
  const sum = (id: string, unit: string) => healthKit.queryStatisticsForQuantity(id, ['cumulativeSum'], { ...today, unit });
  const per = (id: string, unit: string) => healthKit.queryStatisticsForQuantitySeparateBySource(id, ['cumulativeSum'], { ...today, unit });
  const last = (id: string) => healthKit.getMostRecentQuantitySample(id);
  const STEP = 'HKQuantityTypeIdentifierStepCount', ENERGY = 'HKQuantityTypeIdentifierActiveEnergyBurned', DIST = 'HKQuantityTypeIdentifierDistanceWalkingRunning', EX = 'HKQuantityTypeIdentifierAppleExerciseTime';
  const results = (await Promise.allSettled([
    sum(STEP, 'count'), per(STEP, 'count'), sum(ENERGY, 'kcal'), per(ENERGY, 'kcal'), sum(DIST, 'm'), per(DIST, 'm'), sum(EX, 'min'), per(EX, 'min'),
    last('HKQuantityTypeIdentifierHeartRate'), last('HKQuantityTypeIdentifierRestingHeartRate'), last('HKQuantityTypeIdentifierOxygenSaturation'),
    last('HKQuantityTypeIdentifierBodyMass'), last('HKQuantityTypeIdentifierBloodPressureSystolic'), last('HKQuantityTypeIdentifierBloodPressureDiastolic'),
    getStepSourcePref(),
  ])).map((r) => settled(r as PromiseSettledResult<any>)) as any[];
  const [stepsM, stepsS, energyM, energyS, distM, distS, exM, exS, hr, resting, spo2, weight, sys, dia, pref] = results;

  const totals = new Map<string, SourceTotal>();
  const add = (rows: any[] | null, key: 'steps' | 'energy' | 'distance' | 'minutes') => {
    for (const row of rows || []) {
      const name = row?.source?.name; const v = row?.sumQuantity?.quantity;
      if (!name || typeof v !== 'number') continue;
      const t = totals.get(name) || { name, steps: 0, energy: null, distance: null, minutes: null };
      (t as any)[key] = Math.round(v);
      totals.set(name, t);
    }
  };
  add(stepsS, 'steps'); add(energyS, 'energy'); add(distS, 'distance'); add(exS, 'minutes');
  const q = (x: any) => (x?.sumQuantity ? Math.round(x.sumQuantity.quantity) : null);
  const merged: Totals = { steps: q(stepsM) ?? 0, energy: q(energyM), distance: q(distM), minutes: q(exM) };
  const readSteps = stepsM !== null || stepsS !== null;
  const chosen = chooseSource(Array.from(totals.values()), merged, pref || 'auto');

  const names = new Set<string>(totals.keys());
  const addSource = (x?: SourceInfo) => { if (x?.name) names.add(x.name); };
  (stepsM?.sources || []).forEach(addSource);
  [hr, spo2, sys, weight].forEach((x: QuantitySample | null) => addSource(x?.sourceRevision?.source));
  const sample = (x: QuantitySample | null) => (x && typeof x.quantity === 'number' ? x.quantity : null);
  const sourceOf = (x: QuantitySample | null) => x?.sourceRevision?.source?.name ?? null;

  return {
    steps: readSteps ? chosen.steps : null,
    stepsSource: readSteps ? chosen.name : null,
    stepsAuto: chosen.auto,
    stepsBySource: Array.from(totals.values()).filter((t) => t.steps > 0).sort((a, b) => b.steps - a.steps).map((t) => ({ name: t.name, steps: t.steps })),
    activeEnergyKcal: chosen.energy,
    activeMinutes: chosen.minutes,
    distanceM: chosen.distance,
    restingHeartRate: sample(resting) !== null ? Math.round(sample(resting) as number) : null,
    heartRate: sample(hr) !== null ? Math.round(sample(hr) as number) : null,
    heartRateAt: iso(hr?.endDate), heartRateSource: sourceOf(hr),
    oxygenSaturation: sample(spo2) !== null ? Math.round((sample(spo2) as number) * 1000) / 10 : null,   // HealthKit stores 0..1
    oxygenSaturationAt: iso(spo2?.endDate), oxygenSource: sourceOf(spo2),
    weight: sample(weight),
    bloodPressure: { systolic: sample(sys), diastolic: sample(dia) },
    bloodPressureAt: iso(sys?.endDate), bloodPressureSource: sourceOf(sys),
    sources: Array.from(names),
    readAt: now.toISOString(),
    sampleCounts: { steps: readSteps ? 1 : 0, heartRate: hr ? 1 : 0, oxygenSaturation: spo2 ? 1 : 0, weight: weight ? 1 : 0, sleep: 0, workouts: 0 },
  };
}

// ---- Sending Apple Health data to your account -----------------------------------------------------------------------------
// Doctors, caregivers and alerts read from the backend, so what Apple Health holds is uploaded with the time it was MEASURED.
// A reading the watch took hours ago is therefore shown as hours old, never as live, and an old reading never raises an alarm.
const MAX_AGE_MS = 24 * 3600_000;
let lastSyncAt = 0;
let lastSent = '';

export async function syncHealthKitToBackend(
  snapshot: HealthKitSnapshot,
  send: (payload: Record<string, unknown>) => Promise<unknown>,
  force = false,
): Promise<boolean> {
  const fresh = (at: string | null) => (at ? Date.now() - new Date(at).getTime() < MAX_AGE_MS : false);
  const payload: Record<string, unknown> = { device_id: 'apple-health', device_name: snapshot.sources.length ? `Apple Health (${snapshot.sources.slice(0, 3).join(', ')})` : 'Apple Health' };
  if (snapshot.steps != null) { payload.steps = snapshot.steps; if (snapshot.stepsSource) payload.steps_source = snapshot.stepsSource; }
  if (snapshot.activeEnergyKcal != null) payload.calories = snapshot.activeEnergyKcal;
  if (snapshot.activeMinutes != null) payload.active_minutes = snapshot.activeMinutes;
  if (snapshot.distanceM != null) payload.distance_m = snapshot.distanceM;
  let measuredAt: string | null = null;
  if (snapshot.heartRate != null && fresh(snapshot.heartRateAt)) { payload.heart_rate = snapshot.heartRate; measuredAt = snapshot.heartRateAt; }
  if (snapshot.oxygenSaturation != null && fresh(snapshot.oxygenSaturationAt)) { payload.blood_oxygen = snapshot.oxygenSaturation; measuredAt = measuredAt || snapshot.oxygenSaturationAt; }
  if (snapshot.bloodPressure.systolic != null && snapshot.bloodPressure.diastolic != null && fresh(snapshot.bloodPressureAt)) {
    payload.blood_pressure_systolic = snapshot.bloodPressure.systolic; payload.blood_pressure_diastolic = snapshot.bloodPressure.diastolic; measuredAt = measuredAt || snapshot.bloodPressureAt;
  }
  if (measuredAt) payload.measured_at = measuredAt;
  const hasValue = Object.keys(payload).some((k) => k !== 'device_id' && k !== 'device_name' && k !== 'measured_at' && k !== 'steps_source');
  if (!hasValue) return false;
  const fingerprint = JSON.stringify(payload);
  if (!force && (Date.now() - lastSyncAt < 60_000 || fingerprint === lastSent)) return false;      // nothing new, or just sent
  await send(payload);
  lastSyncAt = Date.now(); lastSent = fingerprint;
  return true;
}

/** Calls onChange when Apple Health receives new heart rate, steps or oxygen readings (for example after the watch app syncs). */
export function watchHealthKit(onChange: () => void): () => void {
  const healthKit = getNativeHealthKit();
  if (Platform.OS !== 'ios' || isExpoGo() || !healthKit?.subscribeToChanges) return () => {};
  let timer: ReturnType<typeof setTimeout> | null = null;
  const fire = () => { if (timer) clearTimeout(timer); timer = setTimeout(onChange, 1500); };
  const subs: any[] = [];
  for (const id of ['HKQuantityTypeIdentifierHeartRate', 'HKQuantityTypeIdentifierStepCount', 'HKQuantityTypeIdentifierOxygenSaturation', 'HKQuantityTypeIdentifierBloodPressureSystolic']) {
    try { subs.push(healthKit.subscribeToChanges(id, fire)); } catch { /* this type is not available on the device */ }
  }
  return () => { if (timer) clearTimeout(timer); subs.forEach((x) => { try { typeof x === 'function' ? x() : x?.remove?.(); } catch { /* already removed */ } }); };
}

export type HealthKitHistory = {
  steps: readonly unknown[];
  heartRate: readonly unknown[];
  oxygenSaturation: readonly unknown[];
  weight: readonly unknown[];
  bloodPressureSystolic: readonly unknown[];
  bloodPressureDiastolic: readonly unknown[];
  sleep: readonly unknown[];
  workouts: readonly unknown[];
};

export async function readHealthKitHistory(): Promise<HealthKitHistory> {
  const healthKit = getNativeHealthKit();
  if (Platform.OS !== 'ios' || isExpoGo() || !healthKit || !healthKit.isHealthDataAvailable()) {
    return { steps: [], heartRate: [], oxygenSaturation: [], weight: [], bloodPressureSystolic: [], bloodPressureDiastolic: [], sleep: [], workouts: [] };
  }
  const [steps, heartRate, oxygenSaturation, weight, bloodPressureSystolic, bloodPressureDiastolic, sleep, workouts] = await Promise.all([
    healthKit.queryQuantitySamples('HKQuantityTypeIdentifierStepCount', { unit: 'count', limit: -1, ascending: true }),
    healthKit.queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', { unit: 'count/min', limit: -1, ascending: true }),
    healthKit.queryQuantitySamples('HKQuantityTypeIdentifierOxygenSaturation', { unit: '%', limit: -1, ascending: true }),
    healthKit.queryQuantitySamples('HKQuantityTypeIdentifierBodyMass', { unit: 'kg', limit: -1, ascending: true }),
    healthKit.queryQuantitySamples('HKQuantityTypeIdentifierBloodPressureSystolic', { unit: 'mmHg', limit: -1, ascending: true }),
    healthKit.queryQuantitySamples('HKQuantityTypeIdentifierBloodPressureDiastolic', { unit: 'mmHg', limit: -1, ascending: true }),
    healthKit.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', { limit: -1, ascending: true }),
    healthKit.queryWorkoutSamples({ limit: -1, ascending: true }),
  ]);
  return { steps, heartRate, oxygenSaturation, weight, bloodPressureSystolic, bloodPressureDiastolic, sleep, workouts };
}


// ---- Weight and sleep, so nobody has to type them in ------------------------------------------------------------------------------
export type SleepNightRow = { start: string; end: string; asleep_min: number; awake_min: number; deep_min: number; rem_min: number; light_min: number; stages?: { stage: 'awake' | 'light' | 'deep' | 'rem'; start: string; end: string }[] };

/** Turns Apple Health's sleep samples into nights. Only time actually marked asleep counts (core, deep, REM, or unspecified);
 *  "In bed" alone is not sleep, so a phone that only knows the person was in bed reports no night rather than a made-up one.
 *  Samples closer than two hours belong to the same night. Identical samples written by two apps are counted once. */
const STAGE_OF: Record<number, 'awake' | 'light' | 'deep' | 'rem'> = { 2: 'awake', 3: 'light', 4: 'deep', 5: 'rem' };
/** The night as stage segments for the sleep chart (awake, light, deep, REM). Nothing is returned when the source only says "asleep". */
function stagesOf(list: { v: number; a: number; b: number }[]) {
  const out: { stage: 'awake' | 'light' | 'deep' | 'rem'; start: number; end: number }[] = [];
  for (const x of list) {
    const stage = STAGE_OF[x.v];
    if (!stage) continue;
    const last = out[out.length - 1];
    if (last && last.stage === stage && x.a - last.end <= 60_000) last.end = Math.max(last.end, x.b);       // join touching segments of the same stage
    else out.push({ stage, start: x.a, end: x.b });
  }
  if (!out.length) return {};
  return { stages: out.slice(0, 600).map((g) => ({ stage: g.stage, start: new Date(g.start).toISOString(), end: new Date(g.end).toISOString() })) };
}

export function buildSleepNights(samples: readonly any[], now: Date = new Date()): SleepNightRow[] {
  const ASLEEP = new Set([1, 3, 4, 5]);
  const seen = new Set<string>();
  const rows = (samples || [])
    .map((x) => ({ v: Number(x?.value), a: new Date(x?.startDate).getTime(), b: new Date(x?.endDate).getTime() }))
    .filter((x) => Number.isFinite(x.a) && Number.isFinite(x.b) && x.b > x.a && (ASLEEP.has(x.v) || x.v === 2))
    .filter((x) => { const k = `${x.v}|${x.a}|${x.b}`; if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((p, q) => p.a - q.a);
  const nights: SleepNightRow[] = [];
  let cur: { a: number; b: number; list: typeof rows } | null = null;
  const close = () => {
    if (!cur) return;
    const min = (pred: (v: number) => boolean) => Math.round(cur!.list.filter((x) => pred(x.v)).reduce((t, x) => t + (x.b - x.a), 0) / 60000);
    const asleep = min((v) => ASLEEP.has(v));
    if (asleep >= 30 && cur.b <= now.getTime()) {
      nights.push({ start: new Date(cur.a).toISOString(), end: new Date(cur.b).toISOString(), asleep_min: asleep, awake_min: min((v) => v === 2),
        deep_min: min((v) => v === 4), rem_min: min((v) => v === 5), light_min: min((v) => v === 1 || v === 3), ...stagesOf(cur.list) });
    }
    cur = null;
  };
  for (const x of rows) {
    if (cur && x.a - cur.b > 2 * 3600_000) close();
    if (!cur) cur = { a: x.a, b: x.b, list: [x] };
    else { cur.b = Math.max(cur.b, x.b); cur.list.push(x); }
  }
  close();
  return nights;
}

/** The last 180 days of weigh-ins and the last 21 days of sleep from Apple Health. Empty when Health is not connected. */
export async function readWeightAndSleep(): Promise<{ weights: { kg: number; at: string }[]; nights: SleepNightRow[] }> {
  const healthKit: any = getNativeHealthKit();
  if (Platform.OS !== 'ios' || isExpoGo() || !healthKit || !healthKit.isHealthDataAvailable()) return { weights: [], nights: [] };
  const now = new Date();
  const since = (days: number) => ({ filter: { date: { startDate: new Date(now.getTime() - days * 86400000), endDate: now } } });
  const [w, s] = await Promise.allSettled([
    healthKit.queryQuantitySamples('HKQuantityTypeIdentifierBodyMass', { unit: 'kg', limit: 200, ascending: false, ...since(180) }),
    healthKit.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', { limit: 2000, ascending: true, ...since(21) }),
  ]);
  const weights = (w.status === 'fulfilled' ? (w.value as any[]) : [])
    .map((x) => ({ kg: Number(x?.quantity), at: iso(x?.startDate) as string }))
    .filter((x) => Number.isFinite(x.kg) && x.kg >= 20 && x.kg <= 400 && x.at);
  return { weights, nights: buildSleepNights(s.status === 'fulfilled' ? (s.value as any[]) : [], now) };
}


/** The native Health module when this is an iPhone development build with Health available; null everywhere else (Android, Expo Go, web). */
export function healthKitOrNull(): any | null {
  const hk: any = getNativeHealthKit();
  if (Platform.OS !== 'ios' || isExpoGo() || !hk || !hk.isHealthDataAvailable()) return null;
  return hk;
}

// ---- Windowed reads for the Health screen --------------------------------------------------------------------------------------------
/** Only what the Health screen draws: 30 days of heart rate, 14 days of steps (daily totals, the same figures the Health app shows),
 *  17 days of sleep, 4 months of weight, and the latest oxygen and blood pressure. Never the whole history. Null when Health is not available. */
export async function readInsightData(): Promise<import('./healthMath').RawInsight | null> {
  const hk: any = getNativeHealthKit();
  if (Platform.OS !== 'ios' || isExpoGo() || !hk || !hk.isHealthDataAvailable()) return null;
  const now = new Date();
  const win = (days: number) => ({ filter: { date: { startDate: new Date(now.getTime() - days * 86400000), endDate: now } } });
  const quantity = (id: string, unit: string, days: number, limit: number) => hk.queryQuantitySamples(id, { unit, limit, ascending: false, ...win(days) });
  const anchor = new Date(now); anchor.setHours(0, 0, 0, 0); anchor.setDate(anchor.getDate() - 13);
  const [hr, resting, steps, sleep, weight, spo2, sys, dia] = await Promise.allSettled([
    quantity('HKQuantityTypeIdentifierHeartRate', 'count/min', 30, 8000),
    quantity('HKQuantityTypeIdentifierRestingHeartRate', 'count/min', 30, 400),
    hk.queryStatisticsCollectionForQuantity('HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], anchor, { day: 1 }, { filter: { date: { startDate: anchor, endDate: now } }, unit: 'count' }),
    hk.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', { limit: 4000, ascending: true, ...win(17) }),
    quantity('HKQuantityTypeIdentifierBodyMass', 'kg', 120, 300),
    quantity('HKQuantityTypeIdentifierOxygenSaturation', '%', 30, 20),
    quantity('HKQuantityTypeIdentifierBloodPressureSystolic', 'mmHg', 30, 10),
    quantity('HKQuantityTypeIdentifierBloodPressureDiastolic', 'mmHg', 30, 10),
  ]);
  const pts = (r: PromiseSettledResult<any>) => (r.status === 'fulfilled' ? (r.value as any[]) : [])
    .map((x) => ({ t: new Date(x?.startDate).getTime(), v: Number(x?.quantity) })).filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v));
  const stepDays = (steps.status === 'fulfilled' ? (steps.value as any[]) : [])
    .map((x) => ({ t: new Date(x?.startDate).getTime(), v: Number(x?.sumQuantity?.quantity) })).filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v));
  const nights = buildSleepNights(sleep.status === 'fulfilled' ? (sleep.value as any[]) : [], now).map((n) => ({ end: n.end, asleep_min: n.asleep_min }));
  return { hr: pts(hr), resting: pts(resting), stepDays, nights, weight: pts(weight), spo2: pts(spo2), sys: pts(sys), dia: pts(dia) };
}
