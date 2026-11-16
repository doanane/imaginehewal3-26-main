import React, { useState } from 'react';
import Animated, { FadeIn, FadeOut, LinearTransition, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { theme } from '../../constants/theme';
import type { IconName } from '../ui';
import { T } from '../ui';
import { Ionicons, Pressable, View } from '../themed';

const C = theme.COLORS;

/** A section that stays closed until it is wanted, so a long screen reads as a few clear rows instead of a wall of text. */
export function Fold({ title, subtitle, icon, children, defaultOpen = false, action, onAction }: {
  title: string; subtitle?: string; icon?: IconName; children: React.ReactNode; defaultOpen?: boolean; action?: string; onAction?: () => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const turn = useSharedValue(defaultOpen ? 1 : 0);
  const arrow = useAnimatedStyle(() => ({ transform: [{ rotate: `${turn.value * 180}deg` }] }));
  const toggle = () => { setOpen((o) => { turn.value = withTiming(o ? 0 : 1, { duration: 220 }); return !o; }); };
  return (
    <Animated.View layout={LinearTransition.springify().damping(20)} style={{ marginTop: 16 }}>
      <Pressable onPress={toggle} accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={`${title}, ${open ? 'open' : 'closed'}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.card, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14, borderWidth: 1, borderColor: C.borderLight, minHeight: 56 }}>
        {icon ? <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={18} color={C.primary} /></View> : null}
        <View style={{ flex: 1, minWidth: 0 }}>
          <T v="bodyStrong" numberOfLines={1}>{title}</T>
          {subtitle ? <T v="caption" color={C.textSecondary} numberOfLines={1}>{subtitle}</T> : null}
        </View>
        {action && open ? <T v="label" color={C.primary} onPress={onAction} accessibilityRole="button">{action}</T> : null}
        <Animated.View style={arrow}><Ionicons name="chevron-down" size={20} color={C.textSecondary} /></Animated.View>
      </Pressable>
      {open ? <Animated.View entering={FadeIn.duration(220)} exiting={FadeOut.duration(120)} style={{ marginTop: 10 }}>{children}</Animated.View> : null}
    </Animated.View>
  );
}
