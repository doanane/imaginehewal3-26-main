import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useRealtimeReload, usePull } from '../../components/CareParts';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Badge, Banner, Button, Card, EmptyState, Screen, ScreenHeader, Section, Skeleton, T } from '../../components/ui';
import { theme } from '../../constants/theme';
import api, { DoctorNoteItem, DoctorRx } from '../../services/api';
import { RefreshControl, View } from '../../components/themed';

const C = theme.COLORS;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }) : '');

/** What the doctor decided: medicines they prescribed and the notes they chose to share. Private notes never reach this screen. */
export default function DoctorCare() {
  const router = useRouter();
  const [rx, setRx] = useState<DoctorRx[] | null>(null);
  const [notes, setNotes] = useState<DoctorNoteItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [p, n] = await Promise.all([api.getDoctorPrescriptions(), api.getDoctorNotes()]);
      setRx(p.prescriptions); setNotes(n.notes); setError(null);
    } catch (e: any) { setError(e?.message || 'Could not load this.'); setRx((r) => r ?? []); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useRealtimeReload(load, ['prescription.update', 'note.new']);
  const onRefresh = usePull(load, setRefreshing);

  const active = (rx || []).filter((r) => r.status === 'active');
  const stopped = (rx || []).filter((r) => r.status === 'stopped');

  return (
    <ProtectedRoute>
      <Screen header={<ScreenHeader title="From your doctor" subtitle="Medicines and notes" onBack={() => router.back()} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />} contentStyle={{ gap: 14, paddingBottom: 48 }}>
        {error ? <Banner tone="warning" text={error} action="Try again" onAction={load} /> : null}
        {rx === null ? <Skeleton height={110} /> : (
          <>
            <Section title="Prescribed medicines">
              {active.length === 0 ? <EmptyState icon="medkit-outline" title="Nothing prescribed yet" text="Medicines your doctor prescribes appear here and in your daily medicine list." /> : active.map((r) => (
                <Card key={r.id} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <T v="bodyStrong" style={{ flex: 1 }}>{r.name}</T>
                    {r.dose ? <Badge label={r.dose} tone="info" /> : null}
                  </View>
                  <T v="caption" color={C.textSecondary}>{`Take at ${r.times.join(', ')}`}</T>
                  {r.instructions ? <T v="body" style={{ marginTop: 4 }}>{r.instructions}</T> : null}
                  <T v="caption" color={C.textTertiary} style={{ marginTop: 4 }}>{`${r.doctor || 'Your doctor'}, ${day(r.prescribed)}`}</T>
                </Card>
              ))}
              {active.length > 0 ? <Button title="Open my medicine list" variant="secondary" icon="medkit-outline" onPress={() => router.push('/(patient)/medications' as any)} /> : null}
            </Section>
            {stopped.length > 0 ? (
              <Section title="Stopped by your doctor">
                {stopped.map((r) => (
                  <Card key={r.id} style={{ marginBottom: 10 }}>
                    <T v="bodyStrong">{r.name}</T>
                    <T v="caption" color={C.textSecondary}>{`Stopped ${day(r.stopped)}${r.stop_reason ? `. ${r.stop_reason}` : ''}`}</T>
                  </Card>
                ))}
              </Section>
            ) : null}
            <Section title="Notes shared with you">
              {notes.length === 0 ? <EmptyState icon="document-text-outline" title="No shared notes" text="When your doctor shares a note with you, you can read it here." /> : notes.map((n) => (
                <Card key={n.id} style={{ marginBottom: 10 }}>
                  <T v="body">{n.text}</T>
                  <T v="caption" color={C.textTertiary} style={{ marginTop: 6 }}>{day(n.at)}</T>
                </Card>
              ))}
            </Section>
          </>
        )}
      </Screen>
    </ProtectedRoute>
  );
}
