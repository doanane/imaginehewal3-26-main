import React, { useEffect } from 'react';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import Svg from 'react-native-svg';
import { theme } from '../../constants/theme';
import { T } from '../ui';
import { Path, View } from '../themed';

const C = theme.COLORS;
const polar = (cx: number, cy: number, r: number, deg: number) => ({ x: cx + r * Math.cos((deg * Math.PI) / 180), y: cy + r * Math.sin((deg * Math.PI) / 180) });
const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => {
  const s = polar(cx, cy, r, a0), e = polar(cx, cy, r, a1);
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${e.x} ${e.y}`;
};

// Zones match the risk tiers: low under 20, moderate under 40, high under 60, urgent from 60.
const ZONES = [
  { from: 0, to: 20, color: '#17724A', label: 'Low' },
  { from: 20, to: 40, color: '#B08A00', label: 'Moderate' },
  { from: 40, to: 60, color: '#D9701A', label: 'High' },
  { from: 60, to: 100, color: '#B42318', label: 'Urgent' },
];

/** Half-circle gauge with coloured zones and a needle that swings to the value with a little overshoot. */
export default function Gauge({ value, width = 260, dark = false }: { value: number; width?: number; dark?: boolean }) {
  const thick = 18, pad = thick / 2 + 4;
  const r = width / 2 - pad, cx = width / 2, cy = width / 2;
  const height = cy + 26;
  const v = Math.max(0, Math.min(100, value));
  const deg = useSharedValue(-90);
  const fade = useSharedValue(0);
  useEffect(() => {
    fade.value = withTiming(1, { duration: 500 });
    deg.value = -90;
    deg.value = withDelay(250, withSpring(-90 + v * 1.8, { damping: 6, stiffness: 55, mass: 1 }));   // swings past, then settles
  }, [v]);
  const needle = useAnimatedStyle(() => ({ transform: [{ rotate: `${deg.value}deg` }] }));
  const zones = useAnimatedStyle(() => ({ opacity: fade.value }));
  const ink = dark ? '#FFFFFF' : C.textPrimary;
  const len = r - 10;

  return (
    <View style={{ width, height, alignSelf: 'center' }} accessibilityRole="image" accessibilityLabel={`Risk gauge, ${Math.round(v)} out of 100`}>
      <Animated.View style={zones}>
        <Svg width={width} height={height}>
          {ZONES.map((z) => <Path key={z.label} d={arc(cx, cy, r, 180 + z.from * 1.8 + 1.2, 180 + z.to * 1.8 - 1.2)} stroke={z.color} strokeWidth={thick} strokeLinecap="round" fill="none" />)}
        </Svg>
      </Animated.View>
      <Animated.View style={[{ position: 'absolute', left: cx - 2.5, top: cy - len, width: 5, height: len, borderRadius: 3, backgroundColor: ink, transformOrigin: '50% 100%' }, needle]} />
      <View style={{ position: 'absolute', left: cx - 9, top: cy - 9, width: 18, height: 18, borderRadius: 9, backgroundColor: ink, borderWidth: 3, borderColor: dark ? '#0A7C99' : '#fff' }} />
      <View style={{ position: 'absolute', left: 0, right: 0, top: cy + 8, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 4 }}>
        <T v="caption" color={dark ? 'rgba(255,255,255,0.8)' : C.textTertiary}>0</T>
        <T v="caption" color={dark ? 'rgba(255,255,255,0.8)' : C.textTertiary}>100</T>
      </View>
    </View>
  );
}
