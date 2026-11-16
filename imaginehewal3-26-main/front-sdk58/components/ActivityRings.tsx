import React, { useEffect } from 'react';
import Animated, { Easing, SharedValue, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg from 'react-native-svg';
import { Circle, View } from './themed';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
export const RING_COLORS = { steps: '#D9701A', calories: '#17724A', minutes: '#0A7C99' };
const TRACK = { steps: '#F6E1CF', calories: '#D3EADD', minutes: '#CFE7EE' };

function Ring({ cx, cy, r, stroke, color, track, frac, progress }: { cx: number; cy: number; r: number; stroke: number; color: string; track: string; frac: number; progress: SharedValue<number> }) {
  const c = 2 * Math.PI * r;
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - Math.min(1, frac) * progress.value) }));
  return (
    <>
      <Circle cx={cx} cy={cy} r={r} stroke={track} strokeWidth={stroke} fill="none" />
      <AnimatedCircle cx={cx} cy={cy} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${c} ${c}`}
        rotation={-90} origin={`${cx}, ${cy}`} animatedProps={props} />
    </>
  );
}

/** Three concentric rings (steps, calories, active minutes) that sweep in. Pass value and goal for each. */
export default function ActivityRings({ steps, calories, minutes, size = 170, children }: {
  steps: { value: number; goal: number }; calories: { value: number; goal: number }; minutes: { value: number; goal: number }; size?: number; children?: React.ReactNode;
}) {
  const progress = useSharedValue(0);
  useEffect(() => { progress.value = 0; progress.value = withTiming(1, { duration: 1300, easing: Easing.out(Easing.cubic) }); }, [steps.value, calories.value, minutes.value]);
  const stroke = size * 0.1, gap = size * 0.035, cx = size / 2;
  const r0 = (size - stroke) / 2, r1 = r0 - stroke - gap, r2 = r1 - stroke - gap;
  const f = (x: { value: number; goal: number }) => (x.goal > 0 ? x.value / x.goal : 0);
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }} accessibilityRole="image"
      accessibilityLabel={`Activity rings. Steps ${steps.value} of ${steps.goal}. Calories ${calories.value} of ${calories.goal}. Active minutes ${minutes.value} of ${minutes.goal}.`}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Ring cx={cx} cy={cx} r={r0} stroke={stroke} color={RING_COLORS.steps} track={TRACK.steps} frac={f(steps)} progress={progress} />
        <Ring cx={cx} cy={cx} r={r1} stroke={stroke} color={RING_COLORS.calories} track={TRACK.calories} frac={f(calories)} progress={progress} />
        <Ring cx={cx} cy={cx} r={r2} stroke={stroke} color={RING_COLORS.minutes} track={TRACK.minutes} frac={f(minutes)} progress={progress} />
      </Svg>
      {children}
    </View>
  );
}
