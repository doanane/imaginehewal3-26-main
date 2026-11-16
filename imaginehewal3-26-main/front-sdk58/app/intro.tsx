import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Animated as RNAnimated, ImageSourcePropType, NativeScrollEvent, NativeSyntheticEvent, useWindowDimensions } from 'react-native';
import Animated, {
  Extrapolation, FadeIn, FadeInDown, interpolate, SharedValue, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue,
  withRepeat, withSequence, withTiming,
} from 'react-native-reanimated';
import { useAuth } from '../contexts/AuthContext';
import { Button, T } from '../components/ui';
import { AmbientOrb, DepthSurface } from '../components/ui/motion';
import { theme } from '../constants/theme';
import { Image, LinearGradient, View } from '../components/themed';

const C = theme.COLORS;

type Slide = { id: string; image: ImageSourcePropType; title: string; text: string; aspectRatio: number };
const SLIDES: Slide[] = [
  { id: '1', image: require('../assets/images/on_image1.png'), title: 'Smart Health Tracking',
    text: 'Monitor your vital signs, meals and daily activity with ease. Scan a meal and see what it means for you.', aspectRatio: 853 / 1280 },
  { id: '2', image: require('../assets/images/on_image2.png'), title: 'Instant Emergency Support',
    text: 'Clear emergency guidance and one-tap calling, with alerts to the family and caregivers you choose.', aspectRatio: 1 },
  { id: '3', image: require('../assets/images/on_image3.png'), title: 'Secure Health Connection',
    text: 'Stay connected with your care team in real time. You decide what they see, and you can delete your data any time.', aspectRatio: 770 / 1103 },
];

function Dot({ i, x, w }: { i: number; x: SharedValue<number>; w: number }) {
  const style = useAnimatedStyle(() => ({
    width: interpolate(x.value, [(i - 1) * w, i * w, (i + 1) * w], [8, 26, 8], Extrapolation.CLAMP),
    opacity: interpolate(x.value, [(i - 1) * w, i * w, (i + 1) * w], [0.35, 1, 0.35], Extrapolation.CLAMP),
  }));
  return <Animated.View style={[{ height: 8, borderRadius: 4, backgroundColor: C.primary }, style]} />;
}

function SlideView({ item, i, x, w, imageH }: { item: Slide; i: number; x: SharedValue<number>; w: number; imageH: number }) {
  const float = useSharedValue(0);
  const nativeFloat = React.useRef(new RNAnimated.Value(0)).current;
  React.useEffect(() => {
    float.value = withRepeat(
      withSequence(
        withTiming(-5, { duration: 2200 }),
        withTiming(0, { duration: 2200 }),
      ),
      -1,
      true,
    );
  }, []);
  React.useEffect(() => {
    const animation = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(nativeFloat, { toValue: -8, duration: 1800, useNativeDriver: true }),
        RNAnimated.timing(nativeFloat, { toValue: 0, duration: 1800, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [nativeFloat]);
  const img = useAnimatedStyle(() => ({
    transform: [
      { translateY: float.value },
      { scale: interpolate(x.value, [(i - 1) * w, i * w, (i + 1) * w], [0.9, 1, 0.9], Extrapolation.CLAMP) },
    ],
    opacity: interpolate(x.value, [(i - 1) * w, i * w, (i + 1) * w], [0.6, 1, 0.6], Extrapolation.CLAMP),
  }));
  const copy = useAnimatedStyle(() => ({
    opacity: interpolate(x.value, [(i - 0.6) * w, i * w, (i + 0.6) * w], [0, 1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(x.value, [(i - 1) * w, i * w, (i + 1) * w], [16, 0, 16], Extrapolation.CLAMP) }],
  }));
  return (
    <View style={{ width: w, paddingHorizontal: 24 }}>
      <DepthSurface label={item.title} style={{ height: imageH, borderRadius: 28 }}>
        <Animated.View style={[{ height: imageH, borderRadius: 28, overflow: 'hidden', backgroundColor: C.primarySoft,
          shadowColor: '#10202F', shadowOpacity: 0.16, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 8 }, img]}>
          <AmbientOrb size={150} color="rgba(255,255,255,0.15)" style={{ position: 'absolute', right: -55, top: -55, zIndex: 1 }} />
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 10 }}>
            <Image
              source={item.image}
              style={{ width: '100%', height: '100%', aspectRatio: item.aspectRatio }}
              resizeMode="contain"
              accessibilityLabel={item.title}
            />
          </View>
          <LinearGradient colors={['transparent', 'rgba(11,110,110,0.35)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 80 }} />
          <RNAnimated.View style={{ position: 'absolute', left: 18, bottom: 18, transform: [{ translateY: nativeFloat }], backgroundColor: 'rgba(16,32,47,0.88)', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 }}>
            <T v="label" color="#FFFFFF">CARE INSIGHT</T>
            <T v="caption" color="rgba(255,255,255,0.82)">Your health, in motion</T>
          </RNAnimated.View>
        </Animated.View>
      </DepthSurface>
      <Animated.View style={[{ marginTop: 24 }, copy]}>
        <T v="display" style={{ textAlign: 'center', fontSize: 26, lineHeight: 33 }}>{item.title}</T>
        <T v="body" color={C.textSecondary} style={{ textAlign: 'center', marginTop: 8 }}>{item.text}</T>
      </Animated.View>
    </View>
  );
}

export default function Intro() {
  const { loginAsGuest } = useAuth();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const w = Math.min(width, theme.LAYOUT.maxContentWidth);
  const imageH = Math.max(240, Math.min(height * 0.42, 390));
  const x = useSharedValue(0);
  const [index, setIndex] = useState(0);
  const list = useRef<Animated.FlatList<Slide>>(null);
  const auto = useRef<ReturnType<typeof setInterval> | null>(null);
  const idx = useRef(0);

  const onScroll = useAnimatedScrollHandler((e) => { x.value = e.contentOffset.x; });
  const onEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(e.nativeEvent.contentOffset.x / w);
    idx.current = next; setIndex(next);
  };
  const stopAuto = () => { if (auto.current) { clearInterval(auto.current); auto.current = null; } };

  useEffect(() => {
    auto.current = setInterval(() => {
      const next = (idx.current + 1) % SLIDES.length;
      list.current?.scrollToOffset({ offset: next * w, animated: true });
      idx.current = next; setIndex(next);
    }, 5000);
    return stopAuto;
  }, [w]);

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <Animated.View entering={FadeIn.duration(500)} style={{ alignItems: 'center', paddingTop: 16, paddingBottom: 20 }}>
        <BreathingLogo />
      </Animated.View>

      <Animated.FlatList
        ref={list}
        data={SLIDES}
        horizontal pagingEnabled bounces={false} showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.id}
        onScroll={onScroll} scrollEventThrottle={16}
        onScrollBeginDrag={stopAuto}
        onMomentumScrollEnd={onEnd}
        getItemLayout={(_, i) => ({ length: w, offset: w * i, index: i })}
        renderItem={({ item, index: i }) => <SlideView item={item} i={i} x={x} w={w} imageH={imageH} />}
        style={{ flexGrow: 0, width: w, alignSelf: 'center' }}
      />

      <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6, marginTop: 20 }}
        accessibilityLabel={`Page ${index + 1} of ${SLIDES.length}`}>
        {SLIDES.map((s, i) => <Dot key={s.id} i={i} x={x} w={w} />)}
      </View>

      <View style={{ flex: 1 }} />

      <Animated.View entering={FadeInDown.delay(300).springify().damping(18)}
        style={{ paddingHorizontal: 24, paddingBottom: 28, gap: 12, width: '100%', maxWidth: theme.LAYOUT.maxContentWidth, alignSelf: 'center' }}>
        <Button title="Get started" icon="arrow-forward" onPress={() => router.push('/onboarding')} />
        <Button title="I already have an account" variant="secondary" onPress={() => router.push('/(auth)/login')} />
        <Button title="Continue as Reviewer / Guest" variant="ghost" icon="eye-outline" onPress={async () => { const r = await loginAsGuest(); if (!r.success) Alert.alert('Demo unavailable', r.message); }} />
        <T v="caption" color={C.textTertiary} style={{ textAlign: 'center' }}>HEWAL3 supports your care and does not replace your clinician.</T>
      </Animated.View>
    </View>
  );
}

function BreathingLogo() {
  const scale = React.useRef(new RNAnimated.Value(1)).current;
  React.useEffect(() => {
    const animation = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(scale, { toValue: 1.06, duration: 1400, useNativeDriver: true }),
        RNAnimated.timing(scale, { toValue: 1, duration: 1400, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [scale]);
  return (
    <RNAnimated.View style={{ transform: [{ scale }] }}>
      <Image source={require('../assets/images/logo.png')} style={{ width: 96, height: 64 }} resizeMode="contain" accessibilityLabel="HEWAL3" />
    </RNAnimated.View>
  );
}
