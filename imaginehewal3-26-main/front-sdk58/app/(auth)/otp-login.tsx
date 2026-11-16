import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Banner, Button, Card, Screen, ScreenHeader, T, TextField } from '../../components/ui';
import { theme } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { Ionicons, View } from '../../components/themed';

const C = theme.COLORS;
const COOLDOWN = 60;

/** Sign in without a password: we email a 6-digit code, and typing it signs you in. The code works once, for 10 minutes. */
export default function OtpLoginScreen() {
  const router = useRouter();
  const { loginWithCode } = useAuth();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (wait <= 0) return undefined; const t = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(t); }, [wait]);

  const request = async () => {
    setErr(null); setNote(null);
    if (!/\S+@\S+\.\S+/.test(email)) { setErr('Enter a valid email address.'); return; }
    setBusy(true);
    try { const r = await api.requestOTP(email.trim()); setSent(true); setNote(r.message); setWait(COOLDOWN); setCode(''); }
    catch (e: any) { setErr(e.message || 'Could not send the code. Please try again.'); }
    finally { setBusy(false); }
  };

  const verify = async () => {
    setErr(null); setNote(null);
    if (!/^\d{6}$/.test(code)) { setErr('Enter the 6 digits from the email.'); return; }
    setBusy(true);
    const r = await loginWithCode(email.trim(), code);            // on success the app sends you to your home by itself
    setBusy(false);
    if (!r.success) setErr(r.message || 'That code did not work.');
  };

  return (
    <Screen keyboard header={<ScreenHeader title="Sign in with a code" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/login' as any))} />} contentStyle={{ gap: 14, paddingBottom: 40 }}>
      <Card tone="soft">
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Ionicons name="mail-open-outline" size={26} color={C.primary} />
          <T v="caption" color={C.textSecondary} style={{ flex: 1 }}>No password needed. We email you a 6-digit code that works once, for 10 minutes. Never share it with anyone.</T>
        </View>
      </Card>
      {err ? <Banner tone="danger" text={err} /> : null}
      {note ? <Banner tone="success" text={note} /> : null}
      <TextField label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" />
      {!sent ? <Button title="Email me a code" icon="send" onPress={request} loading={busy} /> : (
        <>
          <TextField label="6-digit code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} placeholder="123456" style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }} />
          <Button title="Sign in" icon="log-in-outline" onPress={verify} loading={busy} disabled={code.length !== 6} />
          <Button title={wait > 0 ? `Send a new code in ${wait}s` : 'Send me a new code'} variant="secondary" onPress={request} disabled={wait > 0 || busy} />
        </>
      )}
      <Button title="Use my password instead" variant="secondary" onPress={() => router.replace('/(auth)/login' as any)} />
    </Screen>
  );
}
