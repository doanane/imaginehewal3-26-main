import React, { useState } from 'react';
import { LayoutChangeEvent } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { theme } from '../../constants/theme';
import { T } from '../ui';
import { tap } from '../ui/motion';
import { Pressable, View } from '../themed';

const C = theme.COLORS;
export type HeatDay = { date: string; weekday: number; score: number | null };
const LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const colorFor = (s: number | null) => s == null ? C.borderLight : s >= 0.99 ? C.primary : s >= 0.45 ? '#7DBDB9' : '#F0CFCB';
const wordFor = (s: number | null) => s == null ? 'no check-in' : s >= 0.99 ? 'step completed' : s >= 0.45 ? 'partly done' : 'skipped';

/** Calendar of check-ins: one square per day, weeks across, Monday at the top. Squares ripple in; tap one for the day. */
export default function Heatmap({ days }: { days: HeatDay[] }) {
  const [w, setW] = useState(0);
  const [sel, setSel] = useState<HeatDay | null>(null);
  const weeks: HeatDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const gap = 5, labelW = 16;
  const size = w > 0 && weeks.length ? Math.max(14, Math.min(34, Math.floor((w - labelW - gap * weeks.length) / weeks.length))) : 0;
  const done = days.filter((d) => d.score != null && d.score >= 0.45).length;
  const when = (d: HeatDay) => new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'short' });

  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} accessibilityLabel={`Check-in calendar, ${done} active days in the last ${weeks.length} weeks`}>
      {size > 0 ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center' }}>
          <View style={{ marginRight: gap }}>
            {LABELS.map((l, i) => <View key={i} style={{ height: size, marginBottom: gap, justifyContent: 'center' }}><T v="overline" color={C.textTertiary} style={{ fontSize: 10, width: labelW }}>{l}</T></View>)}
          </View>
          {weeks.map((wk, ci) => (
            <View key={ci} style={{ marginRight: ci === weeks.length - 1 ? 0 : gap }}>
              {Array.from({ length: 7 }).map((_, ri) => {
                const d = wk[ri];
                if (!d) return <View key={ri} style={{ width: size, height: size, marginBottom: gap }} />;
                const on = sel?.date === d.date;
                return (
                  <Animated.View key={ri} entering={FadeIn.delay(ci * 55 + ri * 14).duration(260)}>
                    <Pressable onPress={() => { tap(); setSel(on ? null : d); }} accessibilityRole="button" accessibilityLabel={`${when(d)}: ${wordFor(d.score)}`}
                      style={{ width: size, height: size, marginBottom: gap, borderRadius: Math.max(4, size * 0.26), backgroundColor: colorFor(d.score), borderWidth: on ? 2 : 0, borderColor: C.textPrimary }} />
                  </Animated.View>
                );
              })}
            </View>
          ))}
        </View>
      ) : null}
      <View style={{ minHeight: 24, marginTop: 6, alignItems: 'center' }}>
        <T v="caption" color={sel ? C.textPrimary : C.textTertiary}>{sel ? `${when(sel)}: ${wordFor(sel.score)}` : 'Tap a day to see how it went'}</T>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 6 }}>
        <T v="caption" color={C.textTertiary} style={{ fontSize: 12 }}>Less</T>
        {[null, 0, 0.5, 1].map((s, i) => <View key={i} style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: colorFor(s) }} />)}
        <T v="caption" color={C.textTertiary} style={{ fontSize: 12 }}>More</T>
      </View>
    </View>
  );
}
