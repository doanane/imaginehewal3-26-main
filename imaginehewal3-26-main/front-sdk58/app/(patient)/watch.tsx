import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Badge, Banner, Button, Card, Screen, ScreenHeader, Section, T } from '../../components/ui';
import { Pulse } from '../../components/ui/motion';
import { theme } from '../../constants/theme';
import { bluetoothAvailable, connectWatch, disconnectWatch, FoundWatch, lastWatchId, scanWatches, WatchStatus } from '../../services/watchBle';
import { Ionicons, Pressable, View } from '../../components/themed';

const C = theme.COLORS;

export default function WatchScreen() {
  const router = useRouter();
  const [found, setFound] = useState<FoundWatch[]>([]);
  const [scanning, setScanning] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [status, setStatus] = useState<WatchStatus>({ state: 'idle' });
  const stop = useRef<(() => void) | null>(null);
  const available = bluetoothAvailable();

  const startScan = useCallback(async () => {
    setProblem(null); setFound([]); setScanning(true);
    stop.current?.();
    stop.current = await scanWatches((w) => setFound((x) => [...x, w].sort((a, b) => Number(b.standardHr) - Number(a.standardHr) || (b.rssi ?? -100) - (a.rssi ?? -100))), (m) => { setProblem(m); setScanning(false); });
    setTimeout(() => { stop.current?.(); setScanning(false); }, 15000);        // a scan drains the battery, so it stops by itself
  }, []);

  useEffect(() => {
    if (!available) return;
    lastWatchId().then((id) => { if (id) connectWatch(id, setStatus); else startScan(); });
    return () => { stop.current?.(); };
  }, [available, startScan]);

  const connect = (w: FoundWatch) => { stop.current?.(); setScanning(false); connectWatch(w.id, setStatus); };
  const live = status.state === 'connected';

  return (
    <ProtectedRoute>
      <Screen header={<ScreenHeader title="Connect a watch" subtitle="Bluetooth heart rate" onBack={() => router.back()} />} contentStyle={{ paddingBottom: 48 }}>
        {!available ? (
          <Banner tone="warning" text="Bluetooth needs the HEWAL3 development build. Expo Go does not include it. Build it once with: npx expo run:ios" />
        ) : null}
        {problem ? <Banner tone="warning" text={problem} /> : null}
        {status.state === 'error' ? <Banner tone="danger" text={status.message || 'Could not connect.'} action="Scan again" onAction={startScan} /> : null}
        {status.state === 'no-hr' ? <Banner tone="info" text={`${status.name}: ${status.message} You can still bring its data in through Apple Health if its own app supports that.`} /> : null}

        {live || status.state === 'connecting' ? (
          <Card style={{ alignItems: 'center', paddingVertical: 24 }}>
            <Pulse active={live}><Ionicons name="heart" size={40} color={C.danger} /></Pulse>
            <T v="display" style={{ fontSize: 56, lineHeight: 64, marginTop: 6 }}>{live && status.hr ? status.hr : '--'}</T>
            <T v="caption" color={C.textSecondary}>{status.state === 'connecting' ? 'Connecting...' : status.hr ? 'beats per minute, live' : 'Waiting for the first reading. Heart rate can take a few seconds.'}</T>
            {live ? <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}><Badge label={status.name || 'Watch'} tone="success" />{status.battery != null ? <Badge label={`Battery ${status.battery}%`} tone="neutral" /> : null}</View> : null}
            {live ? <Button title="Disconnect" variant="secondary" style={{ marginTop: 16, alignSelf: 'stretch' }} onPress={async () => { await disconnectWatch(); setStatus({ state: 'idle' }); startScan(); }} /> : null}
            {live ? <T v="caption" color={C.textTertiary} style={{ marginTop: 10, textAlign: 'center' }}>Readings are sent to your account about every 10 seconds, so your care team and alerts see them.</T> : null}
          </Card>
        ) : null}

        {available && !live ? (
          <Section title={scanning ? 'Looking for devices...' : 'Nearby devices'}>
            <Card style={{ paddingVertical: 4 }}>
              {found.length === 0 ? <T v="caption" color={C.textSecondary} style={{ padding: 14 }}>{scanning ? 'Wake your watch and keep it close. Close its own app on this phone first, because a watch usually connects to one app at a time.' : 'No devices found.'}</T> : null}
              {found.map((w) => (
                <Pressable key={w.id} onPress={() => connect(w)} accessibilityRole="button" accessibilityLabel={`Connect ${w.name}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 56 }}>
                  <Ionicons name="watch-outline" size={24} color={C.primary} />
                  <View style={{ flex: 1 }}><T v="bodyStrong">{w.name}</T><T v="caption" color={C.textSecondary}>{w.standardHr ? 'Shares heart rate' : 'Tap to check what it shares'}</T></View>
                  {w.standardHr ? <Badge label="Heart rate" tone="success" /> : null}
                </Pressable>
              ))}
            </Card>
            <Button title={scanning ? 'Scanning...' : 'Scan again'} variant="secondary" icon="refresh" onPress={startScan} disabled={scanning} style={{ marginTop: 12 }} />
          </Section>
        ) : null}

        <Section title="If your watch is not listed or shares nothing">
          <Card>
            <T v="body">Many watches only talk to their own app. In that case:</T>
            <T v="caption" color={C.textSecondary} style={{ marginTop: 8 }}>1. In the watch's own app, turn on syncing to Apple Health.</T>
            <T v="caption" color={C.textSecondary} style={{ marginTop: 4 }}>2. In HEWAL3, open Devices and connect Apple Health.</T>
            <T v="caption" color={C.textSecondary} style={{ marginTop: 4 }}>3. Heart rate, steps, sleep and workouts then flow into HEWAL3.</T>
            <T v="caption" color={C.textTertiary} style={{ marginTop: 10 }}>Some watches also have a "heart rate broadcast" option in their settings. Turn it on and they appear in the list above.</T>
          </Card>
        </Section>
      </Screen>
    </ProtectedRoute>
  );
}
