import React, { useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, SharedValue, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useHomeAccessibility } from './homeAccessibilityContext';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** The ring colours (also used by the legends next to the rings). Orange, green and teal, as before. */
export const RING_COLORS = { steps: '#D9701A', calories: '#17724A', minutes: '#0A7C99' };
/** The same three hues, brighter, for dark screens, so they stay vivid against a dark background. */
const BRIGHT = { steps: '#FF9A3D', calories: '#3FD18A', minutes: '#34C3E6' };

const hex = (h: string) => (h.startsWith('#') ? [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) : (h.match(/\d+/g) || ['0', '0', '0']).slice(0, 3).map(Number));
const lighten = (h: string, t: number) => `rgb(${hex(h).map((v) => Math.round(v + (255 - v) * t)).join(',')})`;

/** One ring: a faint track in the ring's own colour, a bold arc with rounded ends, and a lighter head where the arc stops. Even a small amount is a clear round dot. */
function Ring({ cx, r, stroke, color, frac, progress, trackAlpha }: { cx: number; r: number; stroke: number; color: string; frac: number; progress: SharedValue<number>; trackAlpha: number }) {
  const c = 2 * Math.PI * r;
  const shown = frac > 0 ? Math.max(Math.min(1, frac), (stroke * 1.05) / c) : 0;          // never thinner than a dot
  const arc = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - shown * progress.value) }));
  const head = useAnimatedProps(() => {
    const a = (-90 + 360 * shown * progress.value) * (Math.PI / 180);
    return { cx: cx + r * Math.cos(a), cy: cx + r * Math.sin(a) };
  });
  return (
    <>
      <Circle cx={cx} cy={cx} r={r} stroke={color} strokeOpacity={trackAlpha} strokeWidth={stroke} fill="none" />
      {shown > 0 ? (
        <>
          <AnimatedCircle cx={cx} cy={cx} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c} ${c}`}
            rotation={-90} origin={`${cx}, ${cx}`} animatedProps={arc} />
          <AnimatedCircle r={stroke * 0.3} fill={lighten(color, 0.45)} animatedProps={head} />
        </>
      ) : null}
    </>
  );
}

/** Three concentric rings (steps, calories, active minutes) that sweep in, in the style of Apple Health and Huawei Health. Pass value and goal for each. */
export default function ActivityRings({ steps, calories, minutes, size = 170, children }: {
  steps: { value: number; goal: number }; calories: { value: number; goal: number }; minutes: { value: number; goal: number }; size?: number; children?: React.ReactNode;
}) {
  const a = useHomeAccessibility();
  const { dark } = a;
  const progress = useSharedValue(0);
  useEffect(() => { progress.value = 0; progress.value = a.stopAnimations ? 1 : withTiming(1, { duration: 1300, easing: Easing.out(Easing.cubic) }); }, [steps.value, calories.value, minutes.value, a.stopAnimations]);
  const stroke = size * 0.115, gap = size * 0.028, cx = size / 2;
  const r0 = (size - stroke) / 2, r1 = r0 - stroke - gap, r2 = r1 - stroke - gap;
  const f = (x: { value: number; goal: number }) => (x.goal > 0 ? x.value / x.goal : 0);
  // Colour-blind, grayscale, saturation, high-contrast, yellow and sepia settings still apply: they recolour the rings through the app's own mapper.
  const special = !!a.mapper && (a.colorBlind !== 'none' || a.grayscale || a.saturation !== 0 || (a.contrast !== 'default' && a.contrast !== 'dark'));
  const base = dark ? BRIGHT : RING_COLORS;
  const tx = (c: string) => (special ? a.mapper!(c, 'fg') : c);
  const col = { steps: tx(base.steps), calories: tx(base.calories), minutes: tx(base.minutes) };
  const trackAlpha = dark ? 0.28 : 0.22;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="image"
      accessibilityLabel={`Activity rings. Steps ${steps.value} of ${steps.goal}. Calories ${calories.value} of ${calories.goal}. Active minutes ${minutes.value} of ${minutes.goal}.`}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Ring cx={cx} r={r0} stroke={stroke} color={col.steps} frac={f(steps)} progress={progress} trackAlpha={trackAlpha} />
        <Ring cx={cx} r={r1} stroke={stroke} color={col.calories} frac={f(calories)} progress={progress} trackAlpha={trackAlpha} />
        <Ring cx={cx} r={r2} stroke={stroke} color={col.minutes} frac={f(minutes)} progress={progress} trackAlpha={trackAlpha} />
      </Svg>
      {children}
    </View>
  );
}
