import * as Clipboard from 'expo-clipboard';
import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Platform, Share } from 'react-native';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Badge, Banner, Button, Card, EmptyState, ListRow, Screen, ScreenHeader, Section, T, TextField } from '../../components/ui';
import { Reveal } from '../../components/ui/motion';
import { theme } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import api, { PrivacyAccess } from '../../services/api';
import { Ionicons, RefreshControl, View } from '../../components/themed';

const C = theme.COLORS;
const ago = (iso: string | null) => {
  if (!iso) return '';
  const m = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60000));
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};

export default function PrivacyCenter() {
  const router = useRouter();
  const { logout } = useAuth();
  const [access, setAccess] = useState<PrivacyAccess | null>(null);
  const [log, setLog] = useState<{ id: number; viewer: string; what: string; at: string | null }[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDelete, setShowDelete] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [a, l] = await Promise.allSettled([api.getPrivacyAccess(), api.getAccessLog()]);
    if (a.status === 'fulfilled') setAccess(a.value); else setError('Could not load your privacy settings.');
    if (l.status === 'fulfilled') setLog(l.value.items);
    setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const revoke = (id: number, name: string) => Alert.alert(`Stop sharing with ${name}?`, 'They will no longer see your health information. You can reconnect later if you want.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Stop sharing', style: 'destructive', onPress: async () => { try { await api.revokeAccess(id); load(); } catch (e: any) { Alert.alert('Could not update', e.message); } } }]);

  const download = async () => {
    setExporting(true);
    try {
      const data = await api.exportMyData();
      const json = JSON.stringify(data, null, 2);
      if (Platform.OS === 'web') {
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        const a = document.createElement('a'); a.href = url; a.download = 'hewal3-my-data.json'; a.click(); URL.revokeObjectURL(url);
      } else {
        try { await Share.share({ title: 'My HEWAL3 data', message: json }); }
        catch { await Clipboard.setStringAsync(json); Alert.alert('Copied', 'Your data was copied. Paste it somewhere safe.'); }
      }
    } catch (e: any) { Alert.alert('Could not export', e.message); }
    finally { setExporting(false); }
  };

  const remove = async () => {
    setBusy(true); setError(null);
    try { await api.deleteMyAccount(password, confirm); await logout(); router.replace('/(auth)/login' as any); }
    catch (e: any) { setError(e.message || 'Could not delete your account.'); }
    finally { setBusy(false); }
  };

  return (
    <ProtectedRoute>
      <Screen keyboard header={<ScreenHeader title="Privacy centre" subtitle="You are in control of your information" onBack={() => router.back()} />}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.primary} onRefresh={() => { setRefreshing(true); load(); }} />}>
        {error && !showDelete ? <View style={{ marginBottom: 12 }}><Banner tone="danger" text={error} /></View> : null}

        <Reveal index={0}>
          <Section title="Who can see your health information">
            {access && access.people.length ? (
              <Card style={{ paddingVertical: 4 }}>
                {access.people.map((p) => (
                  <ListRow key={p.relationship_id} icon="person-outline" title={p.name} subtitle={`${p.relationship || 'Care circle'}${p.status === 'pending' ? ' (waiting for approval)' : ''}`}
                    right={<Button title="Stop" variant="secondary" onPress={() => revoke(p.relationship_id, p.name)} style={{ minHeight: 40, paddingHorizontal: 14 }} />} />
                ))}
              </Card>
            ) : (
              <Card><EmptyState icon="lock-closed-outline" title="Nobody" text="Your information is private to you. People only see it after you connect them in Care." /></Card>
            )}
            {access ? (
              <Card style={{ marginTop: 12 }}>
                <T v="overline" color={C.textSecondary} style={{ marginBottom: 6 }}>People you connect can see</T>
                {access.can_see.map((x) => <View key={x} style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}><Ionicons name="eye-outline" size={18} color={C.primary} /><T v="caption" style={{ flex: 1 }}>{x}</T></View>)}
                <T v="overline" color={C.textSecondary} style={{ marginTop: 12, marginBottom: 6 }}>Never shared</T>
                {access.never_shared.map((x) => <View key={x} style={{ flexDirection: 'row', gap: 8, paddingVertical: 4 }}><Ionicons name="lock-closed-outline" size={18} color={C.success} /><T v="caption" style={{ flex: 1 }}>{x}</T></View>)}
                <View style={{ marginTop: 12 }}><Banner tone="success" text={access.employers_and_insurers} /></View>
              </Card>
            ) : null}
          </Section>
        </Reveal>

        <Reveal index={1}>
          <Section title="Who has looked at your information">
            <Card style={{ paddingVertical: 4 }}>
              {log.length === 0 ? <T v="caption" color={C.textSecondary} style={{ padding: 14 }}>Nobody has looked at your information yet. Every time someone does, it appears here.</T>
                : log.slice(0, 15).map((l) => (
                  <ListRow key={l.id} icon="time-outline" title={`${l.viewer} viewed ${l.what}`} subtitle={ago(l.at)} />
                ))}
            </Card>
          </Section>
        </Reveal>

        <Reveal index={2}>
          <Section title="Your data">
            <Card>
              <T v="bodyStrong">Download a copy</T>
              <T v="caption" color={C.textSecondary} style={{ marginTop: 2, marginBottom: 12 }}>Everything HEWAL3 holds about you in one file: readings, meals, medicines, goals, check-ins and messages. Passwords and sign-in details are never included.</T>
              <Button title="Download my data" icon="download-outline" variant="secondary" onPress={download} loading={exporting} />
            </Card>
            <Card tone="danger" style={{ marginTop: 12 }}>
              <T v="bodyStrong" color={C.danger}>Delete my account</T>
              <T v="caption" color={C.textPrimary} style={{ marginTop: 2 }}>This permanently erases your account and everything linked to it. It cannot be undone.</T>
              {!showDelete ? <Button title="Delete my account" icon="trash-outline" variant="danger" onPress={() => setShowDelete(true)} style={{ marginTop: 12 }} /> : (
                <View style={{ marginTop: 14 }}>
                  {error ? <View style={{ marginBottom: 12 }}><Banner tone="danger" text={error} /></View> : null}
                  <TextField label="Your password" value={password} onChangeText={setPassword} secure autoCapitalize="none" />
                  <TextField label="Type DELETE to confirm" value={confirm} onChangeText={setConfirm} autoCapitalize="characters" />
                  <Button title="Permanently delete everything" variant="danger" onPress={remove} loading={busy} disabled={!password || confirm !== 'DELETE'} />
                  <Button title="Cancel" variant="ghost" onPress={() => { setShowDelete(false); setPassword(''); setConfirm(''); setError(null); }} style={{ marginTop: 8 }} />
                </View>
              )}
            </Card>
          </Section>
        </Reveal>
      </Screen>
    </ProtectedRoute>
  );
}
