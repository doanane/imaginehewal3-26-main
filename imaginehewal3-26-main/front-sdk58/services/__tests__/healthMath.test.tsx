import { buildInsights, dailyMeans, fmtKg, heartSummary, hourlyMeans, lastDays, weekCompare, weekRows, weightChange } from '../healthMath';

const NOW = new Date('2026-11-14T15:00:00');
const at = (daysAgo: number, hour = 12) => { const d = new Date(NOW); d.setDate(d.getDate() - daysAgo); d.setHours(hour, 0, 0, 0); return d.getTime(); };

test('weight is shown with one decimal, never the raw float', () => {
  expect(fmtKg(125.66348944538022)).toBe('125.7');
  expect(fmtKg(80)).toBe('80.0');
});

test('lastDays ends today and is oldest first', () => {
  const d = lastDays(3, NOW);
  expect(d).toEqual(['2026-11-12', '2026-11-13', '2026-11-14']);
});

test('heart summary: latest reading, today range, hourly and daily series', () => {
  const s = heartSummary([{ t: at(0, 9), v: 70 }, { t: at(0, 9) + 600_000, v: 74 }, { t: at(0, 13), v: 110 }, { t: at(2, 10), v: 66 }, { t: at(20, 10), v: 80 }], NOW);
  expect(s.latest).toEqual({ t: at(0, 13), v: 110 });
  expect(s.today).toEqual({ min: 70, avg: 85, max: 110, n: 3 });
  expect(s.last24h.map((p) => p.v)).toEqual([72, 110]);                 // two readings in one hour become one point
  expect(s.last7d).toHaveLength(3);
  expect(s.last30d).toHaveLength(3);                                    // today, two days ago, twenty days ago
  expect(s.count30).toBe(5);
  expect(heartSummary([], NOW)).toMatchObject({ latest: null, today: null, last24h: [], count30: 0 });
});

test('an old reading is still the latest (it is not hidden, and the screen says how old it is)', () => {
  const s = heartSummary([{ t: at(9, 8), v: 71 }], NOW);
  expect(s.latest!.v).toBe(71);
  expect(s.today).toBeNull();
});

test('week comparison uses the days that have data', () => {
  const series = lastDays(14, NOW).map((day, i) => ({ day, v: i < 7 ? 60 : i === 10 ? null : 64 }));
  expect(weekCompare(series)).toEqual({ thisWeek: 64, lastWeek: 60 });
  expect(weekCompare([{ day: 'a', v: 5 }])).toEqual({ thisWeek: 5, lastWeek: null });
});

test('weight change needs an earlier reading about half the window ago, otherwise it says nothing', () => {
  expect(weightChange([{ t: at(0), v: 80 }], NOW)).toMatchObject({ change: null });
  expect(weightChange([{ t: at(5), v: 81 }, { t: at(0), v: 80.5 }], NOW)).toMatchObject({ change: null });
  expect(weightChange([{ t: at(32), v: 82 }, { t: at(0), v: 80.4 }], NOW)).toMatchObject({ change: -1.6, spanDays: 32 });
  expect(weightChange([], NOW)).toBeNull();
});

test('hourly means ignore readings before the window', () => {
  expect(hourlyMeans([{ t: at(3), v: 60 }, { t: at(0, 8), v: 70 }], at(1))).toHaveLength(1);
});

test('the week rows tell the truth and leave out what has no data', () => {
  const raw = {
    hr: [], resting: lastDays(14, NOW).map((d, i) => ({ t: new Date(`${d}T09:00:00`).getTime(), v: i < 7 ? 72 : 68 })),
    stepDays: lastDays(14, NOW).map((d, i) => ({ t: new Date(`${d}T00:00:00`).getTime(), v: i < 7 ? 8000 : 5000 })),
    nights: lastDays(14, NOW).map((d) => ({ end: `${d}T07:00:00`, asleep_min: 330 })),
    weight: [{ t: at(30), v: 82 }, { t: at(0), v: 80.4 }], spo2: [], sys: [], dia: [],
  };
  const i = buildInsights(raw, NOW);
  expect(i.oxygen).toBeNull();
  expect(i.bp).toBeNull();
  const rows = weekRows(i);
  const by = Object.fromEntries(rows.map((r) => [r.key, r]));
  expect(by.resting.change).toContain('Down 4');
  expect(by.resting.tone).toBe('good');
  expect(by.steps.value).toBe('5,000');
  expect(by.steps.tone).toBe('watch');                                  // 37% fewer steps than the week before
  expect(by.sleep.value).toBe('5h 30m');
  expect(by.sleep.tone).toBe('watch');
  expect(by.weight.value).toBe('80.4');
  expect(by.weight.change).toContain('Down 1.6 kg');
  expect(weekRows(buildInsights({ hr: [], resting: [], stepDays: [], nights: [], weight: [], spo2: [], sys: [], dia: [] }, NOW))).toEqual([]);
});
