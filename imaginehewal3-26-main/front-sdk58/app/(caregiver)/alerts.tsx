import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { ago, SOS_TEXT, usePull, useRealtimeReload } from '../../components/CareParts';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Badge, Banner, Button, Card, EmptyState, Screen, ScreenHeader, Section, Skeleton, T } from '../../components/ui';
import { theme } from '../../constants/theme';
import api, { SosEvent } from '../../services/api';
import { RefreshControl, View } from '../../components/themed';

const C = theme.COLORS;

export default function CaregiverAlerts() {
  const router = useRouter();
  const [events, setEvents] = useState<SosEvent[] | null>(null);
  const [recent, setRecent] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [e, d] = await Promise.all([api.getActiveEmergencies(), api.getCaregiverDashboard() as Promise<any>]);
      setEvents(e.patients || []); setRecent((d.recent_alerts || []).filter((a: any) => a.type !== 'critical' || !(e.patients || []).some((x) => x.id === a.id))); setError(null);
    } catch (err: any) { setError(err?.message || 'Could not load alerts.'); setEvents((x) => x ?? []); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useRealtimeReload(load);
  const onRefresh = usePull(load, setRefreshing);

  const act = async (id: number, kind: 'ack' | 'resolve') => {
    setBusy(id);
    try { await (kind === 'ack' ? api.ackEmergency(id) : api.resolveEmergency(id)); api.invalidateApiCache(); await load(); }
    catch (e: any) { Alert.alert('Could not update', e?.message || 'Try again.'); }
    finally { setBusy(null); }
  };

  return (
    <ProtectedRoute>
      <Screen
        header={<ScreenHeader title="Emergencies and alerts" subtitle="Live" onBack={() => router.back()} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        contentStyle={{ gap: 14, paddingBottom: 48 }}
      >
        {error ? <Banner tone="warning" text={error} action="Try again" onAction={load} /> : null}
        {events === null ? <Skeleton height={120} /> : events.length === 0 ? (
          <EmptyState icon="shield-checkmark-outline" title="No open emergencies" text="If one of your patients' watch reports a dangerous reading, or they press SOS, it appears here at once." />
        ) : events.map((e) => (
          <Card key={e.id} tone="danger">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
              <T v="bodyStrong" style={{ flex: 1 }}>{e.patient_name}</T>
              <Badge label={e.status === 'escalated' ? 'Escalated' : e.status === 'acknowledged' ? 'Responding' : 'Open'} tone="danger" />
            </View>
            <T v="body" style={{ marginTop: 4 }}>{e.reason}</T>
            <T v="caption" color={C.textSecondary} style={{ marginTop: 4 }}>{SOS_TEXT[e.status] || e.status} · {ago(e.created_at)}{e.attempts ? ` · alerted ${e.attempts}x` : ''}</T>
            {e.status === 'escalated' ? <T v="caption" color={C.danger} style={{ marginTop: 4 }}>Emergency number {e.emergency_number} has been contacted{e.dispatch_mode === 'simulate' ? ' (simulation mode)' : ''}.</T> : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
              {e.status !== 'acknowledged' && e.status !== 'escalated' ? <View style={{ flex: 1, minWidth: 140 }}><Button title="I am responding" icon="hand-right-outline" loading={busy === e.id} onPress={() => act(e.id, 'ack')} /></View> : null}
              {e.patient_phone ? <View style={{ flex: 1, minWidth: 140 }}><Button title="Call patient" variant="secondary" icon="call-outline" onPress={() => Linking.openURL(`tel:${e.patient_phone}`)} /></View> : null}
              {e.location_url ? <View style={{ flex: 1, minWidth: 140 }}><Button title="Live location" variant="secondary" icon="location-outline" onPress={() => Linking.openURL(e.location_url as string)} /></View> : null}
              <View style={{ flex: 1, minWidth: 140 }}><Button title="Mark resolved" variant="secondary" loading={busy === e.id} onPress={() => act(e.id, 'resolve')} /></View>
            </View>
            <Button title="Open patient" variant="secondary" style={{ marginTop: 10 }} onPress={() => router.push({ pathname: '/(caregiver)/patient-detail', params: { id: String(e.user_id), name: e.patient_name } })} />
          </Card>
        ))}

        {recent.length ? (
          <Section title="Recent alerts">
            {recent.map((a) => (
              <Card key={`${a.type}-${a.id}`} style={{ marginBottom: 8 }}>
                <T v="bodyStrong">{a.title}</T>
                <T v="caption" color={C.textSecondary}>{a.patient_name} · {ago(a.timestamp)}</T>
                {a.message ? <T v="caption" style={{ marginTop: 4 }}>{a.message}</T> : null}
              </Card>
            ))}
          </Section>
        ) : null}
      </Screen>
    </ProtectedRoute>
  );
}
