import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming } from 'react-native-reanimated';
import { theme } from '../../constants/theme';
import type { IconName } from '../ui';
import { T } from '../ui';
import { AmbientOrb, DepthSurface, Pulse } from '../ui/motion';
import { Ionicons, View } from '../themed';

const C = theme.COLORS;
export type Status = { label: string; tone: 'good' | 'watch' | 'bad' | 'none' };
const TONE = { good: C.success, watch: C.warning, bad: C.danger, none: C.textTertiary };

/**
 * One vital sign as a tile with depth: it tilts slightly when pressed, a soft coloured orb sits behind it, the number springs in whenever
 * it changes, and a bar shows how far a goal is met. The words are kept short: a status, and one line saying when and from where.
 */
export function VitalTile({ icon, tone, title, value, unit, status, hint, progress, pulse, onPress, index = 0, wide }: {
  icon: IconName; tone: string; title: string; value: string; unit?: string; status: Status; hint: string; progress?: number | null;
  pulse?: boolean; onPress?: () => void; index?: number; wide?: boolean;
}) {
  const enter = useSharedValue(0);
  const pop = useSharedValue(1);
  const bar = useSharedValue(0);
  useEffect(() => { enter.value = withDelay(index * 70, withTiming(1, { duration: 480, easing: Easing.out(Easing.cubic) })); }, []);          // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { pop.value = 0.86; pop.value = withSpring(1, { damping: 9, stiffness: 180 }); }, [value]);                                 // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { bar.value = withTiming(Math.max(0, Math.min(1, progress ?? 0)), { duration: 900, easing: Easing.out(Easing.cubic) }); }, [progress]);  // eslint-disable-line react-hooks/exhaustive-deps
  const appear = useAnimatedStyle(() => ({ opacity: enter.value, transform: [{ translateY: (1 - enter.value) * 14 }] }));
  const number = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  const fill = useAnimatedStyle(() => ({ width: `${bar.value * 100}%` }));
  const dot = TONE[status.tone];
  const empty = value === '--';

  return (
    <Animated.View style={[{ width: wide ? '100%' : '47.5%' }, appear]}>
      <DepthSurface label={`${title}, ${empty ? 'no reading' : `${value} ${unit || ''}`}, ${status.label}`} onPress={onPress}
        style={{ backgroundColor: C.card, borderRadius: 20, padding: 14, borderWidth: 1, borderColor: C.borderLight, minHeight: 152, overflow: 'hidden', ...theme.SHADOWS.small }}>
        <AmbientOrb size={96} color={`${tone}22`} style={{ position: 'absolute', right: -28, top: -28 }} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: `${tone}1F`, alignItems: 'center', justifyContent: 'center' }}>
            <Pulse active={!!pulse}><Ionicons name={icon} size={19} color={tone} /></Pulse>
          </View>
          <T v="label" color={C.textSecondary} style={{ flex: 1 }} numberOfLines={2}>{title}</T>
        </View>
        <Animated.View style={[{ flexDirection: 'row', alignItems: 'baseline', marginTop: 12 }, number]}>
          <T v="title" color={empty ? C.textTertiary : C.textPrimary} style={{ fontSize: 30, lineHeight: 36 }}>{value}</T>
          {unit && !empty ? <T v="caption" color={C.textSecondary}> {unit}</T> : null}
        </Animated.View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
          <T v="caption" color={dot === C.textTertiary ? C.textSecondary : dot} style={{ fontWeight: '600' }}>{status.label}</T>
        </View>
        <T v="caption" color={C.textTertiary} numberOfLines={2} style={{ marginTop: 6, fontSize: 12, lineHeight: 16 }}>{hint}</T>
        {progress != null ? (
          <View style={{ height: 5, borderRadius: 3, backgroundColor: `${tone}26`, marginTop: 10, overflow: 'hidden' }}>
            <Animated.View style={[{ height: 5, borderRadius: 3, backgroundColor: tone }, fill]} />
          </View>
        ) : null}
      </DepthSurface>
    </Animated.View>
  );
}

export const tileStyles = StyleSheet.create({ grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 } });
