import React, { useMemo, useState } from 'react';
import { theme } from '../../constants/theme';
import { Card, Chip, T } from '../ui';
import { Pulse } from '../ui/motion';
import { ago } from '../CareParts';
import { HeartSummary, Pt } from '../../services/healthMath';
import LineChart from '../charts/LineChart';
import { Ionicons, View } from '../themed';

const C = theme.COLORS;
type Range = '24h' | '7d' | '30d';
const RANGES: { key: Range; label: string }[] = [{ key: '24h', label: '24 hours' }, { key: '7d', label: '7 days' }, { key: '30d', label: '30 days' }];

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: C.background, borderRadius: 14, padding: 12 }}>
      <T v="title" style={{ fontSize: 22, lineHeight: 28 }}>{value}</T>
      <T v="caption" color={C.textSecondary}>{label}</T>
    </View>
  );
}

/** Heart rate from Apple Health: the latest reading with its age, then a chart of every reading for the range the person picks. */
export function HeartCard({ heart, restingLatest, live }: { heart: HeartSummary; restingLatest: Pt | null; live: boolean }) {
  const [range, setRange] = useState<Range>('24h');
  const points = range === '24h' ? heart.last24h : range === '7d' ? heart.last7d : heart.last30d;
  const stats = useMemo(() => {
    if (!points.length) return null;
    const vs = points.map((p) => p.v);
    return { min: Math.min(...vs), avg: Math.round(vs.reduce((a, b) => a + b, 0) / vs.length), max: Math.max(...vs) };
  }, [points]);
  const fmt = (t: number) => {
    const d = new Date(t);
    return range === '24h' ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
      : range === '7d' ? `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${d.toLocaleTimeString([], { hour: 'numeric' })}` : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  };
  const age = heart.latest ? Date.now() - heart.latest.t : null;
  const stale = age != null && age > 24 * 3600_000;

  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Pulse active={live}><Ionicons name="heart" size={20} color={C.danger} /></Pulse>
        <T v="heading" style={{ flex: 1 }}>Heart rate</T>
        {live ? <T v="caption" color={C.success} style={{ fontWeight: '700' }}>LIVE</T> : null}
      </View>

      {heart.latest ? (
        <View style={{ marginTop: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <T v="display" style={{ fontSize: 44, lineHeight: 50 }}>{Math.round(heart.latest.v)}</T>
            <T v="body" color={C.textSecondary} style={{ marginLeft: 6 }}>bpm</T>
          </View>
          <T v="caption" color={stale ? C.warning : C.textSecondary}>{stale ? 'Last reading ' : 'Latest reading '}{ago(new Date(heart.latest.t).toISOString())}</T>
          {restingLatest ? <T v="caption" color={C.textSecondary}>Resting {Math.round(restingLatest.v)} bpm, {ago(new Date(restingLatest.t).toISOString())}</T> : null}
        </View>
      ) : (
        <T v="body" color={C.textSecondary} style={{ marginTop: 10 }}>No heart-rate readings in Apple Health in the last 30 days. They appear here when a watch or heart-rate sensor records them.</T>
      )}

      {heart.latest ? (
        <>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
            {RANGES.map((r) => <Chip key={r.key} label={r.label} selected={range === r.key} onPress={() => setRange(r.key)} />)}
          </View>
          {points.length >= 2 ? (
            <View style={{ marginTop: 12 }}><LineChart data={points} color={C.danger} unit="bpm" formatTime={fmt} replayKey={`${range}-${points.length}`} /></View>
          ) : (
            <T v="caption" color={C.textSecondary} style={{ marginTop: 14 }}>{points.length === 1 ? 'Only one reading in this range, so there is no line to draw.' : 'No readings in this range. Try a longer one.'}</T>
          )}
          {stats ? (
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <Stat value={String(stats.min)} label="Lowest" /><Stat value={String(stats.avg)} label="Average" /><Stat value={String(stats.max)} label="Highest" />
            </View>
          ) : null}
          <T v="caption" color={C.textTertiary} style={{ marginTop: 10 }}>{heart.count30.toLocaleString()} readings from Apple Health in the last 30 days. Touch the chart to read any point.</T>
        </>
      ) : null}
    </Card>
  );
}
