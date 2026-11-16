import React from 'react';
import { Badge, Banner, Button, Card, Chip, T } from '../ui';
import { Ionicons, View } from '../themed';
import { theme } from '../../constants/theme';
import { chooseStepSource, HealthSyncState } from '../../services/healthSync';
import { ago } from '../CareParts';

const C = theme.COLORS;
const when = (ms: number | null) => (ms ? ago(new Date(ms).toISOString()) : 'not yet');

/**
 * Where the numbers on the Health screen come from, in plain view: whether Apple Health is connected, when it was last read, when
 * it was last shared with the care team, and what each app (iPhone, HUAWEI Health, oraimo health...) counted today.
 */
export function SourcesCard({ sync, onConnect, onSync }: { sync: HealthSyncState; onConnect: () => void; onSync: () => void }) {
  const { connection, snapshot, status } = sync;
  const connected = !!connection?.connected;

  if (status === 'unavailable' || (connection && !connection.available)) {
    return (
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Ionicons name="fitness-outline" size={22} color={C.textSecondary} /><T v="heading" style={{ flex: 1 }}>Data sources</T><Badge label="Unavailable" tone="neutral" /></View>
        <T v="caption" color={C.textSecondary} style={{ marginTop: 8 }}>
          {connection?.reason === 'android' ? 'Apple Health is available on iPhone only.' : 'Apple Health needs the full HEWAL3 app build (not Expo Go). Until then, readings can still be logged by hand or sent from a Bluetooth watch.'}
        </T>
        <Button title="Other ways to connect" variant="secondary" style={{ marginTop: 12 }} onPress={onConnect} />
      </Card>
    );
  }

  if (!connected) {
    return (
      <Card tone="soft">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Ionicons name="watch-outline" size={22} color={C.primary} /><T v="heading" style={{ flex: 1 }}>No device connected</T><Badge label="Not connected" tone="warning" /></View>
        <T v="caption" color={C.textSecondary} style={{ marginTop: 8 }}>Connect Apple Health to bring in your steps, heart rate, sleep and more from your iPhone and from watch apps such as HUAWEI Health or oraimo health. Until then, the numbers below only include what you log yourself.</T>
        <Button title="Connect a device" icon="link-outline" style={{ marginTop: 12 }} onPress={onConnect} />
      </Card>
    );
  }

  const bySource = snapshot?.stepsBySource ?? [];
  const selected = snapshot?.stepsAuto ? 'auto' : snapshot?.stepsSource ?? 'auto';
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="fitness-outline" size={22} color={C.success} />
        <T v="heading" style={{ flex: 1 }}>Data sources</T>
        <Badge label={status === 'syncing' ? 'Syncing...' : status === 'offline' ? 'Offline' : 'Connected'} tone={status === 'offline' ? 'warning' : 'success'} />
      </View>
      <T v="caption" color={C.textSecondary} style={{ marginTop: 6 }}>Apple Health read {when(sync.readAt)}. Shared with your care team {when(sync.uploadedAt)}.</T>
      {sync.error ? <View style={{ marginTop: 8 }}><Banner tone="warning" text={sync.error} /></View> : null}

      <T v="overline" color={C.textSecondary} style={{ marginTop: 14 }}>STEPS TODAY, BY APP</T>
      {bySource.length ? bySource.map((s) => (
        <View key={s.name} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 }}>
          <T v="body" style={{ flex: 1 }} numberOfLines={1}>{s.name}</T>
          <T v="bodyStrong">{s.steps.toLocaleString()}</T>
          {snapshot?.stepsSource === s.name ? <Badge label="counted" tone="success" /> : null}
        </View>
      )) : <T v="caption" color={C.textSecondary} style={{ marginTop: 6 }}>No app has written steps today yet. Open your watch app so it syncs to Apple Health, then pull down here. If it still shows nothing, check that Steps is switched on for HEWAL3 in the iPhone Settings app, under Health, then Data Access & Devices.</T>}

      {bySource.length > 1 || (bySource.length === 1 && snapshot?.stepsSource === 'Apple Health (all sources combined)') ? (
        <>
          <T v="caption" color={C.textSecondary} style={{ marginTop: 8 }}>Apple Health hides steps that overlap between apps, so the phone's count can hide your watch's. Choose which one HEWAL3 counts:</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            <Chip label="Automatic (most steps)" selected={selected === 'auto'} onPress={() => { void chooseStepSource('auto'); }} />
            {bySource.map((s) => <Chip key={s.name} label={s.name} selected={selected === s.name} onPress={() => { void chooseStepSource(s.name); }} />)}
          </View>
        </>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
        <View style={{ flex: 1 }}><Button title="Sync now" icon="sync-outline" variant="secondary" loading={status === 'syncing'} onPress={onSync} /></View>
        <View style={{ flex: 1 }}><Button title="Manage devices" variant="secondary" onPress={onConnect} /></View>
      </View>
    </Card>
  );
}
