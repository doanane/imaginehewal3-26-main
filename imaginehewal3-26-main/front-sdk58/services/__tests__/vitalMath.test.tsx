import { KINDS, bucketize, bucketizeBp, dailyAverage, emptyBuckets, formatValue, headline, niceScale, scaleFor, windowFor, axisLabels } from '../vitalMath';

const NOW = new Date('2026-11-14T15:20:00');
const at = (d: number, h = 0, m = 0) => new Date(2026, 10, d, h, m).getTime();

test('every range cuts its period into the right number of buckets', () => {
  const n = (r: any) => windowFor(r, 0, NOW).edges.length - 1;
  expect([n('H'), n('D'), n('W'), n('M'), n('6M'), n('Y')]).toEqual([12, 24, 7, 30, 26, 12]);
});

test('the hour window is the clock hour you are in, and offset steps back one hour at a time', () => {
  const w = windowFor('H', 0, NOW);
  expect(w.start).toBe(at(14, 15)); expect(w.end).toBe(at(14, 16));
  expect(windowFor('H', 2, NOW).start).toBe(at(14, 13));
});

test('week and month end today; paging back moves a whole period', () => {
  const w = windowFor('W', 0, NOW);
  expect(w.start).toBe(at(8)); expect(w.end).toBe(at(15));
  expect(windowFor('W', 1, NOW).end).toBe(at(8));
  expect(windowFor('M', 0, NOW).start).toBe(at(14 - 29));
});

test('the year window is twelve calendar months ending this month', () => {
  const w = windowFor('Y', 0, NOW);
  expect(new Date(w.start).getMonth()).toBe(11);           // December of last year
  expect(new Date(w.start).getFullYear()).toBe(2025);
  expect(new Date(w.end).getMonth()).toBe(11);             // the start of next December closes November
});

test('heart rate in an hour: the figure is the lowest to the highest reading (like Health: 81 to 93)', () => {
  const win = windowFor('H', 0, new Date(2026, 10, 10, 22, 30));            // the 10 to 11 PM hour that evening
  expect(win.start).toBe(new Date(2026, 10, 10, 22).getTime());
  const pts = [88, 89, 93, 92, 90, 88, 86, 81, 81, 81].map((v, i) => ({ t: new Date(2026, 10, 10, 22, i * 5).getTime(), v }));
  const b = bucketize(pts, win);
  expect(headline('hr', win, b, null)).toEqual({ label: 'RANGE', value: '81–93', unit: 'BPM' });
  expect(b.filter((x) => x.count).length).toBe(10);
  expect(headline('hr', win, b, 2).value).toBe('93');                       // touching one bucket narrows the figure to it
});

test('a bucket keeps its lowest, highest and average', () => {
  const win = windowFor('D', 0, NOW);
  const b = bucketize([{ t: at(14, 9, 5), v: 70 }, { t: at(14, 9, 40), v: 90 }], win);
  expect(b[9]).toMatchObject({ count: 2, min: 70, max: 90, avg: 80 });
  expect(b[10].count).toBe(0);
});

test('readings outside the window are ignored, and nothing at all gives "--" rather than a made-up figure', () => {
  const win = windowFor('D', 0, NOW);
  const b = bucketize([{ t: at(13, 23), v: 70 }, { t: at(15, 1), v: 99 }], win);
  expect(b.every((x) => x.count === 0)).toBe(true);
  expect(headline('hr', win, b, null).value).toBe('--');
});

test('steps: total for an hour or day, daily average for longer periods', () => {
  const day = windowFor('D', 0, NOW);
  const hours = emptyBuckets(day).map((b, i) => (i === 8 ? { ...b, count: 1, sum: 3000, avg: 3000, min: 3000, max: 3000 } : i === 12 ? { ...b, count: 1, sum: 2000, avg: 2000, min: 2000, max: 2000 } : b));
  expect(headline('steps', day, hours, null)).toMatchObject({ label: 'TOTAL', value: '5,000' });
  const wk = windowFor('W', 0, NOW);
  const days = emptyBuckets(wk).map((b, i) => (i < 2 ? { ...b, count: 1, sum: [4000, 8000][i], avg: 0, min: 0, max: 0 } : b));
  expect(headline('steps', wk, days, null)).toMatchObject({ label: 'DAILY AVERAGE', value: '6,000' });
});

test('on the 6 month and year charts steps are shown as a daily average per week or month', () => {
  const win = windowFor('6M', 0, NOW);
  const b = emptyBuckets(win); b[3] = { ...b[3], count: 1, sum: 70000, avg: 70000, min: 70000, max: 70000 };
  expect(dailyAverage(b)[3].avg).toBe(10000);
});

test('sleep is shown as hours and minutes, weight with one decimal', () => {
  expect(formatValue('sleep', 7.2)).toBe('7 hr 12 min');
  expect(formatValue('sleep', 0.5)).toBe('30 min');
  expect(formatValue('weight', 72)).toBe('72.0');
});

test('blood pressure: one bar spans both numbers and the figure shows both ranges', () => {
  const win = windowFor('W', 0, NOW);
  const t = at(12, 8);
  const b = bucketizeBp([{ t, v: 132 }, { t: t + 1, v: 118 }], [{ t, v: 84 }, { t: t + 1, v: 76 }], win);
  expect(headline('bp', win, b, null)).toEqual({ label: 'RANGE', value: '118–132 / 76–84', unit: 'mmHg' });
  expect(b[4]).toMatchObject({ min: 76, max: 132 });
});

test('the scale gives round tick marks and always includes every reading', () => {
  const s = niceScale(81, 93, 4);
  expect(s.min).toBeLessThanOrEqual(81); expect(s.max).toBeGreaterThanOrEqual(93);
  expect(s.ticks.length).toBeGreaterThanOrEqual(3);
  expect(niceScale(0, 0).ticks.length).toBeGreaterThan(1);                  // a flat line still gets a usable scale
  const win = windowFor('W', 0, NOW);
  const bars = emptyBuckets(win).map((b, i) => (i === 0 ? { ...b, count: 1, avg: 9100, sum: 9100, min: 9100, max: 9100 } : b));
  expect(scaleFor('steps', bars).min).toBe(0);                              // bar charts start at zero
});

test('each range labels its axis and each vital lists only ranges that make sense for it', () => {
  expect(axisLabels(windowFor('W', 0, NOW))).toHaveLength(7);
  expect(axisLabels(windowFor('Y', 0, NOW))).toHaveLength(12);
  expect(KINDS.weight.ranges).toEqual(['W', 'M', '6M', 'Y']);               // one weigh-in a day: an hour or day view would be empty
  expect(KINDS.hr.ranges).toHaveLength(6);
});
