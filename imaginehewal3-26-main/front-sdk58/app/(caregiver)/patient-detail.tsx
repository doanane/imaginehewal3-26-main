import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { ago, bpText, HeartChart, SOS_TEXT, statusOf, usePull, useRealtimeReload, VitalTile } from '../../components/CareParts';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Avatar, Badge, Banner, Button, Card, EmptyState, Screen, ScreenHeader, Section, Skeleton, T } from '../../components/ui';
import { theme } from '../../constants/theme';
import { calls } from '../../services/calls';
import api, { CarePatientOverview } from '../../services/api';
import { RefreshControl, View } from '../../components/themed';

const C = theme.COLORS;
const OPEN = ['pending', 'active', 'acknowledged', 'escalated'];

export default function PatientDetail() {
  const router = useRouter();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const pid = Number(id);
  const [d, setD] = useState<CarePatientOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!pid) { setError('No patient selected.'); return; }
    try { setD(await api.getCarePatientOverview(pid)); setError(null); }
    catch (e: any) { setError(e?.message || 'Could not load this patient.'); }
  }, [pid]);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useRealtimeReload(load);
  const onRefresh = usePull(load, setRefreshing);

  const act = async (eventId: number, kind: 'ack' | 'resolve') => {
    setBusy(eventId);
    try { await (kind === 'ack' ? api.ackEmergency(eventId) : api.resolveEmergency(eventId)); api.invalidateApiCache(); await load(); }
    catch (e: any) { Alert.alert('Could not update', e?.message || 'Try again.'); }
    finally { setBusy(null); }
  };

  const p = d?.patient;
  const st = statusOf(p?.status);
  const v = p?.vitals;
  const open = (d?.emergencies || []).filter((e) => OPEN.includes(e.status));

  return (
    <ProtectedRoute>
      <Screen
        header={<ScreenHeader title={p?.patient_name || name || 'Patient'} subtitle={p ? `${st.label} · updated ${ago(v?.at)}` : 'Loading'} onBack={() => router.back()} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        contentStyle={{ gap: 14, paddingBottom: 48 }}
      >
        {error ? <Banner tone="warning" text={error} action="Try again" onAction={load} /> : null}
        {!d && !error ? <><Skeleton height={90} /><Skeleton height={140} /></> : null}

        {d && p ? (
          <>
            {open.map((e) => (
              <Banner key={e.id} tone="danger" title="Emergency" text={`${e.reason}. ${SOS_TEXT[e.status] || e.status}.`} />
            ))}
            {open.map((e) => (
              <View key={`a${e.id}`} style={{ flexDirection: 'row', gap: 10 }}>
                {e.status !== 'acknowledged' && e.status !== 'escalated' ? <View style={{ flex: 1 }}><Button title="I am responding" icon="hand-right-outline" loading={busy === e.id} onPress={() => act(e.id, 'ack')} /></View> : null}
                {e.location_url ? <View style={{ flex: 1 }}><Button title="Live location" variant="secondary" icon="location-outline" onPress={() => Linking.openURL(e.location_url as string)} /></View> : null}
                <View style={{ flex: 1 }}><Button title="Mark resolved" variant="secondary" loading={busy === e.id} onPress={() => act(e.id, 'resolve')} /></View>
              </View>
            ))}

            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={p.patient_name} size={52} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T v="bodyStrong">{p.patient_name}</T>
                  <T v="caption" color={C.textSecondary}>{[p.age ? `${p.age} yrs` : null, p.gender, p.patient_id].filter(Boolean).join(' · ')}</T>
                  <T v="caption" color={C.textSecondary}>{p.conditions?.length ? p.conditions.join(', ') : 'No conditions recorded'}</T>
                </View>
                <Badge label={st.label} tone={st.tone} />
              </View>
              {p.reasons?.length ? <T v="caption" color={C.danger} style={{ marginTop: 10 }}>{p.reasons.join(' · ')}</T> : null}
              {d.doctor ? <T v="caption" color={C.textSecondary} style={{ marginTop: 10 }}>Doctor: {d.doctor.name}{d.doctor.hospital ? `, ${d.doctor.hospital}` : ''}</T> : <T v="caption" color={C.textTertiary} style={{ marginTop: 10 }}>No doctor linked yet</T>}
            </Card>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              <VitalTile label="Heart rate" value={v?.heart_rate} unit="bpm" bad={(v?.heart_rate ?? 0) >= 120 || (v?.heart_rate != null && v.heart_rate <= 40)} />
              <VitalTile label="Oxygen" value={v?.blood_oxygen} unit="%" bad={v?.blood_oxygen != null && v.blood_oxygen < 90} />
              <VitalTile label="Blood pressure" value={bpText(v)} bad={(v?.systolic ?? 0) >= 180 || (v?.diastolic ?? 0) >= 120} />
              <VitalTile label="Steps today" value={v?.steps} />
              <VitalTile label="Glucose" value={v?.glucose} unit="mmol/L" />
            </View>

            <Section title="Heart rate, last 24 hours"><Card><HeartChart series={d.vitals_series} /></Card></Section>

            <Section title="Medicines today">
              {d.medications.length === 0 ? <Card><T v="caption" color={C.textSecondary}>No medicines set up yet.</T></Card> : d.medications.map((m, i) => (
                <Card key={i} style={{ marginBottom: 8 }}>
                  <T v="bodyStrong">{m.name}{m.dose ? ` ${m.dose}` : ''}</T>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                    {m.doses.map((x) => <Badge key={x.time} label={`${x.time} ${x.taken ? 'taken' : 'not yet'}`} tone={x.taken ? 'success' : 'neutral'} />)}
                  </View>
                </Card>
              ))}
            </Section>

            <Section title="Emergency history">
              {d.emergencies.length === 0 ? <Card><T v="caption" color={C.textSecondary}>No emergencies recorded.</T></Card> : d.emergencies.slice(0, 5).map((e) => (
                <Card key={e.id} style={{ marginBottom: 8 }}>
                  <T v="bodyStrong">{e.reason}</T>
                  <T v="caption" color={C.textSecondary}>{SOS_TEXT[e.status] || e.status}{e.created_at ? ` · ${ago(e.created_at)}` : ''}</T>
                </Card>
              ))}
            </Section>

            <Button title={`Message ${(p.patient_name || 'patient').split(' ')[0]}`} icon="chatbubble-ellipses-outline" onPress={() => router.push({ pathname: '/(patient)/thread', params: { userId: String(p.id), name: p.patient_name } })} />
            {calls.available ? (
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}><Button title="Voice call" variant="secondary" icon="call-outline" onPress={() => calls.start(p.id, p.patient_name || 'Patient', 'audio')} /></View>
                <View style={{ flex: 1 }}><Button title="Video call" variant="secondary" icon="videocam-outline" onPress={() => calls.start(p.id, p.patient_name || 'Patient', 'video')} /></View>
              </View>
            ) : null}
            <Button title="Care log and team" variant="secondary" icon="document-text-outline" onPress={() => router.push({ pathname: '/(patient)/care-log', params: { patientId: String(p.id), name: p.patient_name } } as any)} />
            <Button title="Add a task for this patient" variant="secondary" icon="checkbox-outline" onPress={() => router.push('/(caregiver)/tasks')} />
          </>
        ) : null}

        {!d && error ? <EmptyState icon="alert-circle-outline" title="Patient not available" text="They may have ended the link, or you may be offline." action="Back" onAction={() => router.back()} /> : null}
      </Screen>
    </ProtectedRoute>
  );
}
