import { buildSleepNights } from '../healthkit';

jest.mock('expo-constants', () => ({ __esModule: true, default: { executionEnvironment: 'standalone' } }));

const min = (m: number) => m * 60000;
const t0 = new Date('2026-11-13T22:00:00Z').getTime();
const s = (v: number, startMin: number, lenMin: number) => ({ value: v, startDate: new Date(t0 + min(startMin)), endDate: new Date(t0 + min(startMin + lenMin)) });
const NOW = new Date('2026-11-14T12:00:00Z');

test('stages add up to one night with deep, REM, light and awake time', () => {
  const nights = buildSleepNights([s(3, 0, 120), s(4, 120, 60), s(2, 180, 10), s(5, 190, 90), s(3, 280, 100)], NOW);
  expect(nights).toHaveLength(1);
  expect(nights[0]).toMatchObject({ asleep_min: 370, awake_min: 10, deep_min: 60, rem_min: 90, light_min: 220 });
  expect(nights[0].start).toBe(new Date(t0).toISOString());
  expect(nights[0].stages?.map((g) => g.stage)).toEqual(['light', 'deep', 'awake', 'rem', 'light']);   // the chart gets the order of the night
});

test('a source that only says asleep gives no stages', () => {
  expect(buildSleepNights([s(1, 0, 400)], NOW)[0].stages).toBeUndefined();
});

test('in bed alone is not sleep', () => {
  expect(buildSleepNights([s(0, 0, 480)], NOW)).toEqual([]);
});

test('two sleeps more than two hours apart are two nights; a nap too short to count is dropped', () => {
  const nights = buildSleepNights([s(1, 0, 300), s(1, 300 + 200, 20), s(1, 24 * 60, 360)], new Date('2026-11-15T12:00:00Z'));
  expect(nights.map((n) => n.asleep_min)).toEqual([300, 360]);
});

test('the same sample written by two apps counts once, and a night that has not ended yet is left out', () => {
  expect(buildSleepNights([s(1, 0, 400), s(1, 0, 400)], NOW)[0].asleep_min).toBe(400);
  expect(buildSleepNights([s(1, 0, 400)], new Date(t0 + min(100)))).toEqual([]);
});
