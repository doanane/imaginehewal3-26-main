import React, { useState } from 'react';
import { LayoutChangeEvent } from 'react-native';
import Svg from 'react-native-svg';
import { theme } from '../../constants/theme';
import type { Day, Insights } from '../../services/healthMath';
import { Glass } from '../ui/Glass';
import { IconName, T } from '../ui';
import { Ionicons, Line, Path, SvgText, View } from '../themed';

const C = theme.COLORS;
const LETTER = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const letter = (day: string) => LETTER[new Date(`${day}T12:00:00`).getDay()];
const avg = (a: (number | null)[]) => { const v = a.filter((x): x is number => x != null); return v.length ? v.reduce((s, x) => s + x, 0) / v.length : null; };
const hm = (h: number) => `${Math.floor(h)}h ${String(Math.round((h - Math.floor(h)) * 60)).padStart(2, '0')}m`;
const week = (d: Day[]) => d.slice(-7);
const before = (d: Day[]) => d.slice(-14, -7);

/** One card of the overview: an icon tile and a title on the left, the period on the right, a big figure bottom left and the picture bottom right. */
function Panel({ icon, title, children, figure, note, noteTone }: { icon: IconName; title: string; children: React.ReactNode; figure: string; note?: string; noteTone?: 'good' | 'watch' | 'plain' }) {
  const tone = noteTone === 'good' ? C.success : noteTone === 'watch' ? C.warning : C.textSecondary;
  return (
    <Glass radius={26} style={{ padding: 18, marginBottom: 14 }} label={`${title}. ${figure}. ${note || ''}`}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={icon} size={22} color={C.primary} />
          </View>
          <T v="heading">{title}</T>
        </View>
        <T v="caption" color={C.textSecondary}>Last 7 days</T>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', marginTop: 14, gap: 12 }}>
        <View style={{ width: '38%' }}>
          <T v="display" style={{ fontSize: 32, lineHeight: 38, fontVariant: ['tabular-nums'] }} numberOfLines={1} adjustsFontSizeToFit>{figure}</T>
          {note ? <T v="caption" color={tone} style={{ marginTop: 4, fontWeight: noteTone === 'plain' ? '400' : '600' }}>{note}</T> : null}
        </View>
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    </Glass>
  );
}

/** Steps: one column per day, one rounded block for every 2,000 steps. */
function StepBlocks({ days }: { days: Day[] }) {
  const rows = 5;
  return (
    <View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {days.map((d) => {
          const n = d.v == null ? 0 : Math.min(rows, Math.ceil(d.v / 2000));
          return (
            <View key={d.day} style={{ gap: 4, alignItems: 'center' }} accessible accessibilityLabel={`${d.day}, ${d.v == null ? 'no reading' : Math.round(d.v).toLocaleString() + ' steps'}`}>
              {Array.from({ length: rows }, (_, i) => {
                const on = i >= rows - n;
                return <View key={i} style={{ width: 16, height: 14, borderRadius: 6, backgroundColor: on ? C.primary : C.borderLight, opacity: on ? 1 : 0.7 }} />;
              })}
              <T v="caption" color={C.textSecondary} style={{ fontSize: 11, marginTop: 2 }}>{letter(d.day)}</T>
            </View>
          );
        })}
      </View>
      <T v="caption" color={C.textTertiary} style={{ fontSize: 11, marginTop: 6 }}>Each block is about 2,000 steps</T>
    </View>
  );
}

/** Sleep: this week's nights as a smooth line, last week's as a fainter one behind it. */
function SleepLines({ now, prev }: { now: Day[]; prev: Day[] }) {
  const [w, setW] = useState(0);
  const H = 96, padX = 22, padY = 8;
  const vals = [...now, ...prev].map((d) => d.v).filter((x): x is number => x != null);
  const hi = Math.max(8, Math.ceil(Math.max(0, ...vals)));
  const x = (i: number, n: number) => padX + (n <= 1 ? 0 : (i * (w - padX - 4)) / (n - 1));
  const y = (v: number) => H - padY - (v / hi) * (H - 2 * padY);
  const path = (d: Day[]) => {
    const pts = d.map((p, i) => (p.v == null ? null : { x: x(i, d.length), y: y(p.v) })).filter((p): p is { x: number; y: number } => !!p);
    if (pts.length < 2) return '';
    return pts.map((p, i) => {
      if (!i) return `M ${p.x} ${p.y}`;
      const a = pts[i - 1], b = pts[i - 2] || a, c = pts[i + 1] || p;
      const t = 0.18;
      return `C ${a.x + (p.x - b.x) * t} ${a.y + (p.y - b.y) * t}, ${p.x - (c.x - a.x) * t} ${p.y - (c.y - a.y) * t}, ${p.x} ${p.y}`;
    }).join(' ');
  };
  const pNow = w ? path(now) : '', pPrev = w ? path(prev) : '';
  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      {w > 0 && (pNow || pPrev) ? (
        <Svg width={w} height={H}>
          {[0, hi / 2, hi].map((g) => <Line key={g} x1={padX} x2={w} y1={y(g)} y2={y(g)} stroke={C.borderLight} strokeWidth={1} strokeDasharray="3 4" />)}
          {[0, hi].map((g) => <SvgText key={g} x={0} y={y(g) + 4} fontSize={10} fill={C.textSecondary}>{g}</SvgText>)}
          {pPrev ? <Path d={pPrev} stroke={C.primaryLight} strokeOpacity={0.55} strokeWidth={3} fill="none" strokeLinecap="round" /> : null}
          {pNow ? <Path d={pNow} stroke={C.primary} strokeWidth={3.5} fill="none" strokeLinecap="round" /> : null}
        </Svg>
      ) : <T v="caption" color={C.textSecondary}>Not enough nights yet to draw a line.</T>}
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><View style={{ width: 14, height: 4, borderRadius: 2, backgroundColor: C.primary }} /><T v="caption" color={C.textSecondary} style={{ fontSize: 11 }}>This week (hours)</T></View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><View style={{ width: 14, height: 4, borderRadius: 2, backgroundColor: C.primaryLight, opacity: 0.6 }} /><T v="caption" color={C.textSecondary} style={{ fontSize: 11 }}>Week before</T></View>
      </View>
    </View>
  );
}

/** Heart: one rounded column per day, filled to where that day's resting rate sits between the week's lowest and highest. Days without a reading stay empty. */
function RestingBars({ days }: { days: Day[] }) {
  const vals = days.map((d) => d.v).filter((x): x is number => x != null);
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const T_H = 92;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {days.map((d) => {
        const h = d.v == null ? 0 : T_H * (0.22 + 0.78 * (hi === lo ? 0.6 : (d.v - lo) / (hi - lo)));
        return (
          <View key={d.day} style={{ alignItems: 'center', gap: 6 }} accessible accessibilityLabel={`${d.day}, ${d.v == null ? 'no reading' : Math.round(d.v) + ' beats per minute'}`}>
            <View style={{ width: 20, height: T_H, borderRadius: 10, backgroundColor: C.borderLight, justifyContent: 'flex-end', overflow: 'hidden' }}>
              {d.v != null ? <View style={{ height: h, borderRadius: 10, backgroundColor: C.primary }} /> : null}
            </View>
            <T v="caption" color={C.textSecondary} style={{ fontSize: 11 }}>{letter(d.day)}</T>
          </View>
        );
      })}
    </View>
  );
}

/** The top of the Health tab: Activity, Sleep and Heart for the last seven days, all from Apple Health. Nothing is drawn for a day that has no reading. */
export function HealthOverview({ data }: { data: Insights }) {
  const steps = week(data.steps.days), stepsBefore = before(data.steps.days);
  const sleep = week(data.sleep.days), sleepBefore = before(data.sleep.days);
  const heart = week(data.heart.resting);

  const stepTotal = steps.reduce((s, d) => s + (d.v ?? 0), 0);
  const stepAvg = avg(steps.map((d) => d.v)), stepAvgBefore = avg(stepsBefore.map((d) => d.v));
  const stepPct = stepAvg != null && stepAvgBefore ? Math.round(((stepAvg - stepAvgBefore) / stepAvgBefore) * 100) : null;

  const sl = avg(sleep.map((d) => d.v)), slBefore = avg(sleepBefore.map((d) => d.v));
  const slDeltaMin = sl != null && slBefore != null ? Math.round((sl - slBefore) * 60) : null;

  const hr = avg(heart.map((d) => d.v));
  const hasHr = heart.some((d) => d.v != null);

  return (
    <View>
      <Panel icon="walk" title="Activity" figure={steps.some((d) => d.v != null) ? Math.round(stepTotal).toLocaleString() : '--'}
        note={stepPct != null ? `${stepPct >= 0 ? '+' : ''}${stepPct}% a day vs last week` : 'steps'} noteTone={stepPct == null ? 'plain' : stepPct >= 0 ? 'good' : 'watch'}>
        <StepBlocks days={steps} />
      </Panel>
      <Panel icon="moon" title="Sleep" figure={sl != null ? hm(sl) : '--'}
        note={slDeltaMin != null ? `${slDeltaMin >= 0 ? '+' : '-'}${Math.abs(slDeltaMin)}m from last week` : 'a night, on average'} noteTone={slDeltaMin == null ? 'plain' : slDeltaMin >= 0 ? 'good' : 'watch'}>
        <SleepLines now={sleep} prev={sleepBefore} />
      </Panel>
      <Panel icon="heart" title="Heart" figure={hr != null ? `${Math.round(hr)} BPM` : '--'} note="Avg resting heart rate" noteTone="plain">
        {hasHr ? <RestingBars days={heart} /> : <T v="caption" color={C.textSecondary}>No resting heart rate in Apple Health this week.</T>}
      </Panel>
    </View>
  );
}
