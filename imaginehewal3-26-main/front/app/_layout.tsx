import { Stack } from "expo-router";
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { Platform, StatusBar, StyleSheet, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { ChatbotContainer } from '../components/Chatbot/ChatbotContainer';
import { theme } from '../constants/theme';
import { AuthProvider } from "../contexts/AuthContext";
import { ChatbotProvider } from '../contexts/ChatbotContext';
import { MessagingProvider } from "../contexts/MessagingContext";
import { NutritionProvider } from "../contexts/NutritionContext";
import { ToastProvider } from "../contexts/ToastContext";

SplashScreen.preventAutoHideAsync();

const shouldRestrictToMobile = Platform.OS === 'web';

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      setIsReady(true);
      SplashScreen.hideAsync();
    }, 1000);
  }, []);

  if (!isReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <ToastProvider>
        <AuthProvider>
          <MessagingProvider>
            <NutritionProvider>
              <ChatbotProvider>
                <View style={styles.webWrapper}>
                  <View style={styles.webContainer}>
                    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
                      <StatusBar barStyle="dark-content" backgroundColor={theme.COLORS.background} />
                      <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="index" />
                        <Stack.Screen name="onboarding" />
                        <Stack.Screen name="(auth)" />
                        <Stack.Screen name="(patient)" />
                        <Stack.Screen name="(caregiver)" />
                        <Stack.Screen name="connection-test" options={{ presentation: 'modal' }} />
                        <Stack.Screen name="debug-auth" options={{ presentation: 'modal' }} />
                      </Stack>
                      <ChatbotContainer />
                    </SafeAreaView>
                  </View>
                </View>
              </ChatbotProvider>
            </NutritionProvider>
          </MessagingProvider>
        </AuthProvider>
      </ToastProvider>
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