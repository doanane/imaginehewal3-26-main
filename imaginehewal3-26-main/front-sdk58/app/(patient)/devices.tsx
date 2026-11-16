import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Linking } from 'react-native';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Badge, Banner, Button, Card, ListRow, Screen, ScreenHeader, Section, T } from '../../components/ui';
import { theme } from '../../constants/theme';
import api, { HuaweiStatus } from '../../services/api';
import { connectHealthKit, disconnectHealthKit } from '../../services/healthkit';
import { useHealthSync } from '../../services/healthSync';
import { SourcesCard } from '../../components/health/SourcesCard';
import { RefreshControl, View } from '../../components/themed';

const C = theme.COLORS;

function ago(iso?: string | null): string {
  if (!iso) return 'no reading yet';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 90) return 'just now';
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}

function Metric({ label, value, unit, when }: { label: string; value: string | number | null | undefined; unit?: string; when?: string | null }) {
  const has = value !== null && value !== undefined;
  return (
    <View style={{ flexGrow: 1, flexBasis: '45%', backgroundColor: C.background, borderRadius: 12, padding: 12 }}>
      <T v="caption" color={C.textSecondary}>{label}</T>
      <T v="title">{has ? value : '--'}{has && unit ? <T v="caption" color={C.textSecondary}> {unit}</T> : null}</T>
      {when !== undefined ? <T v="caption" color={C.textTertiary}>{has ? ago(when) : 'not shared yet'}</T> : null}
    </View>
  );
}

export default function Devices() {
  const router = useRouter();
  const sync = useHealthSync();                       // the same Apple Health state the Home and Health screens use
  const hk = sync.connection;
  const snap = sync.snapshot;
  const uploadedAt = sync.uploadedAt ? new Date(sync.uploadedAt).toISOString() : null;
  const note = sync.error;
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hw, setHw] = useState<HuaweiStatus | null>(null);
  const [hwBusy, setHwBusy] = useState(false);
  const [hwNote, setHwNote] = useState<string | null>(null);
  const loadHuawei = useCallback(() => { api.invalidateApiCache(); api.getHuaweiStatus().then(setHw).catch(() => setHw(null)); }, []);
  useFocusEffect(useCallback(() => { loadHuawei(); }, [loadHuawei]));
  // After signing in on Huawei's page the person comes back to the app: check the link again at once.
  useEffect(() => { const sub = AppState.addEventListener('change', (st) => { if (st === 'active') loadHuawei(); }); return () => sub.remove(); }, [loadHuawei]);

  const connectHuawei = async () => {
    setHwBusy(true); setHwNote(null);
    try { const { url } = await api.connectHuawei(); await Linking.openURL(url); setHwNote('Sign in with your HUAWEI ID in the page that opened, then come back to HEWAL3.'); }
    catch (e: any) { setHwNote(e?.message || 'Could not start the HUAWEI sign-in.'); }
    finally { setHwBusy(false); }
  };
  const syncHuawei = async () => {
    setHwBusy(true); setHwNote(null);
    try { const r = await api.syncHuawei(); api.invalidateApiCache(); loadHuawei(); void sync.syncNow({ force: true }); setHwNote(r.errors.length ? `Read, but HUAWEI refused: ${r.errors.join('; ')}` : `Read ${r.stored.length ? r.stored.join(', ') : 'nothing new'}.`); }
    catch (e: any) { setHwNote(e?.message || 'Could not read HUAWEI Health.'); loadHuawei(); }
    finally { setHwBusy(false); }
  };
  const disconnectHuaweiLink = () => Alert.alert('Disconnect HUAWEI Health?', 'HEWAL3 forgets your HUAWEI sign-in and stops reading it. You can also remove HEWAL3 inside the HUAWEI Health app.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Disconnect', style: 'destructive', onPress: async () => { await api.disconnectHuawei().catch(() => {}); setHwNote(null); loadHuawei(); } },
  ]);

  useFocusEffect(useCallback(() => { void sync.syncNow({ force: true }); }, [])); // eslint-disable-line react-hooks/exhaustive-deps

  const connect = async () => {
    setBusy(true);
    try {
      const result = await connectHealthKit();
      if (result.connected) { await sync.syncNow({ force: true }); return; }
      Alert.alert('Apple Health', result.reason === 'expo-go'
        ? 'Apple Health needs the HEWAL3 app build, not Expo Go.'
        : result.reason === 'android' ? 'Apple Health is available on iPhone only.'
        : result.reason === 'permission' ? 'Nothing was shared. Change this any time in Settings > Health > Data Access & Devices > HEWAL3.'
        : 'Apple Health is not available in this build.');
    } finally { setBusy(false); }
  };

  const remove = () => Alert.alert('Disconnect Apple Health?', 'HEWAL3 stops reading Apple Health. Your data stays in Apple Health. To remove the permission itself, use iPhone Settings > Health.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Disconnect', style: 'destructive', onPress: async () => { await disconnectHealthKit(); await sync.syncNow({ force: true }); } },
  ]);

  const sources = snap?.sources || [];
  const hasHuawei = sources.some((x) => /huawei/i.test(x));
  const hasOraimo = sources.some((x) => /oraimo/i.test(x));

  return (
    <ProtectedRoute>
      <Screen
        header={<ScreenHeader title="Connected devices" subtitle="Your watch and Apple Health" onBack={() => router.back()} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); sync.syncNow({ force: true }).catch(() => {}).finally(() => setRefreshing(false)); }} tintColor={C.primary} />}
        contentStyle={{ gap: 14, paddingBottom: 48 }}
      >
        {note ? <Banner tone="warning" text={note} /> : null}

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <T v="heading">Apple Health</T>
            <Badge label={hk?.connected ? 'Connected' : 'Not connected'} tone={hk?.connected ? 'success' : 'neutral'} />
          </View>
          <T v="caption" color={C.textSecondary} style={{ marginTop: 4 }}>
            Apple Health collects data from your iPhone, an Apple Watch, and apps like HUAWEI Health and oraimo health. HEWAL3 reads it from there.
          </T>

          {hk?.connected && snap ? (
            <>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
                <Metric label="Steps today" value={snap.steps} />
                <Metric label="Heart rate" value={snap.heartRate} unit="bpm" when={snap.heartRateAt} />
                <Metric label="Blood oxygen" value={snap.oxygenSaturation} unit="%" when={snap.oxygenSaturationAt} />
                <Metric label="Blood pressure" value={snap.bloodPressure.systolic && snap.bloodPressure.diastolic ? `${snap.bloodPressure.systolic}/${snap.bloodPressure.diastolic}` : null} when={snap.bloodPressureAt} />
                <Metric label="Active energy today" value={snap.activeEnergyKcal} unit="kcal" />
                <Metric label="Distance today" value={snap.distanceM != null ? (snap.distanceM / 1000).toFixed(2) : null} unit="km" />
              </View>
              <View style={{ marginTop: 14, gap: 6 }}>
                <T v="label" color={C.textSecondary}>DATA COMES FROM</T>
                {sources.length ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{sources.map((x) => <Badge key={x} label={x} tone={/huawei|oraimo/i.test(x) ? 'success' : 'info'} />)}</View>
                ) : <T v="caption" color={C.textSecondary}>No readings found yet. Open your watch app so it syncs, then pull down here.</T>}
                {sources.length && !hasHuawei && !hasOraimo ? <T v="caption" color={C.warning}>Your watch app is not in this list yet, so its data is not reaching Apple Health. See the steps below.</T> : null}
                {hasHuawei || hasOraimo ? <T v="caption" color={C.success}>Your watch data is arriving through Apple Health.</T> : null}
              </View>
              <T v="caption" color={C.textTertiary} style={{ marginTop: 10 }}>
                {uploadedAt ? `Shared with your care team ${ago(uploadedAt)}. ` : ''}Updates by itself when Apple Health receives new readings.
              </T>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <View style={{ flex: 1 }}><Button title="Sync now" icon="sync-outline" variant="secondary" loading={busy} onPress={async () => { setBusy(true); try { await sync.syncNow({ force: true }); } finally { setBusy(false); } }} /></View>
                <View style={{ flex: 1 }}><Button title="Allow more data" variant="secondary" onPress={connect} /></View>
              </View>
              <Button title="Disconnect" variant="secondary" style={{ marginTop: 10 }} onPress={remove} />
            </>
          ) : (
            <Button title="Connect Apple Health" icon="heart-outline" loading={busy} onPress={connect} style={{ marginTop: 14 }} />
          )}
        </Card>

        <Section title="HUAWEI Health (direct connection)">
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <T v="heading">HUAWEI Health</T>
              <Badge label={hw?.linked ? 'Connected' : hw && !hw.configured ? 'Not set up' : 'Not connected'} tone={hw?.linked ? 'success' : 'neutral'} />
            </View>
            <T v="caption" color={C.textSecondary} style={{ marginTop: 6 }}>
              Connect straight to your HUAWEI Health account. HEWAL3 reads your steps, calories, distance, heart rate, blood pressure and oxygen from HUAWEI's cloud, without going through Apple Health.
            </T>
            {hw && !hw.configured ? <View style={{ marginTop: 10 }}><Banner tone="info" text="This server does not have its HUAWEI Health Kit credentials yet. The developer must register the app with HUAWEI and add them (steps are in docs/HUAWEI_HEALTH_SETUP.md). Apple Health still works." /></View> : null}
            {hw?.linked ? (
              <>
                <T v="caption" color={C.textSecondary} style={{ marginTop: 8 }}>{hw.last_sync_at ? `Last read ${ago(hw.last_sync_at)}.` : 'Not read yet.'} It also refreshes by itself every 10 minutes.</T>
                {hw.last_error ? <View style={{ marginTop: 8 }}><Banner tone="warning" text={hw.last_error} /></View> : null}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                  <View style={{ flex: 1 }}><Button title="Read now" icon="sync-outline" variant="secondary" loading={hwBusy} onPress={syncHuawei} /></View>
                  <View style={{ flex: 1 }}><Button title="Disconnect" variant="secondary" onPress={disconnectHuaweiLink} /></View>
                </View>
              </>
            ) : hw?.configured ? (
              <Button title="Connect HUAWEI Health" icon="link-outline" loading={hwBusy} style={{ marginTop: 12 }} onPress={connectHuawei} />
            ) : null}
            {hwNote ? <T v="caption" color={C.textSecondary} style={{ marginTop: 10 }}>{hwNote}</T> : null}
          </Card>
        </Section>

        {hk?.connected ? <SourcesCard sync={sync} onConnect={connect} onSync={() => { void sync.syncNow({ force: true }); }} /> : null}

        <Section title="Get your HUAWEI or oraimo watch data into HEWAL3">
          <Card>
            <T v="caption" color={C.textSecondary}>HEWAL3 does not talk to these watches directly, because they only share with their own app. The reliable route is through Apple Health:</T>
            {[
              '1. Pair the watch in its own app (HUAWEI Health or oraimo health), and let it sync.',
              '2. In that app, turn on sharing to Apple Health. Look for Apple Health in its Settings, Data sharing or Privacy section.',
              '3. On your iPhone open Health > Sharing > Apps > HUAWEI Health (or oraimo health) and switch on the categories you want, such as Steps, Heart Rate and Sleep.',
              '4. Come back here, tap Connect Apple Health, and allow the categories.',
              '5. Open the watch app now and then so it syncs. HEWAL3 picks the new readings up as soon as Apple Health receives them.',
            ].map((t) => <T key={t} v="caption" style={{ marginTop: 8 }}>{t}</T>)}
            <T v="caption" color={C.textTertiary} style={{ marginTop: 10 }}>
              What arrives depends on what the watch app writes. Steps and heart rate are common; oxygen, blood pressure and sleep depend on the watch and app version. Readings keep the time the watch took them, so an old reading is never shown as live.
            </T>
            <Button title="Open the Health app" variant="secondary" style={{ marginTop: 12 }} onPress={() => Linking.openURL('x-apple-health://').catch(() => Alert.alert('Could not open Health', 'Open the Health app from your home screen.'))} />
          </Card>
        </Section>

        <Section title="Other ways to connect">
          <Card style={{ paddingVertical: 4 }}>
            <ListRow icon="bluetooth-outline" title="Bluetooth heart rate" subtitle="Live heart rate from watches and bands that share it" onPress={() => router.push('/(patient)/watch' as any)} />
          </Card>
        </Section>
      </Screen>
    </ProtectedRoute>
  );
}
