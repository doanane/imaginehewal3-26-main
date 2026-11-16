import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Banner, Button, Card, Screen, ScreenHeader, T, TextField } from '../../components/ui';
import { theme } from '../../constants/theme';
import api from '../../services/api';
import { Ionicons, View } from '../../components/themed';

const C = theme.COLORS;
const COOLDOWN = 60;

/** Step 2: the 6-digit code from the email and a new password. The code works once and only for 10 minutes. */
export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(String(params.email || ''));
  const [code, setCode] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [wait, setWait] = useState(0);
  const [done, setDone] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (wait <= 0) return undefined; const t = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(t); }, [wait]);

  const submit = async () => {
    setErr(null); setNote(null);
    if (!/\S+@\S+\.\S+/.test(email)) { setErr('Enter the email address of your account.'); return; }
    if (!/^\d{6}$/.test(code)) { setErr('Enter the 6 digits from the email.'); return; }
    if (next.length < 8) { setErr('The new password needs at least 8 characters.'); return; }
    if (next !== again) { setErr('The two passwords are not the same.'); return; }
    setBusy(true);
    try { await api.resetPasswordWithCode(email.trim(), code, next); setDone(true); }
    catch (e: any) { setErr(e.message || 'That did not work. Please try again.'); }
    finally { setBusy(false); }
  };

  const resend = async () => {
    setErr(null); setNote(null);
    if (!/\S+@\S+\.\S+/.test(email)) { setErr('Enter the email address of your account.'); return; }
    setResending(true);
    try { const r = await api.forgotPassword(email.trim()); setNote(r.message); setWait(COOLDOWN); setCode(''); }
    catch (e: any) { setErr(e.message || 'Could not send the email.'); }
    finally { setResending(false); }
  };

  return (
    <Screen keyboard header={<ScreenHeader title="New password" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/login' as any))} />} contentStyle={{ gap: 14, paddingBottom: 40 }}>
      {done ? (
        <Card tone="soft" style={{ alignItems: 'center', paddingVertical: 28, gap: 10 }}>
          <Ionicons name="checkmark-circle" size={56} color={C.success} />
          <T v="title">Password changed</T>
          <T v="body" color={C.textSecondary} style={{ textAlign: 'center' }}>You were signed out of your other devices and we emailed you a confirmation. Sign in with your new password.</T>
          <View style={{ alignSelf: 'stretch', marginTop: 8 }}><Button title="Sign in" onPress={() => router.replace('/(auth)/login' as any)} /></View>
        </Card>
      ) : (
        <>
          <Card tone="soft">
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Ionicons name="keypad-outline" size={26} color={C.primary} />
              <T v="caption" color={C.textSecondary} style={{ flex: 1 }}>Type the 6-digit code we emailed you, then choose a new password. Check the spam folder if it has not arrived.</T>
            </View>
          </Card>
          {err ? <Banner tone="danger" text={err} /> : null}
          {note ? <Banner tone="success" text={note} /> : null}
          <TextField label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" />
          <TextField label="6-digit code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} placeholder="123456" style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }} />
          <TextField label="New password" value={next} onChangeText={setNext} secure autoCapitalize="none" textContentType="newPassword" helper="At least 8 characters." />
          <TextField label="Repeat the new password" value={again} onChangeText={setAgain} secure autoCapitalize="none" textContentType="newPassword" />
          <Button title="Change password" icon="key-outline" onPress={submit} loading={busy} />
          <Button title={wait > 0 ? `Send a new code in ${wait}s` : 'Send me a new code'} variant="secondary" onPress={resend} loading={resending} disabled={wait > 0} />
        </>
      )}
    </Screen>
  );
}
