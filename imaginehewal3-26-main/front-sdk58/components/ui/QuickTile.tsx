import React from 'react';
import { useWindowDimensions } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { theme } from '../../constants/theme';
import { IconName, T } from './index';
import { PressScale } from './motion';
import { Ionicons, LinearGradient } from '../themed';

export type QuickAction = { label: string; icon: IconName; gradient: [string, string]; path: string };

/**
 * Width of one tile in a 3-column grid, in exact pixels. Percent widths on wrapped Pressables
 * collapse on web, so every tile gets a computed pixel width instead.
 */
export function useQuickTileWidth(horizontalPadding: number, gap = 12): number {
  const { width } = useWindowDimensions();
  const total = Math.min(width, theme.LAYOUT.maxContentWidth) - horizontalPadding;
  return Math.floor((total - gap * 2) / 3);
}

/** Gradient rounded-square with a white icon and the label underneath. */
export function QuickTile({ item, width, index, onPress, size = 68 }: {
  item: QuickAction; width: number; index: number; onPress: () => void; size?: number;
}) {
  return (
    <Animated.View entering={FadeInDown.delay(120 + index * 60).springify().damping(16)} style={{ width }}>
      <PressScale label={item.label} onPress={onPress} containerStyle={{ width }} style={{ width, alignItems: 'center' }}>
        <LinearGradient
          colors={item.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={{ width: size, height: size, borderRadius: size * 0.3, alignItems: 'center', justifyContent: 'center',
            shadowColor: item.gradient[0], shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 6 }, elevation: 6 }}
        >
          <Ionicons name={item.icon} size={Math.round(size * 0.47)} color="#fff" />
        </LinearGradient>
        <T v="label" numberOfLines={2} style={{ marginTop: 10, textAlign: 'center', minHeight: 36, paddingHorizontal: 2 }}>{item.label}</T>
      </PressScale>
    </Animated.View>
  );
}
