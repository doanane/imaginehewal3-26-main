import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Banner, Button, Card, Screen, ScreenHeader, T, TextField } from '../../components/ui';
import { theme } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { Ionicons, View } from '../../components/themed';

const C = theme.COLORS;
const COOLDOWN = 60;

/** Confirm the email address with the 6-digit code that was emailed (the email also has a link that works in any browser). */
export default function VerifyEmailScreen() {
  const router = useRouter();
  const { user, checkAuth } = useAuth();
  const [email, setEmail] = useState(user?.email || '');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [wait, setWait] = useState(0);
  const [done, setDone] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (wait <= 0) return undefined; const t = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(t); }, [wait]);

  const goOn = async () => { await checkAuth(); router.replace(user ? '/(patient)/(tabs)/today' as any : '/(auth)/login'); };

  const verify = async () => {
    setErr(null); setNote(null);
    if (!/\S+@\S+\.\S+/.test(email)) { setErr('Enter the email address you signed up with.'); return; }
    if (!/^\d{6}$/.test(code)) { setErr('Enter the 6 digits from the email.'); return; }
    setBusy(true);
    try { await api.verifyEmailCode(email.trim(), code); setDone(true); }
    catch (e: any) { setErr(e.message || 'That did not work. Please try again.'); }
    finally { setBusy(false); }
  };

  const resend = async () => {
    setErr(null); setNote(null); setResending(true);
    try { const r = await api.resendVerification(email.trim()); setNote(r.message); setWait(COOLDOWN); }
    catch (e: any) { setErr(e.message || 'Could not send the email.'); }
    finally { setResending(false); }
  };

  return (
    <Screen keyboard header={<ScreenHeader title="Verify your email" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(auth)/login' as any))} />} contentStyle={{ gap: 16, paddingBottom: 40 }}>
      {done ? (
        <Card tone="soft" style={{ alignItems: 'center', paddingVertical: 28, gap: 10 }}>
          <Ionicons name="checkmark-circle" size={56} color={C.success} />
          <T v="title">Email verified</T>
          <T v="body" color={C.textSecondary} style={{ textAlign: 'center' }}>Thank you. Your email address is confirmed.</T>
          <View style={{ alignSelf: 'stretch', marginTop: 8 }}><Button title="Continue" onPress={goOn} /></View>
        </Card>
      ) : (
        <>
          <Card>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="mail-outline" size={24} color={C.primary} /></View>
              <View style={{ flex: 1 }}>
                <T v="heading">Check your inbox</T>
                <T v="caption" color={C.textSecondary}>We sent a 6-digit code to your email address. It works for 10 minutes. Look in the spam folder too.</T>
                {user?.email ? <T v="label" numberOfLines={1}>{user.email}</T> : null}
              </View>
            </View>
          </Card>
          {err ? <Banner tone="danger" text={err} /> : null}
          {note ? <Banner tone="success" text={note} /> : null}
          {user?.email ? null : <TextField label="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />}
          <TextField label="Verification code" value={code} onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} placeholder="123456" style={{ fontSize: 24, letterSpacing: 8, textAlign: 'center' }} />
          <Button title="Verify email" icon="checkmark" onPress={verify} loading={busy} disabled={code.length !== 6} />
          <Button title={wait > 0 ? `Send a new code in ${wait}s` : 'Send me a new code'} variant="secondary" onPress={resend} loading={resending} disabled={wait > 0} />
          <Button title="Do this later" variant="secondary" onPress={goOn} />
        </>
      )}
    </Screen>
  );
}
