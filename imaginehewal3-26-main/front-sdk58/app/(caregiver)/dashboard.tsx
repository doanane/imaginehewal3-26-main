import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ago, bpText, statusOf, useRealtimeReload, usePull } from '../../components/CareParts';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Avatar, Badge, Banner, Button, Card, Chip, EmptyState, IconButton, Screen, ScreenHeader, Section, Skeleton, T } from '../../components/ui';
import { theme } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import api, { SosEvent } from '../../services/api';
import { RefreshControl, View } from '../../components/themed';

const C = theme.COLORS;
type Row = {
  id: number; name: string; patient_id: string; age?: number; gender?: string; status: string; conditions: string[]; last_checkup?: string | null;
  recent_vitals?: { heart_rate?: number | null; blood_oxygen?: number | null; blood_pressure?: string | null; steps?: number | null } | null;
};
type Stats = { total_patients: number; critical_patients: number; pending_tasks: number; todays_appointments: number; overdue_tasks: number };
const FILTERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' }, { key: 'critical', label: 'Critical' }, { key: 'monitor', label: 'Monitor' }, { key: 'stable', label: 'Stable' }, { key: 'no_data', label: 'No data' },
];

export default function CaregiverDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [sos, setSos] = useState<SosEvent[]>([]);
  const [filter, setFilter] = useState('all');
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [d, e] = await Promise.all([api.getCaregiverDashboard() as Promise<any>, api.getActiveEmergencies().catch(() => ({ mine: null, patients: [] as SosEvent[] }))]);
      setRows(d.recent_patients || []); setStats(d.stats); setSos(e.patients || []); setError(null);
    } catch (err: any) { setError(err?.message || 'Could not load your patients.'); setRows((r) => r ?? []); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useRealtimeReload(load);
  const onRefresh = usePull(load, setRefreshing);

  const shown = (rows || []).filter((r) => filter === 'all' || r.status === filter);
  const count = (s: string) => (rows || []).filter((r) => r.status === s).length;
  const first = (user as any)?.first_name || (user as any)?.username || 'there';

  return (
    <ProtectedRoute>
      <Screen
        header={<ScreenHeader title={`Hello, ${first}`} subtitle="Your patients" right={<IconButton icon="person-circle-outline" label="My profile" onPress={() => router.push('/(caregiver)/caregiver-profile')} />} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        contentStyle={{ gap: 14, paddingBottom: 48 }}
      >
        {error ? <Banner tone="warning" text={error} action="Try again" onAction={load} /> : null}

        {sos.map((e) => (
          <Banner key={e.id} tone="danger" title={`${e.patient_name} needs help`} text={`${e.reason}. ${e.status === 'acknowledged' ? 'Someone is responding.' : 'Please respond now.'}`} action="Open" onAction={() => router.push('/(caregiver)/alerts')} />
        ))}

        <View style={{ flexDirection: 'row', gap: 10 }}>
          {[['Patients', stats?.total_patients ?? '-', C.textPrimary], ['Critical', stats?.critical_patients ?? '-', stats?.critical_patients ? C.danger : C.textPrimary], ['Monitor', rows ? count('monitor') : '-', count('monitor') ? C.warning : C.textPrimary], ['Stable', rows ? count('stable') : '-', C.success]].map(([l, v, c]) => (
            <Card key={String(l)} style={{ flex: 1, padding: 12, alignItems: 'center' }}>
              <T v="display" color={String(c)} style={{ fontSize: 26, lineHeight: 32 }}>{String(v)}</T>
              <T v="caption" color={C.textSecondary}>{String(l)}</T>
            </Card>
          ))}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {FILTERS.map((f) => <Chip key={f.key} label={f.label} selected={filter === f.key} onPress={() => setFilter(f.key)} />)}
        </View>

        {rows === null ? (
          <><Skeleton height={110} /><Skeleton height={110} /></>
        ) : (rows.length === 0 ? (
          <EmptyState icon="people-outline" title="No patients linked yet" text="Add a patient with their patient ID. They approve the request in their app, then their health appears here." action="Add a patient" onAction={() => router.push('/(caregiver)/patients')} />
        ) : shown.length === 0 ? (
          <EmptyState icon="checkmark-circle-outline" title="Nobody in this group" text="Pick another filter above." />
        ) : shown.map((p) => {
          const st = statusOf(p.status);
          const v = p.recent_vitals;
          return (
            <Card key={p.id} onPress={() => router.push({ pathname: '/(caregiver)/patient-detail', params: { id: String(p.id), name: p.name } })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={p.name} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T v="bodyStrong" numberOfLines={1}>{p.name}</T>
                  <T v="caption" color={C.textSecondary} numberOfLines={1}>{[p.age ? `${p.age} yrs` : null, p.gender, p.conditions?.join(', ')].filter(Boolean).join(' · ') || p.patient_id}</T>
                </View>
                <Badge label={st.label} tone={st.tone} />
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 }}>
                <T v="caption">HR <T v="bodyStrong">{v?.heart_rate ?? '--'}</T></T>
                <T v="caption">SpO2 <T v="bodyStrong">{v?.blood_oxygen != null ? `${v.blood_oxygen}%` : '--'}</T></T>
                <T v="caption">BP <T v="bodyStrong">{v?.blood_pressure ?? bpText(null)}</T></T>
                <T v="caption">Steps <T v="bodyStrong">{v?.steps ?? '--'}</T></T>
              </View>
              <T v="caption" color={C.textTertiary} style={{ marginTop: 6 }}>Updated {ago(p.last_checkup)}</T>
            </Card>
          );
        }))}

        <Section title="Today">
          <Card onPress={() => router.push('/(caregiver)/tasks')} style={{ marginBottom: 8 }}>
            <T v="bodyStrong">Tasks</T>
            <T v="caption" color={C.textSecondary}>{stats ? `${stats.pending_tasks} open${stats.overdue_tasks ? `, ${stats.overdue_tasks} overdue` : ''}` : 'Loading...'}</T>
          </Card>
          <Card onPress={() => router.push('/(caregiver)/messaging')} style={{ marginBottom: 8 }}>
            <T v="bodyStrong">Messages and calls</T>
            <T v="caption" color={C.textSecondary}>Chat with your patients and call them</T>
          </Card>
          <Card onPress={() => router.push('/(caregiver)/supporting' as any)} style={{ marginBottom: 8 }}>
            <T v="bodyStrong">People who chose you to encourage them</T>
            <T v="caption" color={C.textSecondary}>See who could use a kind word, and send one</T>
          </Card>
          <Card onPress={() => router.push('/(caregiver)/appointments')} style={{ marginBottom: 8 }}>
            <T v="bodyStrong">Appointments</T>
            <T v="caption" color={C.textSecondary}>{stats ? `${stats.todays_appointments} today` : 'Loading...'}</T>
          </Card>
          <Card onPress={() => router.push('/(caregiver)/vital-monitoring')} style={{ marginBottom: 8 }}>
            <T v="bodyStrong">Live vitals</T>
            <T v="caption" color={C.textSecondary}>Heart rate, oxygen and blood pressure for everyone, as it happens</T>
          </Card>
          <Card onPress={() => router.push('/(caregiver)/alerts')}>
            <T v="bodyStrong">Emergencies and alerts</T>
            <T v="caption" color={C.textSecondary}>{sos.length ? `${sos.length} open now` : 'None open'}</T>
          </Card>
        </Section>

        <Button title="Add a patient" variant="secondary" icon="person-add-outline" onPress={() => router.push('/(caregiver)/patients')} />
      </Screen>
    </ProtectedRoute>
  );
}
