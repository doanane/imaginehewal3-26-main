/**
 * Live run / walk / ride tracker: GPS distance and pace, kilometre voice reminders, pause and resume, step count.
 * Foreground tracking (works in Expo Go). The route is stored as [lat, lng, seconds] and the server recomputes distance and
 * checks it is physically possible before anything counts on a leaderboard.
 */
import type * as Location from 'expo-location';
import { getLocation, getPedometer, getSpeech } from './native';
import { WorkoutKind } from './api';

export type TrackerState = {
  status: 'idle' | 'running' | 'paused'; elapsed_s: number; distance_m: number; speed_ms: number; pace_s_km: number | null;
  avg_pace_s_km: number | null; steps: number; calories: number; route: number[][]; gps: 'searching' | 'ok' | 'denied' | 'indoor'; lastKm: { km: number; pace_s: number } | null;
};
const MET: Record<WorkoutKind, number> = { run: 9.8, walk: 3.8, cycle: 7.5 };
const MAX_SPEED: Record<WorkoutKind, number> = { run: 8, walk: 3.6, cycle: 18 };

function haversine(a: number[], b: number[]) {
  const R = 6371000, p1 = (a[0] * Math.PI) / 180, p2 = (b[0] * Math.PI) / 180, dp = p2 - p1, dl = ((b[1] - a[1]) * Math.PI) / 180;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
export const fmtPace = (s: number | null) => (s == null || !isFinite(s) || s <= 0 || s > 3599 ? "--'--\"" : `${Math.floor(s / 60)}'${String(Math.round(s % 60)).padStart(2, '0')}"`);
export const fmtClock = (s: number) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return `${h > 0 ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`; };

export class ActivityTracker {
  private kind: WorkoutKind = 'run';
  private weight = 70; private voice = true; private indoor = false;
  private locSub: Location.LocationSubscription | null = null;
  private stepSub: { remove: () => void } | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private segStart = 0; private accumulated = 0;
  private distance = 0; private route: number[][] = []; private steps = 0; private nextKm = 1; private lastKmT = 0; private lastKm: TrackerState['lastKm'] = null;
  private resumed = false; private gps: TrackerState['gps'] = 'searching';
  private status: TrackerState['status'] = 'idle';
  startedAt = new Date();
  private listeners = new Set<(s: TrackerState) => void>();

  subscribe(fn: (s: TrackerState) => void) { this.listeners.add(fn); fn(this.state()); return () => { this.listeners.delete(fn); }; }
  private emit() { const s = this.state(); this.listeners.forEach((l) => l(s)); }

  private elapsed() { return this.accumulated + (this.status === 'running' ? (Date.now() - this.segStart) / 1000 : 0); }

  state(): TrackerState {
    const e = this.elapsed();
    const recent = this.route.filter((p) => e - p[2] <= 12);                               // speed over about the last 12 seconds, to smooth GPS jitter
    let speed = 0;
    if (recent.length >= 2) { const a = recent[0], b = recent[recent.length - 1]; speed = b[2] > a[2] ? haversine(a, b) / (b[2] - a[2]) : 0; }
    return {
      status: this.status, elapsed_s: e, distance_m: this.distance, speed_ms: speed, pace_s_km: speed > 0.3 ? 1000 / speed : null,
      avg_pace_s_km: this.distance >= 50 ? e / (this.distance / 1000) : null, steps: this.steps,
      calories: Math.round((MET[this.kind] * this.weight * e) / 3600), route: this.route, gps: this.indoor ? 'indoor' : this.gps, lastKm: this.lastKm,
    };
  }

  async start(kind: WorkoutKind, opts: { voice: boolean; weightKg?: number; indoor?: boolean }) {
    this.kind = kind; this.voice = opts.voice; this.weight = opts.weightKg ?? 70; this.indoor = !!opts.indoor;
    this.startedAt = new Date(); this.status = 'running'; this.segStart = Date.now(); this.accumulated = 0;
    this.timer = setInterval(() => this.emit(), 1000);
    try { this.stepSub = getPedometer()?.watchStepCount((r) => { this.steps = r.steps; }) ?? null; } catch { /* no step sensor */ }
    if (this.indoor) { this.gps = 'indoor'; this.emit(); return; }
    const Location = getLocation();
    if (!Location) { this.gps = 'denied'; this.emit(); return; }
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') { this.gps = 'denied'; this.emit(); return; }
    this.locSub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 3 }, (loc) => this.onFix(loc));
    this.emit();
  }

  private onFix(loc: Location.LocationObject) {
    if (this.status !== 'running') return;
    const { latitude, longitude, accuracy } = loc.coords;
    if (accuracy != null && accuracy > 30) return;                                          // a poor fix is worse than none
    this.gps = 'ok';
    const e = this.elapsed();
    const pt = [latitude, longitude, Math.round(e * 10) / 10];
    const last = this.route[this.route.length - 1];
    if (!last) { this.route.push(pt); this.emit(); return; }
    const d = haversine(last, pt);
    if (d < 3) return;                                                                      // standing still: ignore jitter
    let dt = e - last[2];
    if (this.resumed) {                                                                     // moved while paused: add the time that distance would have taken
      const avg = this.distance > 50 && e > 0 ? this.distance / e : 2;
      const gap = d / Math.max(avg, 1.5);
      this.accumulated += gap; pt[2] = Math.round((e + gap) * 10) / 10; dt = pt[2] - last[2]; this.resumed = false;
    }
    if (dt <= 0 || d / dt > MAX_SPEED[this.kind] * 1.5) return;                             // a GPS glitch: no human moves like that
    this.distance += d;
    this.route.push(pt);
    while (this.distance >= this.nextKm * 1000) {
      const pace = Math.round(pt[2] - this.lastKmT);
      this.lastKm = { km: this.nextKm, pace_s: pace }; this.lastKmT = pt[2];
      if (this.voice) {
        const m = Math.floor(pace / 60), s = pace % 60;
        getSpeech()?.speak(`${this.nextKm} kilometre${this.nextKm > 1 ? 's' : ''}. Pace ${m} minute${m === 1 ? '' : 's'} ${s} seconds per kilometre.`, { language: 'en-GB', rate: 0.95 });
      }
      this.nextKm += 1;
    }
    this.emit();
  }

  pause() { if (this.status !== 'running') return; this.accumulated = this.elapsed(); this.status = 'paused'; this.emit(); }
  resume() { if (this.status !== 'paused') return; this.segStart = Date.now(); this.status = 'running'; this.resumed = true; this.emit(); }

  async finish() {
    const final = this.state();
    this.accumulated = final.elapsed_s;
    this.status = 'idle';
    if (this.timer) clearInterval(this.timer);
    this.locSub?.remove(); this.stepSub?.remove();
    this.timer = null; this.locSub = null; this.stepSub = null;
    const step = Math.max(1, Math.ceil(this.route.length / 1500));                          // keep the upload small
    const route = this.route.filter((_, i) => i % step === 0 || i === this.route.length - 1);
    this.emit();
    return { startedAt: this.startedAt, duration_s: Math.round(final.elapsed_s), distance_m: Math.round(this.distance), steps: this.steps || undefined, route, indoor: this.indoor };
  }

  discard() { if (this.timer) clearInterval(this.timer); this.locSub?.remove(); this.stepSub?.remove(); this.status = 'idle'; getSpeech()?.stop(); }
}
