import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GestureResponderEvent } from 'react-native';
import Animated, {
  Easing, FadeIn, SharedValue, useAnimatedProps, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';
import { theme } from '../../constants/theme';
import { T } from '../ui';
import { tap } from '../ui/motion';
import { Circle, Pressable, View } from '../themed';

const C = theme.COLORS;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export type Slice = { key: string; label: string; value: number; color: string; detail?: string };

function Arc({ cx, cy, r, color, startFrac, lenFrac, circ, progress, thickness, selected, dimmed }: {
  cx: number; cy: number; r: number; color: string; startFrac: number; lenFrac: number; circ: number;
  progress: SharedValue<number>; thickness: number; selected: boolean; dimmed: boolean;
}) {
  const width = useSharedValue(thickness);
  useEffect(() => { width.value = withSpring(selected ? thickness + 12 : thickness, { damping: 11, stiffness: 190 }); }, [selected, thickness]);
  const props = useAnimatedProps(() => {
    const start = startFrac * circ;
    const visible = Math.max(0, Math.min(lenFrac * circ, progress.value * circ - start));   // the sweep reveals slices in order
    return { strokeDashoffset: circ - visible, strokeWidth: width.value };
  });
  return (
    <AnimatedCircle cx={cx} cy={cy} r={r} stroke={color} fill="none" strokeDasharray={`${circ} ${circ}`}
      rotation={-90 + startFrac * 360} origin={`${cx}, ${cy}`} animatedProps={props} opacity={dimmed ? 0.3 : 1} />
  );
}

/**
 * Animated pie/donut. Sweeps in on first appearance, a tapped slice pops out and the centre shows its value,
 * the very first tap adds a small bounce, and tapping the middle replays the sweep. Legend chips select slices too.
 */
export default function DonutChart({ data, size = 210, thickness = 40, centerValue, centerLabel, format = (v: number) => `${Math.round(v)}`, emptyText = 'No data yet', hint = 'Tap a slice' }: {
  data: Slice[]; size?: number; thickness?: number; centerValue?: string; centerLabel?: string;
  format?: (v: number) => string; emptyText?: string; hint?: string;
}) {
  const slices = useMemo(() => data.filter((d) => d.value > 0), [data]);
  const total = slices.reduce((a, b) => a + b.value, 0);
  const [sel, setSel] = useState<string | null>(null);
  const progress = useSharedValue(0);
  const pop = useSharedValue(1);
  const firstTap = useRef(true);
  const key = slices.map((s) => `${s.key}:${s.value}`).join('|');

  const r = (size - thickness - 14) / 2;
  const cx = size / 2, cy = size / 2;
  const circ = 2 * Math.PI * r;
  const gap = slices.length > 1 ? 0.012 : 0;

  const layout = useMemo(() => {
    let acc = 0;
    return slices.map((s) => {
      const frac = s.value / total;
      const out = { s, frac, startFrac: acc + gap / 2, lenFrac: Math.max(0.001, frac - gap) };
      acc += frac;
      return out;
    });
  }, [key]);

  const replay = useCallback(() => {
    progress.value = 0;
    progress.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) });
  }, [progress]);
  useEffect(() => { if (total > 0) replay(); }, [key]);

  const choose = (k: string | null) => {
    if (k && firstTap.current) { firstTap.current = false; pop.value = withSequence(withTiming(1.07, { duration: 140 }), withSpring(1, { damping: 7, stiffness: 180 })); }
    tap();
    setSel((cur) => (cur === k ? null : k));
  };

  const onPress = (e: GestureResponderEvent) => {
    const ne: any = e.nativeEvent;
    const x = ne.locationX ?? ne.offsetX, y = ne.locationY ?? ne.offsetY;
    if (x == null || y == null) return;
    const dx = x - cx, dy = y - cy, dist = Math.hypot(dx, dy);
    if (dist < r - thickness / 2 - 4) { replay(); setSel(null); return; }
    if (dist > r + thickness / 2 + 16) return;
    const frac = (((Math.atan2(dy, dx) * 180) / Math.PI + 90 + 360) % 360) / 360;
    const hit = layout.find((l) => frac >= l.startFrac - gap / 2 && frac < l.startFrac + l.lenFrac + gap / 2) ?? layout[layout.length - 1];
    if (hit) choose(hit.s.key);
  };

  const wrap = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const selected = slices.find((s) => s.key === sel) ?? null;

  if (total <= 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 12 }}>
        <View style={{ width: size * 0.7, height: size * 0.7, borderRadius: size, borderWidth: thickness * 0.5, borderColor: C.borderLight, alignItems: 'center', justifyContent: 'center' }}>
          <T v="caption" color={C.textSecondary} style={{ textAlign: 'center', paddingHorizontal: 12 }}>{emptyText}</T>
        </View>
      </View>
    );
  }

  return (
    <View style={{ alignItems: 'center' }}>
      <Animated.View style={wrap}>
        <Pressable onPress={onPress} accessibilityRole="image" accessibilityLabel={`Pie chart. ${slices.map((s) => `${s.label} ${Math.round((s.value / total) * 100)} percent`).join(', ')}`}
          style={{ width: size, height: size }}>
          <Svg width={size} height={size}>
            <Circle cx={cx} cy={cy} r={r} stroke={C.borderLight} strokeWidth={thickness} fill="none" />
            {layout.map((l) => (
              <Arc key={l.s.key} cx={cx} cy={cy} r={r} color={l.s.color} startFrac={l.startFrac} lenFrac={l.lenFrac} circ={circ} progress={progress}
                thickness={thickness} selected={sel === l.s.key} dimmed={!!sel && sel !== l.s.key} />
            ))}
          </Svg>
          <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View key={selected?.key ?? 'total'} entering={FadeIn.duration(200)} style={{ alignItems: 'center', maxWidth: size - thickness * 2 - 24 }}>
              <T v="title" style={{ fontSize: 26, lineHeight: 32 }}>{selected ? format(selected.value) : centerValue ?? format(total)}</T>
              <T v="caption" color={selected ? selected.color : C.textSecondary} numberOfLines={2} style={{ textAlign: 'center', fontWeight: '600' }}>
                {selected ? `${selected.label} · ${Math.round((selected.value / total) * 100)}%` : centerLabel ?? 'Total'}
              </T>
            </Animated.View>
          </View>
        </Pressable>
      </Animated.View>

      <T v="caption" color={C.textTertiary} style={{ marginTop: 6 }}>{selected ? 'Tap the middle to replay' : hint}</T>
      {selected?.detail ? <T v="caption" color={C.textSecondary} style={{ marginTop: 6, textAlign: 'center' }}>{selected.detail}</T> : null}

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginTop: 14 }}>
        {slices.map((s) => {
          const on = sel === s.key;
          return (
            <Pressable key={s.key} onPress={() => choose(s.key)} accessibilityRole="button" accessibilityState={{ selected: on }}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1.5, borderColor: on ? s.color : C.border, backgroundColor: on ? C.card : C.card }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: s.color }} />
              <T v="label">{s.label}</T>
              <T v="caption" color={C.textSecondary}>{Math.round((s.value / total) * 100)}%</T>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
