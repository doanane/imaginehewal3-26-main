import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { useRealtimeReload, usePull } from '../../components/CareParts';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Badge, Banner, Button, Card, Chip, EmptyState, Screen, ScreenHeader, Section, Skeleton, T, TextField } from '../../components/ui';
import { theme } from '../../constants/theme';
import api, { DoctorAppt } from '../../services/api';
import { RefreshControl, View } from '../../components/themed';

const C = theme.COLORS;
const MODES: { key: 'in_person' | 'video' | 'phone'; label: string }[] = [{ key: 'in_person', label: 'In person' }, { key: 'video', label: 'Video' }, { key: 'phone', label: 'Phone' }];
const SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];
const TONE: Record<DoctorAppt['status'], 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = { confirmed: 'success', requested: 'warning', declined: 'danger', cancelled: 'neutral', completed: 'info' };
const LABEL: Record<DoctorAppt['status'], string> = { confirmed: 'Confirmed', requested: 'Waiting for your doctor', declined: 'Declined', cancelled: 'Cancelled', completed: 'Done' };
const when = (iso: string) => new Date(iso).toLocaleString([], { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' });
const dayLabel = (d: Date) => d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

/** Ask the linked doctor for a time. The doctor confirms, moves or declines it, and the answer arrives here at once. */
export default function DoctorAppointments() {
  const router = useRouter();
  const [rows, setRows] = useState<DoctorAppt[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);
  const [day, setDay] = useState(1);
  const [slot, setSlot] = useState('09:00');
  const [mode, setMode] = useState<'in_person' | 'video' | 'phone'>('in_person');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d; }), []);

  const load = useCallback(async () => {
    try { setRows((await api.getDoctorAppointments()).appointments); setError(null); }
    catch (e: any) { setError(e?.message || 'Could not load your appointments.'); setRows((r) => r ?? []); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useRealtimeReload(load, ['appointment.update']);
  const onRefresh = usePull(load, setRefreshing);

  const request = async () => {
    const [h, m] = slot.split(':').map(Number);
    const start = new Date(days[day]); start.setHours(h, m, 0, 0);
    setBusy(true); setFormError(null);
    try {
      await api.requestDoctorAppointment({ starts_at: start.toISOString(), duration_min: 30, mode, reason: reason.trim() || undefined });
      setOpen(false); setReason(''); await load();
    } catch (e: any) { setFormError(e?.message || 'Could not send the request.'); }
    finally { setBusy(false); }
  };

  const cancel = (a: DoctorAppt) => Alert.alert('Cancel this appointment?', when(a.starts_at), [
    { text: 'Keep it', style: 'cancel' },
    { text: 'Cancel appointment', style: 'destructive', onPress: async () => { try { await api.cancelDoctorAppointment(a.id); await load(); } catch (e: any) { setError(e?.message || 'Could not cancel.'); } } },
  ]);

  const now = Date.now();
  const upcoming = (rows || []).filter((a) => (a.status === 'requested' || a.status === 'confirmed') && new Date(a.starts_at).getTime() > now - 3600_000).sort((x, y) => +new Date(x.starts_at) - +new Date(y.starts_at));
  const earlier = (rows || []).filter((a) => !upcoming.includes(a));

  return (
    <ProtectedRoute>
      <Screen header={<ScreenHeader title="Appointments" subtitle="With your doctor" onBack={() => router.back()} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />} contentStyle={{ gap: 14, paddingBottom: 48 }}>
        {error ? <Banner tone="warning" text={error} action="Try again" onAction={load} /> : null}
        {!open ? <Button title="Ask for an appointment" icon="calendar-outline" onPress={() => setOpen(true)} /> : (
          <Card>
            <T v="heading">Pick a day</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {days.slice(1).map((d, i) => <Chip key={i} label={dayLabel(d)} selected={day === i + 1} onPress={() => setDay(i + 1)} />)}
            </View>
            <T v="heading" style={{ marginTop: 14 }}>Pick a time</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {SLOTS.map((s) => <Chip key={s} label={s} selected={slot === s} onPress={() => setSlot(s)} />)}
            </View>
            <T v="heading" style={{ marginTop: 14 }}>How</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {MODES.map((m) => <Chip key={m.key} label={m.label} selected={mode === m.key} onPress={() => setMode(m.key)} />)}
            </View>
            <View style={{ marginTop: 14 }}><TextField label="What is it about? (optional)" value={reason} onChangeText={setReason} maxLength={300} placeholder="For example: my blood pressure has been high" /></View>
            <T v="caption" color={C.textSecondary} style={{ marginTop: 8 }}>{`${dayLabel(days[day])} at ${slot}. Your doctor can confirm it or suggest another time.`}</T>
            {formError ? <View style={{ marginTop: 10 }}><Banner tone="danger" text={formError} /></View> : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <View style={{ flex: 1 }}><Button title="Back" variant="secondary" onPress={() => setOpen(false)} /></View>
              <View style={{ flex: 1 }}><Button title="Send request" loading={busy} onPress={request} /></View>
            </View>
          </Card>
        )}

        {rows === null ? <Skeleton height={90} /> : (
          <>
            <Section title="Upcoming">
              {upcoming.length === 0 ? <EmptyState icon="calendar-outline" title="Nothing booked" text="Ask your doctor for a time above. You are told here the moment they answer." /> : upcoming.map((a) => (
                <Card key={a.id} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <T v="bodyStrong" style={{ flex: 1 }}>{when(a.starts_at)}</T>
                    <Badge label={LABEL[a.status]} tone={TONE[a.status]} />
                  </View>
                  <T v="caption" color={C.textSecondary}>{`${a.doctor || 'Your doctor'}, ${MODES.find((m) => m.key === a.mode)?.label.toLowerCase()}, ${a.duration_min} minutes`}</T>
                  {a.reason ? <T v="body" style={{ marginTop: 6 }}>{a.reason}</T> : null}
                  <View style={{ marginTop: 10 }}><Button title="Cancel" variant="secondary" onPress={() => cancel(a)} /></View>
                </Card>
              ))}
            </Section>
            {earlier.length > 0 ? (
              <Section title="Earlier">
                {earlier.map((a) => (
                  <Card key={a.id} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                      <T v="bodyStrong" style={{ flex: 1 }}>{when(a.starts_at)}</T>
                      <Badge label={LABEL[a.status]} tone={TONE[a.status]} />
                    </View>
                    {a.doctor_message ? <T v="body" style={{ marginTop: 6 }}>{`${a.doctor || 'Your doctor'}: ${a.doctor_message}`}</T> : null}
                  </Card>
                ))}
              </Section>
            ) : null}
          </>
        )}
      </Screen>
    </ProtectedRoute>
  );
}
