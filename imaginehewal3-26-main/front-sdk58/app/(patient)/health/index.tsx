import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Badge, Button, Card, Screen, Section, Skeleton, T } from '../../../components/ui';
import { theme } from '../../../constants/theme';
import api, { DashboardData } from '../../../services/api';
import { getHealthKitConnection, HealthKitSnapshot, readHealthKitSnapshot } from '../../../services/healthkit';
import { Ionicons, RefreshControl, View } from '../../../components/themed';

const C = theme.COLORS;

function Value({ value, unit, label, icon, color }: {
  value: string; unit?: string; label: string; icon: React.ComponentProps<typeof Ionicons>['name']; color: string;
}) {
  return (
    <View style={{ flex: 1, minWidth: '46%', padding: 14, borderRadius: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: C.borderLight }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name={icon} size={18} color={color} />
        <T v="caption" color={C.textSecondary}>{label}</T>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 10 }}>
        <T v="title">{value}</T>
        {unit ? <T v="caption" color={C.textSecondary} style={{ marginLeft: 5 }}>{unit}</T> : null}
      </View>
    </View>
  );
}

function Trend({ title, value, detail, tone }: { title: string; value: string; detail: string; tone: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: C.borderLight }}>
      <View style={{ flex: 1 }}>
        <T v="bodyStrong">{title}</T>
        <T v="caption" color={C.textSecondary}>{detail}</T>
      </View>
      <T v="label" color={tone}>{value}</T>
    </View>
  );
}

export default function HealthScreen() {
  const router = useRouter();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [snapshot, setSnapshot] = useState<HealthKitSnapshot | null>(null);
  const [summary, setSummary] = useState<{ readings: any[]; alert_count: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [health, vitals, connection] = await Promise.all([
      api.getHealthDashboard().catch(() => null),
      api.getVitalsSummary(7).catch(() => null),
      getHealthKitConnection(),
    ]);
    setDashboard(health);
    setSummary(vitals);
    if (connection.connected) {
      try { setSnapshot(await readHealthKitSnapshot()); } catch { setSnapshot(null); }
    } else setSnapshot(null);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const latest = summary?.readings?.[summary.readings.length - 1];
  const heartRate = snapshot?.heartRate ?? latest?.heart_rate ?? null;
  const oxygen = snapshot?.oxygenSaturation ?? latest?.blood_oxygen ?? null;
  const dashboardSteps = Number(dashboard?.categories?.find((item) => item.id === 'steps')?.value?.replace(/,/g, '') || '');
  const steps = snapshot?.steps ?? (Number.isFinite(dashboardSteps) && dashboardSteps > 0 ? dashboardSteps : null);
  const bp = snapshot?.bloodPressure.systolic != null && snapshot.bloodPressure.diastolic != null
    ? `${Math.round(snapshot.bloodPressure.systolic)}/${Math.round(snapshot.bloodPressure.diastolic)}`
    : latest?.blood_pressure_systolic && latest?.blood_pressure_diastolic
      ? `${latest.blood_pressure_systolic}/${latest.blood_pressure_diastolic}` : '--';

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.primary} />}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View>
          <T v="display">Health</T>
          <T v="caption" color={C.textSecondary} style={{ marginTop: 3 }}>Your health overview and recent readings.</T>
        </View>
        <Badge label={summary?.alert_count ? `${summary.alert_count} alert${summary.alert_count === 1 ? '' : 's'}` : 'No alerts'} tone={summary?.alert_count ? 'danger' : 'success'} />
      </View>

      <Card tone="soft" style={{ marginTop: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <T v="overline" color={C.textSecondary}>Current status</T>
            <T v="title" style={{ marginTop: 4 }}>{latest?.is_emergency ? 'Needs attention' : 'No active alert'}</T>
          </View>
          <Ionicons name={latest?.is_emergency ? 'warning-outline' : 'shield-checkmark-outline'} size={32} color={latest?.is_emergency ? C.danger : C.success} />
        </View>
        <T v="caption" color={C.textSecondary} style={{ marginTop: 8 }}>
          {snapshot ? 'Showing approved Apple Health data and synced readings.' : 'Connect a wearable or Apple Health to see your personal readings.'}
        </T>
      </Card>

      <Section title="Key readings" action="Devices" onAction={() => router.push('/(patient)/devices' as any)}>
        {loading ? <Skeleton height={150} /> : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <Value label="Heart rate" value={heartRate != null ? String(Math.round(heartRate)) : '--'} unit="bpm" icon="heart-outline" color={C.danger} />
            <Value label="Blood oxygen" value={oxygen != null ? String(Math.round(oxygen)) : '--'} unit="%" icon="water-outline" color={C.info} />
            <Value label="Blood pressure" value={bp} unit={bp === '--' ? undefined : 'mmHg'} icon="pulse-outline" color={C.warning} />
            <Value label="Steps" value={steps != null ? Math.round(steps).toLocaleString() : '--'} unit="today" icon="walk-outline" color={C.success} />
          </View>
        )}
      </Section>

      <Section title="Progress and trends">
        <Card>
          <Trend title="Daily health score" value={dashboard?.daily_score?.score != null ? `${dashboard.daily_score.score}/100` : '--'} detail={dashboard?.daily_score?.message || 'Not enough data yet'} tone={C.primary} />
          <Trend title="Sleep" value={dashboard?.health_snapshot?.sleep_time ? `${dashboard.health_snapshot.sleep_time} min` : '--'} detail="From your latest approved source" tone={C.info} />
          <Trend title="Water" value={dashboard?.health_snapshot?.water_intake != null ? `${dashboard.health_snapshot.water_intake} ml` : '--'} detail="Log water to track this trend" tone={C.info} />
          <Trend title="Recent readings" value={String(summary?.readings?.length ?? 0)} detail="Collected in the last 7 days" tone={C.textSecondary} />
        </Card>
      </Section>

      <Section title="Next actions">
        <Button title="Log a health reading" icon="add-circle-outline" onPress={() => router.push('/(patient)/health/log-health' as any)} />
        <Button title="Review activity" icon="pulse-outline" variant="secondary" style={{ marginTop: 10 }} onPress={() => router.push('/(patient)/activity' as any)} />
        <Button title="Scan or log a meal" icon="restaurant-outline" variant="secondary" style={{ marginTop: 10 }} onPress={() => router.push('/(patient)/nutrition/scan-food' as any)} />
      </Section>
    </Screen>
  );
}
