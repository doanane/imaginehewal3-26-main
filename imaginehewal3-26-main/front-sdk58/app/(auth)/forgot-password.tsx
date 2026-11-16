import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Banner, Button, Card, Screen, ScreenHeader, T, TextField } from '../../components/ui';
import { theme } from '../../constants/theme';
import api from '../../services/api';
import { Ionicons, View } from '../../components/themed';

const C = theme.COLORS;

/** Step 1 of resetting a password: we email a 6-digit code (and a link). The answer is the same for every address, so nobody can probe for accounts. */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(String(params.email || ''));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const send = async () => {
    setErr(null);
    if (!/\S+@\S+\.\S+/.test(email)) { setErr('Enter the email address of your account.'); return; }
    setBusy(true);
    try {
      await api.forgotPassword(email.trim());
      router.push({ pathname: '/(auth)/reset-password' as any, params: { email: email.trim() } });
    } catch (e: any) { setErr(e.message || 'Could not send the email. Please try again.'); }
    finally { setBusy(false); }
  };

  return (
    <Screen keyboard header={<ScreenHeader title="Forgot password" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/login' as any))} />} contentStyle={{ gap: 16, paddingBottom: 40 }}>
      <Card tone="soft">
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Ionicons name="mail-outline" size={26} color={C.primary} />
          <T v="caption" color={C.textSecondary} style={{ flex: 1 }}>Enter your email address. If there is an account for it, we send a 6-digit code to choose a new password.</T>
        </View>
      </Card>
      {err ? <Banner tone="danger" text={err} /> : null}
      <TextField label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" />
      <Button title="Send me a code" icon="send" onPress={send} loading={busy} />
      <Button title="I already have a code" variant="secondary" onPress={() => router.push({ pathname: '/(auth)/reset-password' as any, params: { email: email.trim() } })} />
    </Screen>
  );
}
