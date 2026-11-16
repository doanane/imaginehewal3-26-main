/**
 * The arithmetic behind the Health screen, kept free of any native code so it can be tested on its own.
 * Input is raw Apple Health samples (a value and a time); output is what the screen draws. Nothing here invents a number: when there is no
 * data for something the result is null and the screen leaves it out rather than showing a placeholder.
 */
export type Pt = { t: number; v: number };
export type Day = { day: string; v: number | null };

const pad = (n: number) => String(n).padStart(2, '0');
/** Local calendar day, so "today" means the person's today, not UTC's. */
export const dayKey = (d: Date | number) => { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; };
export const mean = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
export const round1 = (n: number) => Math.round(n * 10) / 10;
export const fmtKg = (kg: number) => round1(kg).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** The last `n` local days, oldest first, ending today. */
export function lastDays(n: number, now: Date = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => { const d = new Date(now); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - (n - 1 - i)); return dayKey(d); });
}

export function dailyMeans(points: Pt[], days: string[]): Day[] {
  const by = new Map<string, number[]>();
  for (const p of points) { const k = dayKey(p.t); (by.get(k) ?? by.set(k, []).get(k)!).push(p.v); }
  return days.map((day) => ({ day, v: by.has(day) ? round1(mean(by.get(day)!)!) : null }));
}

/** One point per hour that has readings, the mean of that hour. */
export function hourlyMeans(points: Pt[], fromMs: number): Pt[] {
  const by = new Map<number, number[]>();
  for (const p of points) {
    if (p.t < fromMs) continue;
    const h = Math.floor(p.t / 3600_000) * 3600_000;
    (by.get(h) ?? by.set(h, []).get(h)!).push(p.v);
  }
  return [...by.entries()].sort((a, b) => a[0] - b[0]).map(([t, v]) => ({ t: t + 1800_000, v: Math.round(mean(v)!) }));
}

export type HeartSummary = {
  latest: Pt | null; today: { min: number; avg: number; max: number; n: number } | null;
  last24h: Pt[]; last7d: Pt[]; last30d: Pt[]; count30: number;
};
export function heartSummary(samples: Pt[], now: Date = new Date()): HeartSummary {
  const sorted = [...samples].sort((a, b) => a.t - b.t);
  const t = now.getTime();
  const todayKey = dayKey(now);
  const today = sorted.filter((p) => dayKey(p.t) === todayKey).map((p) => p.v);
  return {
    latest: sorted.length ? sorted[sorted.length - 1] : null,
    today: today.length ? { min: Math.min(...today), avg: Math.round(mean(today)!), max: Math.max(...today), n: today.length } : null,
    last24h: hourlyMeans(sorted, t - 24 * 3600_000),
    last7d: hourlyMeans(sorted, t - 7 * 24 * 3600_000),
    last30d: dailyMeans(sorted, lastDays(30, now)).filter((d) => d.v != null).map((d) => ({ t: new Date(`${d.day}T12:00:00`).getTime(), v: d.v as number })),
    count30: sorted.length,
  };
}

/** Average of the last 7 days that have a value, and of the 7 before that. */
export function weekCompare(series: Day[]): { thisWeek: number | null; lastWeek: number | null } {
  const last7 = series.slice(-7).map((d) => d.v).filter((v): v is number => v != null);
  const prev7 = series.slice(-14, -7).map((d) => d.v).filter((v): v is number => v != null);
  return { thisWeek: mean(last7), lastWeek: mean(prev7) };
}

/** Latest weight, and how it changed over about `days` (needs an earlier reading at least half that long ago, otherwise null). */
export function weightChange(points: Pt[], now: Date = new Date(), days = 30): { latest: Pt; change: number | null; spanDays: number | null } | null {
  if (!points.length) return null;
  const sorted = [...points].sort((a, b) => a.t - b.t);
  const latest = sorted[sorted.length - 1];
  const target = now.getTime() - days * 86400_000;
  const earlier = sorted.filter((p) => p.t <= latest.t - (days / 2) * 86400_000);
  if (!earlier.length) return { latest, change: null, spanDays: null };
  const ref = earlier.reduce((best, p) => (Math.abs(p.t - target) < Math.abs(best.t - target) ? p : best), earlier[0]);
  return { latest, change: round1(latest.v - ref.v), spanDays: Math.round((latest.t - ref.t) / 86400_000) };
}

/** Hours asleep per wake-up day. */
export function sleepByDay(nights: { end: string; asleep_min: number }[], days: string[]): Day[] {
  const by = new Map<string, number>();
  for (const n of nights) { const k = dayKey(new Date(n.end)); by.set(k, (by.get(k) ?? 0) + n.asleep_min); }
  return days.map((day) => ({ day, v: by.has(day) ? round1(by.get(day)! / 60) : null }));
}

export type RawInsight = {
  hr: Pt[]; resting: Pt[]; stepDays: { t: number; v: number }[]; nights: { end: string; asleep_min: number }[]; weight: Pt[]; spo2: Pt[]; sys: Pt[]; dia: Pt[];
};
export type Insights = {
  heart: HeartSummary & { resting: Day[]; restingLatest: Pt | null };
  steps: { days: Day[]; today: number | null };
  sleep: { days: Day[]; last: { hours: number; day: string } | null };
  weight: { latest: Pt; change: number | null; spanDays: number | null; points: Pt[] } | null;
  oxygen: Pt | null; bp: { sys: number; dia: number; t: number } | null;
  readAt: number;
};

export function buildInsights(raw: RawInsight, now: Date = new Date()): Insights {
  const d14 = lastDays(14, now);
  const stepMap = new Map(raw.stepDays.map((s) => [dayKey(s.t), s.v]));
  const steps = d14.map((day) => ({ day, v: stepMap.has(day) ? Math.round(stepMap.get(day)!) : null }));
  const sleepDays = sleepByDay(raw.nights, d14);
  const lastSleep = [...sleepDays].reverse().find((d) => d.v != null);
  const bp = (() => {
    const s = [...raw.sys].sort((a, b) => b.t - a.t)[0], d = [...raw.dia].sort((a, b) => b.t - a.t)[0];
    return s && d ? { sys: Math.round(s.v), dia: Math.round(d.v), t: Math.max(s.t, d.t) } : null;
  })();
  const w = weightChange(raw.weight, now);
  const oxy = [...raw.spo2].sort((a, b) => b.t - a.t)[0];
  const restingSorted = [...raw.resting].sort((a, b) => a.t - b.t);
  return {
    heart: { ...heartSummary(raw.hr, now), resting: dailyMeans(raw.resting, d14), restingLatest: restingSorted.length ? restingSorted[restingSorted.length - 1] : null },
    steps: { days: steps, today: steps[steps.length - 1].v },
    sleep: { days: sleepDays, last: lastSleep ? { hours: lastSleep.v as number, day: lastSleep.day } : null },
    weight: w ? { ...w, points: [...raw.weight].sort((a, b) => a.t - b.t) } : null,
    oxygen: oxy ?? null, bp, readAt: now.getTime(),
  };
}

// ---- the "this week" rows -----------------------------------------------------------------------------------------------------------
export type Tone = 'good' | 'watch' | 'none';
export type Row = { key: string; label: string; value: string; unit: string; change: string; tone: Tone; spark: number[]; note?: string };

const dir = (delta: number, unit: string, better: 'up' | 'down' | null) => {
  if (Math.abs(delta) < 0.05) return { text: `Same as the week before`, tone: 'none' as Tone };
  const up = delta > 0;
  const tone: Tone = better == null ? 'none' : (better === 'up') === up ? 'good' : 'none';
  return { text: `${up ? 'Up' : 'Down'} ${Math.abs(round1(delta)).toLocaleString()} ${unit} from the week before`, tone };
};

/** Plain week-on-week comparisons from the person's own Apple Health data. No scores and no judgement beyond a gentle colour. */
export function weekRows(i: Insights): Row[] {
  const rows: Row[] = [];
  const rest = weekCompare(i.heart.resting);
  if (rest.thisWeek != null) {
    const delta = rest.lastWeek != null ? rest.thisWeek - rest.lastWeek : null;
    const d = delta == null ? { text: 'Not enough earlier days to compare', tone: 'none' as Tone } : dir(delta, 'bpm', 'down');
    rows.push({ key: 'resting', label: 'Resting heart rate', value: String(Math.round(rest.thisWeek)), unit: 'bpm', change: d.text, tone: delta != null && delta >= 5 ? 'watch' : d.tone,
      spark: i.heart.resting.map((x) => x.v).filter((v): v is number => v != null) });
  }
  const st = weekCompare(i.steps.days);
  if (st.thisWeek != null) {
    const delta = st.lastWeek != null ? st.thisWeek - st.lastWeek : null;
    const d = delta == null ? { text: 'Not enough earlier days to compare', tone: 'none' as Tone } : dir(Math.round(delta), 'steps a day', 'up');
    rows.push({ key: 'steps', label: 'Steps a day', value: Math.round(st.thisWeek).toLocaleString(), unit: 'steps', change: d.text,
      tone: delta != null && st.lastWeek && delta / st.lastWeek <= -0.2 ? 'watch' : d.tone, spark: i.steps.days.map((x) => x.v ?? 0) });
  }
  const sl = weekCompare(i.sleep.days);
  if (sl.thisWeek != null) {
    const delta = sl.lastWeek != null ? sl.thisWeek - sl.lastWeek : null;
    const d = delta == null ? { text: 'Not enough earlier nights to compare', tone: 'none' as Tone } : dir(delta, 'h a night', 'up');
    const h = Math.floor(sl.thisWeek), m = Math.round((sl.thisWeek - h) * 60);
    rows.push({ key: 'sleep', label: 'Sleep a night', value: `${h}h ${m}m`, unit: '', change: d.text, tone: sl.thisWeek < 6 ? 'watch' : sl.thisWeek >= 7 ? 'good' : d.tone,
      spark: i.sleep.days.map((x) => x.v ?? 0) });
  }
  if (i.weight) {
    rows.push({ key: 'weight', label: 'Weight', value: fmtKg(i.weight.latest.v), unit: 'kg',
      change: i.weight.change == null ? 'Only one recent weigh-in' : i.weight.change === 0 ? `Unchanged over ${i.weight.spanDays} days` : `${i.weight.change > 0 ? 'Up' : 'Down'} ${Math.abs(i.weight.change)} kg over ${i.weight.spanDays} days`,
      tone: 'none', spark: i.weight.points.slice(-12).map((p) => p.v) });
  }
  return rows;
}
