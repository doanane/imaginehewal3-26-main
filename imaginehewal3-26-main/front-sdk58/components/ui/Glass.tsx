import { BlurView } from 'expo-blur';
import React from 'react';
import { Platform, StyleProp, StyleSheet, ViewStyle } from 'react-native';
import { useHomeAccessibility } from '../homeAccessibilityContext';
import { theme } from '../../constants/theme';
import { LinearGradient, Pressable, View } from '../themed';

const C = theme.COLORS;
const fill = StyleSheet.absoluteFill as ViewStyle;

/** Soft colour behind a screen. Glass only reads as glass when there is something to see through it, so this gives Home blurred pools of the app's teal,
 *  with the strongest one sitting behind the main card. */
export function GlassBackdrop() {
  const { dark } = useHomeAccessibility();
  const a = dark ? 0.2 : 0.22;
  return (
    <View pointerEvents="none" style={[fill, { overflow: 'hidden' }]}>
      <View style={{ position: 'absolute', top: -90, right: -70, width: 300, height: 300, borderRadius: 150, backgroundColor: C.primaryLight, opacity: a }} />
      <View style={{ position: 'absolute', top: 150, left: -40, width: 340, height: 300, borderRadius: 170, backgroundColor: C.primary, opacity: dark ? 0.32 : 0.34 }} />
      <View style={{ position: 'absolute', top: 260, left: -120, width: 280, height: 280, borderRadius: 140, backgroundColor: C.medicalCyan, opacity: a * 0.7 }} />
      <View style={{ position: 'absolute', top: 640, right: -100, width: 300, height: 300, borderRadius: 150, backgroundColor: C.primaryLight, opacity: a * 0.8 }} />
      <BlurView intensity={90} tint={dark ? 'dark' : 'light'} style={fill} />
    </View>
  );
}

type Tone = 'light' | 'teal';

/** A liquid-glass surface. The content behind it is blurred, a thin translucent tint sits on top, light enters at the upper left edge and fades across the pane,
 *  the lower edge is a little shaded so the pane has thickness, and the rim is bright on the lit sides and dim on the others.
 *  `light` is for cards (more tint, so grey text stays readable); `teal` is the clear, highly translucent pane used for the main card. */
export function Glass({ children, style, onPress, radius = 24, tone = 'light', intensity, label }: {
  children?: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; radius?: number; tone?: Tone; intensity?: number; label?: string;
}) {
  const { dark } = useHomeAccessibility();
  const clear = tone === 'teal';
  const tint = clear ? (dark ? 'rgba(120,200,200,0.10)' : 'rgba(255,255,255,0.20)') : (dark ? 'rgba(24,38,52,0.62)' : 'rgba(255,255,255,0.74)');
  const lit = dark ? 'rgba(255,255,255,0.40)' : 'rgba(255,255,255,0.95)';
  const dim = dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.40)';
  const w = clear ? 1.5 : 1;
  const body = (
    <View style={[{ borderRadius: radius, overflow: 'hidden', borderWidth: w, borderTopColor: lit, borderLeftColor: lit, borderRightColor: dim, borderBottomColor: dim,
      shadowColor: clear ? '#0B6E6E' : '#10202F', shadowOpacity: clear ? 0.28 : 0.1, shadowRadius: clear ? 26 : 16, shadowOffset: { width: 0, height: clear ? 14 : 8 }, elevation: 6 }, style]}>
      <BlurView intensity={intensity ?? (clear ? 55 : 40)} tint={dark ? 'dark' : 'light'} style={fill} {...(Platform.OS === 'android' ? { experimentalBlurMethod: 'dimezisBlurView' as const } : {})} />
      <View style={[fill, { backgroundColor: tint }]} />
      {/* light entering at the upper left, fading to nothing across the pane: it ends fully transparent, so no edge shows */}
      <LinearGradient colors={clear ? ['rgba(255,255,255,0.55)', 'rgba(255,255,255,0.12)', 'rgba(255,255,255,0)'] : ['rgba(255,255,255,0.45)', 'rgba(255,255,255,0)']}
        locations={clear ? [0, 0.4, 0.8] : undefined} start={{ x: 0, y: 0 }} end={{ x: 0.8, y: 0.7 }} style={fill} pointerEvents="none" />
      {clear ? (
        <>
          {/* thickness: the lower edge darkens a little, and an inner rim sits just inside the outer one */}
          <LinearGradient colors={['rgba(8,92,92,0)', 'rgba(8,92,92,0.16)']} start={{ x: 0.5, y: 0.55 }} end={{ x: 0.5, y: 1 }} style={fill} pointerEvents="none" />
          <View pointerEvents="none" style={{ position: 'absolute', top: 3, left: 3, right: 3, bottom: 3, borderRadius: radius - 3, borderWidth: 1, borderColor: dark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.28)' }} />
        </>
      ) : null}
      <View>{children}</View>
    </View>
  );
  return onPress ? <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}>{body}</Pressable> : body;
}

/** A small glass pill, for the facts that sit on the main card. */
export function GlassPill({ children }: { children: React.ReactNode }) {
  const { dark } = useHomeAccessibility();
  const lit = dark ? 'rgba(255,255,255,0.35)' : 'rgba(255,255,255,0.95)';
  const dim = dark ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.5)';
  return (
    <View style={{ borderRadius: 999, overflow: 'hidden', borderWidth: 1, borderTopColor: lit, borderLeftColor: lit, borderRightColor: dim, borderBottomColor: dim }}>
      <BlurView intensity={30} tint={dark ? 'dark' : 'light'} style={fill} />
      <View style={[fill, { backgroundColor: dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.42)' }]} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8 }}>{children}</View>
    </View>
  );
}

/** A round pane of glass, for the ring on the main card. */
export function GlassDisc({ size, children }: { size: number; children?: React.ReactNode }) {
  const { dark } = useHomeAccessibility();
  const lit = dark ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.95)';
  const dim = dark ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.4)';
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5,
      borderTopColor: lit, borderLeftColor: lit, borderRightColor: dim, borderBottomColor: dim }}>
      <BlurView intensity={30} tint={dark ? 'dark' : 'light'} style={fill} />
      <View style={[fill, { backgroundColor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.32)' }]} />
      <LinearGradient colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']} start={{ x: 0.1, y: 0 }} end={{ x: 0.6, y: 0.7 }} style={fill} pointerEvents="none" />
      {children}
    </View>
  );
}
