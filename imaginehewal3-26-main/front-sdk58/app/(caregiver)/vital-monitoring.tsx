import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ago, bpText, statusOf, usePull, useRealtimeReload } from '../../components/CareParts';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Avatar, Badge, Banner, Card, EmptyState, Screen, ScreenHeader, Skeleton, T } from '../../components/ui';
import { theme } from '../../constants/theme';
import api from '../../services/api';
import { RefreshControl, View } from '../../components/themed';

const C = theme.COLORS;

export default function LiveVitals() {
  const router = useRouter();
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setRows(await api.getAssignedPatients() as any[]); setError(null); }
    catch (e: any) { setError(e?.message || 'Could not load vitals.'); setRows((r) => r ?? []); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useRealtimeReload(load, ['vitals.update', 'emergency.update', 'emergency.started']);
  const onRefresh = usePull(load, setRefreshing);

  return (
    <ProtectedRoute>
      <Screen
        header={<ScreenHeader title="Live vitals" subtitle="Updates as each watch sends data" onBack={() => router.back()} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />}
        contentStyle={{ gap: 12, paddingBottom: 48 }}
      >
        {error ? <Banner tone="warning" text={error} action="Try again" onAction={load} /> : null}
        {rows === null ? <><Skeleton height={120} /><Skeleton height={120} /></> : rows.length === 0 ? (
          <EmptyState icon="pulse-outline" title="No patients linked yet" text="Once a patient approves your request, their live heart rate, oxygen and blood pressure show here." action="Add a patient" onAction={() => router.push('/(caregiver)/patients')} />
        ) : rows.map((p) => {
          const st = statusOf(p.status); const v = p.vitals || {};
          const bad = p.status === 'critical';
          return (
            <Card key={p.id} tone={bad ? 'danger' : 'default'} onPress={() => router.push({ pathname: '/(caregiver)/patient-detail', params: { id: String(p.id), name: p.patient_name } })}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={p.patient_name} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T v="bodyStrong" numberOfLines={1}>{p.patient_name}</T>
                  <T v="caption" color={C.textSecondary}>Updated {ago(v.at)}</T>
                </View>
                <Badge label={st.label} tone={st.tone} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
                {[['Heart rate', v.heart_rate != null ? `${v.heart_rate}` : '--', 'bpm'], ['Oxygen', v.blood_oxygen != null ? `${v.blood_oxygen}` : '--', '%'], ['Blood pressure', bpText(v), ''], ['Steps', v.steps != null ? `${v.steps}` : '--', '']].map(([l, val, u]) => (
                  <View key={l} style={{ alignItems: 'center', flex: 1 }}>
                    <T v="title" color={bad ? C.danger : C.textPrimary}>{val}</T>
                    <T v="caption" color={C.textSecondary}>{l}{u && val !== '--' ? ` (${u})` : ''}</T>
                  </View>
                ))}
              </View>
              {p.reasons?.length ? <T v="caption" color={C.danger} style={{ marginTop: 10 }}>{p.reasons.join(' · ')}</T> : null}
            </Card>
          );
        })}
      </Screen>
    </ProtectedRoute>
  );
}
