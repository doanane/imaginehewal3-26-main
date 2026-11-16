/**
 * Motion building blocks. All animation runs on the UI thread (react-native-reanimated).
 * Haptics are best-effort and silently skipped where unavailable.
 */
import * as Haptics from 'expo-haptics';
import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  cancelAnimation, Easing, FadeInDown, useAnimatedProps, useAnimatedStyle, useSharedValue,
  useReducedMotion, withRepeat, withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import Svg from 'react-native-svg';
import { Circle, Pressable, View, useThemedStyle } from '../themed';

export function tap() { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }

/** Fades and slides a block up. Use `index` to stagger a list of blocks. */
export function Reveal({ index = 0, children, style }: { index?: number; children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const themed = useThemedStyle(style);
  return <Animated.View entering={FadeInDown.delay(index * 70).springify().damping(18)} style={themed}>{children}</Animated.View>;
}

/** Pressable that springs down slightly while pressed. */
export function PressScale({ children, onPress, style, containerStyle, label, haptic = true }: {
  children: React.ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; containerStyle?: StyleProp<ViewStyle>; label?: string; haptic?: boolean;
}) {
  const scale = useSharedValue(1);
  const themedStyle = useThemedStyle(style);
  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      onPress={() => { if (haptic) tap(); onPress?.(); }}
      onPressIn={() => { scale.value = withSpring(0.95, { damping: 15, stiffness: 300 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 12, stiffness: 260 }); }}
      accessibilityRole="button" accessibilityLabel={label}
      style={containerStyle}
    >
      <Animated.View style={[themedStyle, anim]}>{children}</Animated.View>
    </Pressable>
  );
}

/** Adaptive depth surface: adds restrained perspective on capable devices and
 * falls back to a normal press state when reduced motion is enabled. */
export function DepthSurface({ children, onPress, style, label }: {
  children: React.ReactNode; onPress?: () => void; style?: StyleProp<ViewStyle>; label?: string;
}) {
  const themedStyle = useThemedStyle(style);
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);
  const rotateX = useSharedValue(0);
  const rotateY = useSharedValue(0);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: reducedMotion ? [{ scale: scale.value }] : [
      { perspective: 900 },
      { rotateX: `${rotateX.value}deg` },
      { rotateY: `${rotateY.value}deg` },
      { scale: scale.value },
    ],
  }));

  const pressIn = () => {
    scale.value = withSpring(0.985, { damping: 16, stiffness: 260 });
    if (!reducedMotion) {
      rotateX.value = withSpring(1.5, { damping: 18, stiffness: 220 });
      rotateY.value = withSpring(-1.5, { damping: 18, stiffness: 220 });
    }
  };
  const pressOut = () => {
    scale.value = withSpring(1, { damping: 16, stiffness: 240 });
    rotateX.value = withSpring(0, { damping: 18, stiffness: 220 });
    rotateY.value = withSpring(0, { damping: 18, stiffness: 220 });
  };

  return (
    <Pressable
      onPress={() => { tap(); onPress?.(); }}
      onPressIn={pressIn}
      onPressOut={pressOut}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={label}
    >
      <Animated.View style={[themedStyle, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}

/** A slow ambient drift for decorative depth layers. */
export function AmbientOrb({ size, color, style }: { size: number; color: string; style?: StyleProp<ViewStyle> }) {
  const reducedMotion = useReducedMotion();
  const drift = useSharedValue(0);
  useEffect(() => {
    if (reducedMotion) return;
    drift.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 4200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0, { duration: 4200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      true,
    );
    return () => cancelAnimation(drift);
  }, [reducedMotion]);
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: 0.65 + drift.value * 0.2,
    transform: [{ translateY: drift.value * 10 }, { scale: 1 + drift.value * 0.04 }],
  }));
  const themed = useThemedStyle([{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }, style]);
  return <Animated.View style={[themed, animatedStyle]} />;
}

/** Gentle heartbeat scale while `active` (for live readings). */
export function Pulse({ active, children }: { active: boolean; children: React.ReactNode }) {
  const s = useSharedValue(1);
  useEffect(() => {
    if (active) s.value = withRepeat(withSequence(withTiming(1.22, { duration: 320 }), withTiming(1, { duration: 680 })), -1);
    else { cancelAnimation(s); s.value = withTiming(1); }
    return () => cancelAnimation(s);
  }, [active]);
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={a}>{children}</Animated.View>;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Circular progress that animates from 0 to `value` (0-100). Children render in the center. */
export function ProgressRing({ value, size = 132, stroke = 12, color = '#FFFFFF', track = 'rgba(255,255,255,0.28)', children }: {
  value: number; size?: number; stroke?: number; color?: string; track?: string; children?: React.ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = useSharedValue(0);
  useEffect(() => { p.value = withTiming(Math.max(0, Math.min(1, value / 100)), { duration: 1200, easing: Easing.out(Easing.cubic) }); }, [value]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value) }));
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
      accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(value) }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <AnimatedCircle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
          strokeDasharray={`${c} ${c}`} animatedProps={props} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      </Svg>
      {children}
    </View>
  );
}
