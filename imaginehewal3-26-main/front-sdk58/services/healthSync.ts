/**
 * One place that keeps HEWAL3 in step with Apple Health (and so with HUAWEI Health, oraimo health and the iPhone itself).
 *
 * Every screen that shows health numbers reads this state, so Home, Health and Devices can never disagree, and there is exactly one
 * code path that reads Apple Health and uploads to the backend. It syncs:
 *   - when a screen that needs it opens,
 *   - the moment Apple Health receives new data (for example after the watch app syncs),
 *   - when the app comes back to the foreground,
 *   - every two minutes while a health screen is open.
 * After an upload the app's saved copy of the figures is cleared, so the rings and tiles are re-read from the backend straight away.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import api from './api';
import {
  readWeightAndSleep, getHealthKitConnection, HealthKitConnection, HealthKitSnapshot, readHealthKitSnapshot, setStepSourcePref, syncHealthKitToBackend, watchHealthKit,
} from './healthkit';
import { flushVitalQueue, queueVital } from './offlineVitals';

export type SyncStatus = 'idle' | 'syncing' | 'ok' | 'offline' | 'disconnected' | 'unavailable';
export type HealthSyncState = {
  status: SyncStatus;
  connection: HealthKitConnection | null;
  snapshot: HealthKitSnapshot | null;
  readAt: number | null;          // when Apple Health was last read
  uploadedAt: number | null;      // when new figures were last sent to the backend (and so to caregivers and doctors)
  uploads: number;                // counts uploads, so a screen can reload its backend figures when it changes
  error: string | null;
};

let state: HealthSyncState = { status: 'idle', connection: null, snapshot: null, readAt: null, uploadedAt: null, uploads: 0, error: null };
const listeners = new Set<() => void>();
const set = (patch: Partial<HealthSyncState>) => { state = { ...state, ...patch }; listeners.forEach((l) => l()); };

let inFlight: Promise<void> | null = null;
let lastRun = 0;
let lastBodySync = 0;

/** Weight and sleep come from Apple Health too, so they never have to be typed in. Sent at most every 30 minutes; the server stores each one once. */
async function syncBodyAndSleep(force: boolean) {
  if (!force && Date.now() - lastBodySync < 30 * 60_000) return;
  lastBodySync = Date.now();
  try {
    const { weights, nights } = await readWeightAndSleep();
    const [w, s] = await Promise.all([
      weights.length ? api.importWeightFromHealth(weights) : Promise.resolve({ added: 0 }),
      nights.length ? api.importSleepFromHealth(nights) : Promise.resolve({ added: 0 }),
    ]);
    if (w.added || s.added) api.invalidateApiCache();                    // the weight and sleep screens should show what was just added
  } catch { lastBodySync = 0; }                                          // offline or refused: try again on the next sync
}

export function syncNow(opts: { force?: boolean } = {}): Promise<void> {
  if (inFlight) return inFlight;
  if (!opts.force && Date.now() - lastRun < 20_000) return Promise.resolve();      // many screens ask at once; one read is enough
  lastRun = Date.now();
  inFlight = (async () => {
    try {
      const connection = await getHealthKitConnection();
      if (!connection.connected) {
        set({ connection, snapshot: null, status: connection.available ? 'disconnected' : 'unavailable', error: null });
        return;
      }
      set({ connection, status: 'syncing' });
      const snapshot = await readHealthKitSnapshot();
      set({ snapshot, readAt: Date.now() });
      let offline = false;
      const uploaded = await syncHealthKitToBackend(snapshot, async (payload) => {
        try { await flushVitalQueue((q) => api.ingestVitals(q as any)); await api.ingestVitals(payload as any); }
        catch { offline = true; await queueVital(payload as any); }                  // kept on the phone and sent when the network returns
      }, !!opts.force);
      void syncBodyAndSleep(!!opts.force);
      if (uploaded && !offline) {
        api.invalidateApiCache();                                                    // the backend figures just changed: do not show the saved copy
        set({ uploadedAt: Date.now(), uploads: state.uploads + 1 });
      }
      set({ status: offline ? 'offline' : 'ok', error: offline ? 'Could not reach HEWAL3. Your readings are saved on this phone and will upload when you are online.' : null });
    } catch (e: any) {
      set({ status: 'offline', error: e?.message || 'Could not read Apple Health.' });
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Choose which app's steps count (or 'auto' for the one with the most), then sync at once. */
export async function chooseStepSource(name: string): Promise<void> {
  await setStepSourcePref(name);
  await syncNow({ force: true });
}

// ---- keep it fresh while a screen needs it -------------------------------------------------------------------------------------
let users = 0;
let stopWatching: (() => void) | null = null;
let timer: ReturnType<typeof setInterval> | null = null;
let appSub: { remove: () => void } | null = null;

function start() {
  stopWatching = watchHealthKit(() => { void syncNow({ force: true }); });
  timer = setInterval(() => { void syncNow(); }, 120_000);
  appSub = AppState.addEventListener('change', (s) => { if (s === 'active') void syncNow(); });
}
function stop() {
  stopWatching?.(); stopWatching = null;
  if (timer) clearInterval(timer); timer = null;
  appSub?.remove(); appSub = null;
}

/** Subscribe a screen to the shared state and keep the sync alive while it is mounted. */
export function useHealthSync(): HealthSyncState & { syncNow: typeof syncNow } {
  useEffect(() => {
    if (users++ === 0) start();
    void syncNow();
    return () => { if (--users === 0) stop(); };
  }, []);
  const snap = useSyncExternalStore((cb) => { listeners.add(cb); return () => { listeners.delete(cb); }; }, () => state, () => state);
  return { ...snap, syncNow };
}

export const getHealthSyncState = () => state;

/** For tests. */
export function __resetHealthSync() {
  stop(); users = 0; inFlight = null; lastRun = 0;
  state = { status: 'idle', connection: null, snapshot: null, readAt: null, uploadedAt: null, uploads: 0, error: null };
}
