import { buildSleepNights, healthKitOrNull } from './healthkit';
import { Bucket, Kind, Pt, Win, bucketIndex, bucketize, bucketizeBp, dailyAverage, emptyBuckets, formatValue, KINDS } from './vitalMath';

export type Latest = { t: number; text: string } | null;
export type Series = { available: boolean; buckets: Bucket[]; latest: Latest };

const ID = {
  hr: 'HKQuantityTypeIdentifierHeartRate', resting: 'HKQuantityTypeIdentifierRestingHeartRate', steps: 'HKQuantityTypeIdentifierStepCount',
  weight: 'HKQuantityTypeIdentifierBodyMass', spo2: 'HKQuantityTypeIdentifierOxygenSaturation',
  sys: 'HKQuantityTypeIdentifierBloodPressureSystolic', dia: 'HKQuantityTypeIdentifierBloodPressureDiastolic',
} as const;
const UNIT = { hr: 'count/min', resting: 'count/min', steps: 'count', weight: 'kg', spo2: '%', sys: 'mmHg', dia: 'mmHg' } as const;
const pct = (v: number) => (v <= 1.5 ? v * 100 : v);          // Health can hand oxygen back as a fraction; the screen always shows 0 to 100

/** Everything one chart needs for one period of one vital, read straight from Apple Health. Nothing is stored or invented. */
export async function fetchVital(kind: Kind, win: Win, now: Date = new Date()): Promise<Series> {
  const hk = healthKitOrNull();
  if (!hk) return { available: false, buckets: emptyBuckets(win), latest: null };
  const to = new Date(Math.min(win.end, now.getTime()));
  const filter = { filter: { date: { startDate: new Date(win.start), endDate: to } } };
  const samples = async (key: keyof typeof ID, limit = 5000): Promise<Pt[]> => {
    const rows: any[] = await hk.queryQuantitySamples(ID[key], { unit: UNIT[key], limit, ascending: true, ...filter });
    return rows.map((x) => ({ t: new Date(x?.startDate).getTime(), v: key === 'spo2' ? pct(Number(x?.quantity)) : Number(x?.quantity) })).filter((p) => Number.isFinite(p.t) && Number.isFinite(p.v));
  };
  const latestOf = async (key: keyof typeof ID): Promise<{ t: number; v: number } | null> => {
    const r: any[] = await hk.queryQuantitySamples(ID[key], { unit: UNIT[key], limit: 1, ascending: false });
    const x = r?.[0];
    if (!x) return null;
    const v = key === 'spo2' ? pct(Number(x.quantity)) : Number(x.quantity);
    return Number.isFinite(v) ? { t: new Date(x.startDate).getTime(), v } : null;
  };
  const stats = async (key: keyof typeof ID, what: string[]): Promise<any[]> =>
    hk.queryStatisticsCollectionForQuantity(ID[key], what, new Date(win.start), win.interval, { ...filter, unit: UNIT[key] });
  const place = (rows: any[], fill: (b: Bucket, r: any) => Bucket): Bucket[] => {
    const out = emptyBuckets(win);
    for (const r of rows) {
      const i = bucketIndex(win, new Date(r?.startDate).getTime());
      if (i >= 0) out[i] = fill(out[i], r);
    }
    return out;
  };

  try {
    if (kind === 'hr' || kind === 'spo2') {
      const key = kind;
      const norm = (q: any) => (q?.quantity == null ? null : key === 'spo2' ? pct(Number(q.quantity)) : Number(q.quantity));
      const buckets = win.range === 'H' ? bucketize(await samples(key), win)
        : place(await stats(key, ['discreteMin', 'discreteMax', 'discreteAverage']), (b, r) => {
          const lo = norm(r.minimumQuantity), hi = norm(r.maximumQuantity), avg = norm(r.averageQuantity);
          return lo == null || hi == null ? b : { ...b, count: 1, min: lo, max: hi, avg: avg ?? (lo + hi) / 2 };
        });
      const l = await latestOf(key);
      return { available: true, buckets, latest: l ? { t: l.t, text: `${formatValue(kind, l.v)} ${KINDS[kind].unit}` } : null };
    }
    if (kind === 'resting' || kind === 'weight') {
      const l = await latestOf(kind);
      return { available: true, buckets: bucketize(await samples(kind, 2000), win), latest: l ? { t: l.t, text: `${formatValue(kind, l.v)} ${KINDS[kind].unit}` } : null };
    }
    if (kind === 'bp') {
      const [sys, dia, ls, ld] = await Promise.all([samples('sys', 3000), samples('dia', 3000), latestOf('sys'), latestOf('dia')]);
      return { available: true, buckets: bucketizeBp(sys, dia, win), latest: ls && ld ? { t: Math.max(ls.t, ld.t), text: `${Math.round(ls.v)}/${Math.round(ld.v)} mmHg` } : null };
    }
    if (kind === 'steps') {
      // statistics, not raw samples: Health merges the phone and the watch so a step is never counted twice
      const rows = await stats('steps', ['cumulativeSum']);
      let buckets = place(rows, (b, r) => {
        const v = Number(r?.sumQuantity?.quantity);
        return Number.isFinite(v) && v > 0 ? { ...b, count: 1, sum: v, avg: v, min: v, max: v } : b;
      });
      if (win.range === '6M' || win.range === 'Y') buckets = dailyAverage(buckets);
      const day = new Date(now); day.setHours(0, 0, 0, 0);
      const today: any = await hk.queryStatisticsForQuantity(ID.steps, ['cumulativeSum'], { filter: { date: { startDate: day, endDate: now } }, unit: 'count' });
      const n = Number(today?.sumQuantity?.quantity);
      return { available: true, buckets, latest: Number.isFinite(n) ? { t: now.getTime(), text: `${Math.round(n).toLocaleString()} steps today` } : null };
    }
    // sleep: only time asleep counts; each night belongs to the day it ended
    const rows: any[] = await hk.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
      limit: 20000, ascending: true, filter: { date: { startDate: new Date(win.start - 86_400_000), endDate: to } },
    });
    const nights = buildSleepNights(rows, to);
    const buckets = bucketize(nights.map((n) => ({ t: new Date(n.end).getTime(), v: n.asleep_min / 60 })), win);
    const last = nights[nights.length - 1];
    return { available: true, buckets, latest: last ? { t: new Date(last.end).getTime(), text: formatValue('sleep', last.asleep_min / 60) } : null };
  } catch {
    return { available: true, buckets: emptyBuckets(win), latest: null };
  }
}
