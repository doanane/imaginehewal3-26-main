/**
 * Pure maths for the vital-sign detail screen (the Apple Health style chart with H / D / W / M / 6M / Y). No native code here, so it is tested on its own.
 * A "window" is one period you can page back through. It is cut into buckets (5 minutes, hours, days, weeks or months) and each bucket
 * keeps the lowest, highest and average reading and the total, so one drawing routine can show every kind of vital.
 */
export type Range = 'H' | 'D' | 'W' | 'M' | '6M' | 'Y';
export const RANGES: Range[] = ['H', 'D', 'W', 'M', '6M', 'Y'];
export type Kind = 'hr' | 'resting' | 'steps' | 'sleep' | 'weight' | 'spo2' | 'bp';
export type Pt = { t: number; v: number };
export type Interval = { minute?: number; hour?: number; day?: number; month?: number };
export type Win = { range: Range; offset: number; start: number; end: number; edges: number[]; interval: Interval };
export type Bucket = { start: number; end: number; count: number; min: number | null; max: number | null; avg: number | null; sum: number | null; sys?: { min: number; max: number } | null; dia?: { min: number; max: number } | null };

const HOUR = 3_600_000, DAY = 86_400_000;

export type KindInfo = {
  title: string; unit: string; style: 'range' | 'bars' | 'dots'; ranges: Range[]; color: string;
  about: string[]; add?: string;
};
export const KINDS: Record<Kind, KindInfo> = {
  hr: { title: 'Heart rate', unit: 'BPM', style: 'range', ranges: RANGES, color: '#E5484D',
    about: ['Your heart rate is how many times your heart beats each minute. It rises with activity, stress, fever and caffeine, and falls when you rest.',
      'A typical resting heart rate for adults is between 60 and 100 beats a minute. A fit person can be lower. If your heart rate is often outside what is usual for you, or you feel faint or have chest pain, talk to a clinician.'] },
  resting: { title: 'Resting heart rate', unit: 'BPM', style: 'dots', ranges: ['W', 'M', '6M', 'Y'], color: '#E0527A',
    about: ['Your resting heart rate is your calmest rate, measured by a watch when you have been still for a while. A rate that drifts upward over weeks can come from stress, poor sleep, illness or less activity.'] },
  steps: { title: 'Steps', unit: 'steps', style: 'bars', ranges: RANGES, color: '#17924F', add: '/(patient)/activity',
    about: ['Steps are counted by your iPhone and watch. Apple Health combines them without counting the same step twice.',
      'Health agencies suggest about 150 minutes of moderate activity a week. Steps are one way to get there, and any increase helps.'] },
  sleep: { title: 'Sleep', unit: 'hours', style: 'bars', ranges: ['W', 'M', '6M', 'Y'], color: '#5B6FD6', add: '/(patient)/activity/sleep',
    about: ['Only time actually asleep is counted, not time in bed. Most adults need 7 to 9 hours.', 'A steady wake-up time helps more than almost anything else. If you are often tired despite long sleep, or you stop breathing in your sleep, tell your clinician.'] },
  weight: { title: 'Weight', unit: 'kg', style: 'dots', ranges: ['W', 'M', '6M', 'Y'], color: '#8B5CF6', add: '/(patient)/activity/weight',
    about: ['Weight changes a little from day to day with water, food and time of day. The trend over weeks matters more than any one reading.'] },
  spo2: { title: 'Blood oxygen', unit: '%', style: 'range', ranges: RANGES, color: '#2F7EE5',
    about: ['Blood oxygen shows how much oxygen your blood carries. Most healthy people read 95% or higher.', 'Wrist and finger sensors can be wrong when you move, when it is cold, or with some skin tones. If you feel breathless and a reading is low, get help rather than relying on the number.'] },
  bp: { title: 'Blood pressure', unit: 'mmHg', style: 'range', ranges: RANGES, color: '#D9701A', add: '/(patient)/health/log-health',
    about: ['Blood pressure is the force of blood on your artery walls: the top number when the heart beats (systolic) and the bottom when it rests (diastolic).',
      'Below 120/80 is usually considered normal. Readings of 130/80 or more are raised, and 180/120 or more needs urgent medical attention. Measure seated and rested, and share your readings with your clinician.'] },
};

// ---- windows -------------------------------------------------------------------------------------------------------------------------
const at = (y: number, m: number, d: number, h = 0, min = 0) => new Date(y, m, d, h, min, 0, 0).getTime();

export function windowFor(range: Range, offset = 0, now: Date = new Date()): Win {
  const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
  const edges: number[] = [];
  let interval: Interval;
  if (range === 'H') {
    const h0 = now.getHours() - offset;                                   // the clock hour you are in, then earlier ones
    for (let i = 0; i <= 12; i++) edges.push(at(y, m, d, h0, i * 5));
    interval = { minute: 5 };
  } else if (range === 'D') {
    for (let i = 0; i <= 24; i++) edges.push(at(y, m, d - offset, i));
    interval = { hour: 1 };
  } else if (range === 'W' || range === 'M') {
    const n = range === 'W' ? 7 : 30;
    const first = d - (n - 1) - n * offset;
    for (let i = 0; i <= n; i++) edges.push(at(y, m, first + i));
    interval = { day: 1 };
  } else if (range === '6M') {
    const first = d - (26 * 7 - 1) - 26 * 7 * offset;
    for (let i = 0; i <= 26; i++) edges.push(at(y, m, first + i * 7));
    interval = { day: 7 };
  } else {
    const first = m - 11 - 12 * offset;
    for (let i = 0; i <= 12; i++) edges.push(at(y, first + i, 1));
    interval = { month: 1 };
  }
  return { range, offset, start: edges[0], end: edges[edges.length - 1], edges, interval };
}

export const emptyBuckets = (win: Win): Bucket[] => win.edges.slice(0, -1).map((s, i) => ({ start: s, end: win.edges[i + 1], count: 0, min: null, max: null, avg: null, sum: null }));
export const bucketIndex = (win: Win, t: number): number => {
  if (t < win.start || t >= win.end) return -1;
  let lo = 0, hi = win.edges.length - 2;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (win.edges[mid] <= t) lo = mid; else hi = mid - 1; }
  return lo;
};

/** Put readings into the window's buckets, keeping the lowest, highest, average and total of each. */
export function bucketize(points: Pt[], win: Win): Bucket[] {
  const out = emptyBuckets(win);
  const acc = out.map(() => ({ n: 0, sum: 0, min: Infinity, max: -Infinity }));
  for (const p of points) {
    const i = bucketIndex(win, p.t);
    if (i < 0 || !Number.isFinite(p.v)) continue;
    const a = acc[i];
    a.n++; a.sum += p.v; a.min = Math.min(a.min, p.v); a.max = Math.max(a.max, p.v);
  }
  acc.forEach((a, i) => { if (a.n) out[i] = { ...out[i], count: a.n, min: a.min, max: a.max, avg: a.sum / a.n, sum: a.sum }; });
  return out;
}

/** Blood pressure: the systolic and diastolic readings are bucketed separately, then joined so one bar spans both. */
export function bucketizeBp(sys: Pt[], dia: Pt[], win: Win): Bucket[] {
  const s = bucketize(sys, win), d = bucketize(dia, win);
  return s.map((b, i) => {
    const x = d[i];
    if (!b.count && !x.count) return b;
    const lo = Math.min(b.min ?? Infinity, x.min ?? Infinity), hi = Math.max(b.max ?? -Infinity, x.max ?? -Infinity);
    return { ...b, count: Math.max(b.count, x.count), min: lo, max: hi, avg: b.avg ?? x.avg,
      sys: b.count ? { min: b.min as number, max: b.max as number } : null, dia: x.count ? { min: x.min as number, max: x.max as number } : null };
  });
}

/** Daily average inside a week or month bucket, so the 6M and Y charts compare like with like. */
export function dailyAverage(buckets: Bucket[]): Bucket[] {
  return buckets.map((b) => (b.sum == null ? b : { ...b, avg: b.sum / Math.max(1, Math.round((b.end - b.start) / DAY)) }));
}

// ---- the axis ------------------------------------------------------------------------------------------------------------------------
const niceStep = (raw: number) => {
  const p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
};
export function niceScale(lo: number, hi: number, count = 4): { min: number; max: number; ticks: number[] } {
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { min: 0, max: 1, ticks: [0, 1] };
  if (hi - lo < 1e-9) { lo -= 1; hi += 1; }
  const step = niceStep((hi - lo) / count);
  const min = Math.floor(lo / step) * step, max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { min, max, ticks };
}

export function scaleFor(kind: Kind, buckets: Bucket[]): { min: number; max: number; ticks: number[] } {
  const has = buckets.filter((b) => b.count > 0);
  const style = KINDS[kind].style;
  const val = (b: Bucket) => (style === 'bars' ? b.avg ?? b.sum ?? 0 : b.avg ?? 0);
  if (!has.length) return style === 'bars' ? niceScale(0, 1, 2) : niceScale(0, 100, 4);
  if (style === 'bars') return niceScale(0, Math.max(...has.map(val)), 4);
  const lo = Math.min(...has.map((b) => b.min as number)), hi = Math.max(...has.map((b) => b.max as number));
  const pad = Math.max((hi - lo) * 0.25, kind === 'weight' ? 0.5 : kind === 'spo2' ? 1 : 5);
  return niceScale(lo - pad, hi + pad, 4);
}

const timeOf = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
/** Labels under the chart, placed by their position (0 to 1) across the window. */
export function axisLabels(win: Win): { pos: number; text: string }[] {
  const span = win.end - win.start;
  const p = (t: number) => (t - win.start) / span;
  const out: { pos: number; text: string }[] = [];
  const e = win.edges;
  if (win.range === 'H') { for (let i = 0; i < e.length - 1; i += 3) out.push({ pos: p(e[i]), text: timeOf(e[i]) }); }
  else if (win.range === 'D') { for (let i = 0; i < 24; i += 6) out.push({ pos: p(e[i]), text: new Date(e[i]).toLocaleTimeString(undefined, { hour: 'numeric' }) }); }
  else if (win.range === 'W') { for (let i = 0; i < 7; i++) out.push({ pos: p((e[i] + e[i + 1]) / 2), text: new Date(e[i]).toLocaleDateString(undefined, { weekday: 'narrow' }) }); }
  else if (win.range === 'M') { for (let i = 0; i < 30; i += 7) out.push({ pos: p((e[i] + e[i + 1]) / 2), text: String(new Date(e[i]).getDate()) }); }
  else if (win.range === '6M') {
    let last = -1;
    for (let i = 0; i < 26; i++) { const m = new Date(e[i]).getMonth(); if (m !== last && i % 2 === 0) out.push({ pos: p((e[i] + e[i + 1]) / 2), text: new Date(e[i]).toLocaleDateString(undefined, { month: 'short' }) }); last = m; }
  } else { for (let i = 0; i < 12; i++) out.push({ pos: p((e[i] + e[i + 1]) / 2), text: new Date(e[i]).toLocaleDateString(undefined, { month: 'narrow' }) }); }
  return out;
}

export function windowLabel(win: Win): string {
  const f = (t: number, o: Intl.DateTimeFormatOptions) => new Date(t).toLocaleDateString(undefined, o);
  const last = win.end - 1;
  if (win.range === 'H') return `${f(win.start, { month: 'short', day: 'numeric' })}, ${new Date(win.start).toLocaleTimeString(undefined, { hour: 'numeric' })} to ${new Date(win.end).toLocaleTimeString(undefined, { hour: 'numeric' })}`;
  if (win.range === 'D') return f(win.start, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  if (win.range === 'Y') return `${f(win.start, { month: 'short', year: 'numeric' })} to ${f(last, { month: 'short', year: 'numeric' })}`;
  return `${f(win.start, { month: 'short', day: 'numeric' })} to ${f(last, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}
export function bucketLabel(win: Win, b: Bucket): string {
  const f = (t: number, o: Intl.DateTimeFormatOptions) => new Date(t).toLocaleDateString(undefined, o);
  if (win.range === 'H') return `${f(b.start, { month: 'short', day: 'numeric' })}, ${timeOf(b.start)}`;
  if (win.range === 'D') return `${f(b.start, { month: 'short', day: 'numeric' })}, ${new Date(b.start).toLocaleTimeString(undefined, { hour: 'numeric' })}`;
  if (win.range === 'W' || win.range === 'M') return f(b.start, { weekday: 'short', month: 'short', day: 'numeric' });
  if (win.range === '6M') return `${f(b.start, { month: 'short', day: 'numeric' })} to ${f(b.end - 1, { month: 'short', day: 'numeric' })}`;
  return f(b.start, { month: 'long', year: 'numeric' });
}

// ---- the figures above the chart -----------------------------------------------------------------------------------------------------
const r1 = (n: number) => Math.round(n * 10) / 10;
export function formatValue(kind: Kind, v: number): string {
  if (kind === 'sleep') { const m = Math.round(v * 60); return m >= 60 ? `${Math.floor(m / 60)} hr ${m % 60} min` : `${m} min`; }
  if (kind === 'weight') return r1(v).toFixed(1);
  if (kind === 'steps') return Math.round(v).toLocaleString();
  return String(Math.round(v));
}
const span = (kind: Kind, lo: number, hi: number) => (Math.round(lo) === Math.round(hi) ? formatValue(kind, lo) : `${formatValue(kind, lo)}–${formatValue(kind, hi)}`);

export type Headline = { label: string; value: string; unit: string };
/** The big figure: for a range-type vital the lowest to highest; for steps the total or daily average; for the rest the average. */
export function headline(kind: Kind, win: Win, buckets: Bucket[], selected: number | null): Headline {
  const info = KINDS[kind];
  const pool = selected != null && buckets[selected] ? [buckets[selected]] : buckets;
  const has = pool.filter((b) => b.count > 0);
  const none: Headline = { label: info.style === 'range' ? 'RANGE' : kind === 'steps' ? 'TOTAL' : 'AVERAGE', value: '--', unit: info.unit };
  if (!has.length) return none;
  if (kind === 'bp') {
    const sy = has.filter((b) => b.sys), di = has.filter((b) => b.dia);
    const a = sy.length ? span(kind, Math.min(...sy.map((b) => b.sys!.min)), Math.max(...sy.map((b) => b.sys!.max))) : '--';
    const b = di.length ? span(kind, Math.min(...di.map((x) => x.dia!.min)), Math.max(...di.map((x) => x.dia!.max))) : '--';
    return { label: 'RANGE', value: `${a} / ${b}`, unit: info.unit };
  }
  if (info.style === 'range') return { label: 'RANGE', value: span(kind, Math.min(...has.map((b) => b.min as number)), Math.max(...has.map((b) => b.max as number))), unit: info.unit };
  if (kind === 'steps') {
    const total = has.reduce((s, b) => s + (b.sum ?? 0), 0);
    const daily = win.range === '6M' || win.range === 'Y';
    if (selected != null) return daily ? { label: 'DAILY AVERAGE', value: formatValue(kind, has[0].avg ?? 0), unit: info.unit } : { label: 'TOTAL', value: formatValue(kind, total), unit: info.unit };
    if (win.range === 'H' || win.range === 'D') return { label: 'TOTAL', value: formatValue(kind, total), unit: info.unit };
    const days = has.reduce((s, b) => s + Math.max(1, Math.round((b.end - b.start) / DAY)), 0);
    return { label: 'DAILY AVERAGE', value: formatValue(kind, total / days), unit: info.unit };
  }
  const mean = has.reduce((s, b) => s + (b.avg ?? 0), 0) / has.length;
  return { label: 'AVERAGE', value: formatValue(kind, mean), unit: kind === 'sleep' ? '' : info.unit };
}
