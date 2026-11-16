import React, { useCallback, useEffect, useRef } from 'react';
import Svg from 'react-native-svg';
import { T } from './ui';
import { theme } from '../constants/theme';
import api from '../services/api';
import { realtime } from '../services/realtime';
import { Circle, Line, Polyline, SvgText, View } from './themed';

const C = theme.COLORS;

/** One vocabulary for patient status across the caregiver app, matching the doctor website. */
export const STATUS: Record<string, { label: string; tone: 'danger' | 'warning' | 'success' | 'neutral'; color: string }> = {
  critical: { label: 'Critical', tone: 'danger', color: C.danger },
  monitor: { label: 'Monitor', tone: 'warning', color: C.warning },
  stable: { label: 'Stable', tone: 'success', color: C.success },
  no_data: { label: 'No data yet', tone: 'neutral', color: C.textTertiary },
};
export const statusOf = (s?: string) => STATUS[s || 'no_data'] || STATUS.no_data;

export const SOS_TEXT: Record<string, string> = {
  pending: 'The patient can still cancel',
  active: 'Waiting for a caregiver to respond',
  acknowledged: 'A caregiver is responding',
  escalated: 'Escalated to emergency services',
  resolved: 'Resolved',
  cancelled: 'Cancelled by the patient',
};

export function ago(iso?: string | null): string {
  if (!iso) return 'no readings yet';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 15) return 'just now';
  if (s < 90) return `${s} sec ago`;
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

export function bpText(v?: { systolic?: number | null; diastolic?: number | null } | null): string {
  return v && v.systolic && v.diastolic ? `${v.systolic}/${v.diastolic}` : '--';
}

export function VitalTile({ label, value, unit, bad }: { label: string; value: string | number | null | undefined; unit?: string; bad?: boolean }) {
  return (
    <View style={{ flexGrow: 1, flexBasis: '30%', minWidth: 100, backgroundColor: bad ? C.dangerLight : C.card, borderColor: bad ? '#F2C4BF' : C.borderLight, borderWidth: 1, borderRadius: 14, padding: 12 }}>
      <T v="caption" color={C.textSecondary}>{label}</T>
      <T v="title" color={bad ? C.danger : C.textPrimary}>{value === null || value === undefined || value === '' ? '--' : value}{value !== null && value !== undefined && value !== '--' && unit ? <T v="caption" color={C.textSecondary}> {unit}</T> : null}</T>
    </View>
  );
}

/** Heart rate for the last 24 hours. Drawn from real readings only; says so when there are too few. */
export function HeartChart({ series, width = 320, height = 150 }: { series: { at: string; heart_rate: number | null }[]; width?: number; height?: number }) {
  const pts = series.filter((s) => s.heart_rate != null);
  const P = 26;
  if (pts.length < 2) {
    return <View style={{ height, alignItems: 'center', justifyContent: 'center' }}><T v="caption" color={C.textSecondary}>Not enough readings in the last 24 hours</T></View>;
  }
  const lo = 40, hi = 140;
  const t0 = new Date(pts[0].at).getTime(), t1 = new Date(pts[pts.length - 1].at).getTime(), span = Math.max(1, t1 - t0);
  const X = (t: string) => P + ((new Date(t).getTime() - t0) / span) * (width - P * 2);
  const Y = (v: number) => height - P - ((Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * (height - P * 2);
  const last = pts[pts.length - 1];
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} accessibilityLabel="Heart rate over the last 24 hours">
      {[60, 100, 120].map((g) => (
        <React.Fragment key={g}>
          <Line x1={P} x2={width - P} y1={Y(g)} y2={Y(g)} stroke={g === 120 ? C.danger : C.borderLight} strokeDasharray="4 4" />
          <SvgText x={2} y={Y(g) + 4} fontSize={10} fill={C.textTertiary}>{g}</SvgText>
        </React.Fragment>
      ))}
      <Polyline points={pts.map((s) => `${X(s.at).toFixed(1)},${Y(s.heart_rate as number).toFixed(1)}`).join(' ')} fill="none" stroke={C.primary} strokeWidth={2.5} strokeLinejoin="round" />
      <Circle cx={X(last.at)} cy={Y(last.heart_rate as number)} r={4.5} fill={C.primary} />
    </Svg>
  );
}

/**
 * Reloads a screen when the server pushes something relevant (a new reading, an emergency change).
 * The read cache is cleared first so the reload shows the new data rather than a cached copy. Bursts are merged.
 */
export function useRealtimeReload(load: () => void | Promise<void>, types: string[] = ['vitals.update', 'emergency.update', 'emergency.acknowledged', 'emergency.started', 'emergency.escalated', 'emergency.location', 'alert', 'notification.new']) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;
  const key = types.join('|');
  useEffect(() => {
    realtime.start();                                   // no-op when already connected
    const offs = types.map((t) => realtime.on(t, () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { api.invalidateApiCache(); loadRef.current(); }, 1200);
    }));
    return () => { offs.forEach((o) => o()); if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

/** A stable callback that re-runs `fn` and shows the pull-to-refresh spinner. */
export function usePull(fn: () => Promise<void>, setRefreshing: (b: boolean) => void) {
  return useCallback(() => { setRefreshing(true); api.invalidateApiCache(); fn().finally(() => setRefreshing(false)); }, [fn, setRefreshing]);
}
