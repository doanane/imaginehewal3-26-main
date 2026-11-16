import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { useWindowDimensions } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { useAuth } from '../contexts/AuthContext';
import { Image, View } from '../components/themed';

const SHOW_FOR_MS = 1800;

/**
 * The splash: the HEWAL3 logo on white, in the same place as the phone's own launch image so the two join up, then the onboarding carousel (/intro).
 * Signed-in people never get past this screen: the auth guard sends them to their home as soon as the session is known.
 */
export default function Splash() {
  const router = useRouter();
  const { isLoading, isAuthenticated } = useAuth();
  const { width } = useWindowDimensions();
  const size = Math.min(width * 0.78, 340);
  const born = useRef(Date.now());
  const grow = useSharedValue(0.94);
  const fade = useSharedValue(0);

  useEffect(() => {
    fade.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
    grow.value = withTiming(1, { duration: 1400, easing: Easing.out(Easing.cubic) });
  }, []);                                                                                           // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isLoading || isAuthenticated) return undefined;               // wait for the session check; a signed-in person is redirected elsewhere
    const wait = Math.max(0, SHOW_FOR_MS - (Date.now() - born.current));
    const t = setTimeout(() => router.replace('/intro'), wait);
    return () => clearTimeout(t);
  }, [isLoading, isAuthenticated, router]);

  const style = useAnimatedStyle(() => ({ opacity: fade.value, transform: [{ scale: grow.value }] }));
  return (
    <View style={{ flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={style}>
        <Image source={require('../assets/images/logo.png')} style={{ width: size, height: size }} resizeMode="contain" accessibilityLabel="HEWAL3" />
      </Animated.View>
    </View>
  );
}
