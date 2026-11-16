import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert } from 'react-native';
import { Banner, Button, Card, Screen, ScreenHeader, T, TextField } from '../../components/ui';
import { theme } from '../../constants/theme';
import api from '../../services/api';
import { Ionicons, View } from '../../components/themed';

const C = theme.COLORS;

/** Change the password while signed in. The server checks the current one, emails a confirmation and signs the person out of their other devices. */
export default function ChangePasswordScreen() {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    if (!current) { setErr('Enter your current password.'); return; }
    if (next.length < 8) { setErr('The new password needs at least 8 characters.'); return; }
    if (next === current) { setErr('Choose a password that is different from your current one.'); return; }
    if (next !== again) { setErr('The two new passwords are not the same.'); return; }
    setBusy(true);
    try {
      await api.changePassword(current, next);
      Alert.alert('Password changed', 'We emailed you a confirmation. You were signed out of your other devices.', [{ text: 'OK', onPress: () => router.back() }]);
    } catch (e: any) { setErr(e.message || 'Could not change the password. Please try again.'); }
    finally { setBusy(false); }
  };

  return (
    <Screen keyboard header={<ScreenHeader title="Change password" onBack={() => (router.canGoBack() ? router.back() : router.replace('/(patient)/(tabs)/me' as any))} />} contentStyle={{ gap: 14, paddingBottom: 40 }}>
      <Card tone="soft">
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Ionicons name="shield-checkmark-outline" size={26} color={C.primary} />
          <T v="caption" color={C.textSecondary} style={{ flex: 1 }}>Use a password you do not use anywhere else. We email you when it changes, so you would know if someone else did it.</T>
        </View>
      </Card>
      {err ? <Banner tone="danger" text={err} /> : null}
      <TextField label="Current password" value={current} onChangeText={setCurrent} secure autoCapitalize="none" textContentType="password" />
      <TextField label="New password" value={next} onChangeText={setNext} secure autoCapitalize="none" textContentType="newPassword" helper="At least 8 characters." />
      <TextField label="Repeat the new password" value={again} onChangeText={setAgain} secure autoCapitalize="none" textContentType="newPassword" />
      <Button title="Change password" icon="key-outline" onPress={submit} loading={busy} />
      <Button title="I forgot my current password" variant="secondary" onPress={() => router.push('/(auth)/forgot-password' as any)} />
    </Screen>
  );
}
