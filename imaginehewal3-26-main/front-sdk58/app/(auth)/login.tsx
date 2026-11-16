import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Alert, Animated as RNAnimated } from 'react-native';
import { Banner, Button, IconButton, Screen, T, TextField } from '../../components/ui';
import { theme } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { Reveal } from '../../components/ui/motion';
import { Image, View } from '../../components/themed';

const C = theme.COLORS;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login() {
  const router = useRouter();
  const { login, loginAsGuest } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const passwordRef = useRef<any>(null);
  const entrance = useRef(new RNAnimated.Value(0)).current;

  React.useEffect(() => {
    RNAnimated.spring(entrance, {
      toValue: 1,
      damping: 16,
      stiffness: 120,
      mass: 0.8,
      useNativeDriver: true,
    }).start();
  }, [entrance]);

  const submit = async () => {
    const next: typeof errors = {};
    if (!EMAIL_RE.test(email.trim())) next.email = 'Enter a valid email address';
    if (!password) next.password = 'Enter your password';
    setErrors(next); setFormError(null);
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const res = await login(email.trim().toLowerCase(), password);
      if (!res.success) setFormError(res.message || 'Email or password is incorrect');
    } catch (e: any) {
      setFormError(e.message || 'Something went wrong. Please try again.');
    } finally { setBusy(false); }
  };

  return (
    <Screen keyboard bg="#fff" contentStyle={{ padding: 24, flexGrow: 1 }}
      header={<View style={{ paddingHorizontal: 8, paddingTop: 4 }}><IconButton icon="chevron-back" label="Back" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} /></View>}>
      <RNAnimated.View style={{ width: '100%', maxWidth: theme.LAYOUT.maxContentWidth, alignSelf: 'center', opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] }}>
        <Reveal index={0}>
          <Image source={require('../../assets/images/logo.png')} style={{ width: 110, height: 44, marginBottom: 24 }} resizeMode="contain" accessibilityLabel="HEWAL3" />
          <T v="display">Welcome back</T>
          <T v="body" color={C.textSecondary} style={{ marginTop: 4, marginBottom: 24 }}>Sign in to continue.</T>
        </Reveal>

        {formError ? <View style={{ marginBottom: 16 }}><Banner tone="danger" text={formError} /></View> : null}

        <Reveal index={1}><TextField label="Email" value={email} onChangeText={setEmail} error={errors.email}
          autoCapitalize="none" autoComplete="email" keyboardType="email-address" textContentType="emailAddress"
          returnKeyType="next" onSubmitEditing={() => passwordRef.current?.focus()} /></Reveal>
        <Reveal index={2}><TextField label="Password" value={password} onChangeText={setPassword} error={errors.password} secure
          autoCapitalize="none" autoComplete="password" textContentType="password" returnKeyType="go" onSubmitEditing={submit}
          inputRef={passwordRef} /></Reveal>

        <View style={{ alignItems: 'flex-end', marginTop: -8, marginBottom: 20 }}>
          <T v="label" color={C.primary} onPress={() => router.push('/(auth)/forgot-password')} accessibilityRole="link" style={{ paddingVertical: 8 }}>Forgot password?</T>
        </View>

        <Reveal index={3}><Button title="Sign in" onPress={submit} loading={busy} /></Reveal>
        <View style={{ height: 12 }} />
        <Reveal index={4}><Button title="Email me a sign-in code" variant="secondary" onPress={() => router.push('/(auth)/otp-login')} /></Reveal>
        <View style={{ height: 12 }} />
        <Reveal index={5}><Button title="Continue as Reviewer / Guest" variant="ghost" icon="eye-outline" onPress={async () => { setBusy(true); const r = await loginAsGuest(); setBusy(false); if (!r.success) Alert.alert('Demo unavailable', r.message); }} /></Reveal>

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 32, gap: 6 }}>
          <T v="caption" color={C.textSecondary}>New to HEWAL3?</T>
          <T v="label" color={C.primary} onPress={() => router.push('/onboarding')} accessibilityRole="link">Create an account</T>
        </View>
      </RNAnimated.View>
    </Screen>
  );
}
