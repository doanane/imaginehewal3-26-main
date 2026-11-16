/** The shared sync: connected, disconnected, offline, and the saved figures being cleared after an upload so the rings reload. */
const mockApi = { ingestVitals: jest.fn(async (_p: any) => ({ ok: true })), invalidateApiCache: jest.fn() };
const mockQueue = { queued: [] as any[] };
let mockConnected = true;
let mockSnapshot: any;

jest.mock('../api', () => ({ __esModule: true, default: { ingestVitals: (p: any) => mockApi.ingestVitals(p), invalidateApiCache: () => mockApi.invalidateApiCache() } }));
jest.mock('../offlineVitals', () => ({ flushVitalQueue: async () => {}, queueVital: async (p: any) => { mockQueue.queued.push(p); } }));
jest.mock('../healthkit', () => ({
  getHealthKitConnection: async () => ({ available: true, connected: mockConnected }),
  readHealthKitSnapshot: async () => mockSnapshot,
  setStepSourcePref: async () => {},
  watchHealthKit: () => () => {},
  syncHealthKitToBackend: async (snap: any, send: (p: any) => Promise<void>) => { await send({ device_id: 'apple-health', steps: snap.steps }); return true; },
}));
jest.mock('react-native', () => ({ AppState: { addEventListener: () => ({ remove: () => {} }) } }));

import { __resetHealthSync, chooseStepSource, getHealthSyncState, syncNow } from '../healthSync';

beforeEach(() => {
  __resetHealthSync(); mockConnected = true; mockSnapshot = { steps: 8420 };
  mockApi.ingestVitals.mockClear(); mockApi.invalidateApiCache.mockClear(); mockQueue.queued = [];
  mockApi.ingestVitals.mockImplementation(async () => ({ ok: true }));
});

test('connected: reads, uploads, clears the saved figures and counts the upload', async () => {
  await syncNow({ force: true });
  const s = getHealthSyncState();
  expect(s.status).toBe('ok'); expect(s.snapshot).toEqual({ steps: 8420 }); expect(s.uploads).toBe(1); expect(s.uploadedAt).not.toBeNull();
  expect(mockApi.ingestVitals).toHaveBeenCalledWith(expect.objectContaining({ steps: 8420 }));
  expect(mockApi.invalidateApiCache).toHaveBeenCalledTimes(1);          // so the rings are fetched again, not shown from the saved copy
});

test('disconnected: nothing is read or uploaded and the state says so', async () => {
  mockConnected = false;
  await syncNow({ force: true });
  const s = getHealthSyncState();
  expect(s.status).toBe('disconnected'); expect(s.snapshot).toBeNull(); expect(mockApi.ingestVitals).not.toHaveBeenCalled();
});

test('offline: the reading is kept on the phone, the state says offline, and nothing claims it was shared', async () => {
  mockApi.ingestVitals.mockImplementation(async () => { throw new Error('network'); });
  await syncNow({ force: true });
  const s = getHealthSyncState();
  expect(s.status).toBe('offline'); expect(s.error).toMatch(/saved on this phone/); expect(s.uploads).toBe(0); expect(s.uploadedAt).toBeNull();
  expect(mockQueue.queued).toHaveLength(1);
  expect(mockApi.invalidateApiCache).not.toHaveBeenCalled();
});

test('many screens asking at once cause one read; a forced sync always reads', async () => {
  await Promise.all([syncNow(), syncNow(), syncNow()]);
  expect(mockApi.ingestVitals).toHaveBeenCalledTimes(1);
  await syncNow();                                                       // within 20 seconds: skipped
  expect(mockApi.ingestVitals).toHaveBeenCalledTimes(1);
  await syncNow({ force: true });
  expect(mockApi.ingestVitals).toHaveBeenCalledTimes(2);
});

test('choosing a step source syncs again straight away', async () => {
  await chooseStepSource('iPhone');
  expect(mockApi.ingestVitals).toHaveBeenCalledTimes(1);
});
