import { KeyboardInset } from '../components/KeyboardInset';
import { Stack } from "expo-router";
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet } from "react-native";
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AccessibilityLayer, HomeAccessibilityProvider, useHomeAccessibility } from '../components/HomeAccessibility';
import { SafeAreaView, StatusBar, View } from '../components/themed';
import { theme } from '../constants/theme';
import { AuthProvider } from "../contexts/AuthContext";
import { ChatbotProvider } from '../contexts/ChatbotContext';
import { MessagingProvider } from "../contexts/MessagingContext";
import { EmergencyProvider } from "../contexts/EmergencyContext";
import EmergencyAlertModal from "../components/EmergencyAlertModal";
import CallHost from "../components/CallHost";
import PushHost from "../components/PushHost";
import GuestBanner from "../components/GuestBanner";
import { NutritionProvider } from "../contexts/NutritionContext";
import { ToastProvider } from "../contexts/ToastContext";

import '../i18n/alertPatch';

SplashScreen.preventAutoHideAsync();

const shouldRestrictToMobile = Platform.OS === 'web';

/** The navigator paints behind every screen; it must follow light/dark too or a white flash shows between screens. */
function ThemedStack() {
  const a = useHomeAccessibility();
  const bg = a.mapper ? a.mapper('#F4F7FA', 'bg') : '#F4F7FA';
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="intro" />
      <Stack.Screen name="onboarding" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(patient)" />
      <Stack.Screen name="(caregiver)" />
      <Stack.Screen name="connection-test" options={{ presentation: 'modal' }} />
      <Stack.Screen name="debug-auth" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setIsReady(true);                       // no artificial wait: the splash goes as soon as the first screen can draw
    SplashScreen.hideAsync().catch(() => {});
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <HomeAccessibilityProvider>
          <ToastProvider>
            <MessagingProvider>
              <EmergencyProvider>
                <NutritionProvider>
                  <ChatbotProvider>
                    <AccessibilityLayer>
                      <View style={styles.webWrapper}>
                        <View style={styles.webContainer}>
                          <KeyboardInset>
                          <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
                            <GuestBanner />
                            <StatusBar barStyle="dark-content" />
                            <ThemedStack />
                            <EmergencyAlertModal />
                            <CallHost />
                            <PushHost />
                          </SafeAreaView>
                          </KeyboardInset>
                        </View>
                      </View>
                    </AccessibilityLayer>
                  </ChatbotProvider>
                </NutritionProvider>
              </EmergencyProvider>
            </MessagingProvider>
          </ToastProvider>
        </HomeAccessibilityProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  webWrapper: {
    flex: 1,
    backgroundColor: shouldRestrictToMobile ? theme.COLORS.separator : theme.COLORS.background,
    alignItems: shouldRestrictToMobile ? 'center' : undefined,
    // Web-specific: ensure full viewport height
    ...(Platform.OS === 'web' ? { minHeight: '100vh' as any } : {}),
  },
  webContainer: {
    flex: 1,
    width: '100%',
    maxWidth: shouldRestrictToMobile ? theme.LAYOUT.maxContentWidth : undefined,
    backgroundColor: theme.COLORS.background,
    // Web-specific: set height and overflow for proper scrolling
    ...(Platform.OS === 'web' ? {
      height: '100vh' as any,
      overflow: 'hidden' as any,
    } : {}),
    ...(shouldRestrictToMobile && {
      ...theme.SHADOWS.large,
      borderLeftWidth: 1,
      borderRightWidth: 1,
      borderColor: theme.COLORS.border,
    }),
  },
  safeArea: {
    flex: 1,
    backgroundColor: theme.COLORS.background,
  },
});
