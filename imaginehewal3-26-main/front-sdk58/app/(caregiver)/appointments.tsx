import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Badge, Banner, Button, Card, Chip, EmptyState, Screen, ScreenHeader, Section, Skeleton, T, TextField } from '../../components/ui';
import { usePull } from '../../components/CareParts';
import { theme } from '../../constants/theme';
import api, { AssignedPatient, CaregiverAppointment } from '../../services/api';
import { RefreshControl, View } from '../../components/themed';

const C = theme.COLORS;
const TYPES = [{ key: 'checkup', label: 'Check-up' }, { key: 'medication', label: 'Medicines' }, { key: 'therapy', label: 'Therapy' }, { key: 'consultation', label: 'Consultation' }];
const SLOTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];
const TONE: Record<string, 'success' | 'warning' | 'danger' | 'neutral' | 'info'> = { scheduled: 'warning', confirmed: 'success', completed: 'info', cancelled: 'neutral', no_show: 'danger' };
const when = (iso: string) => new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const dayLabel = (d: Date) => d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' });

/** Visits and appointments a caregiver arranges with the people they care for. Everything here is stored on the server and shared with the patient. */
export default function CaregiverAppointments() {
  const router = useRouter();
  const [rows, setRows] = useState<CaregiverAppointment[] | null>(null);
  const [patients, setPatients] = useState<AssignedPatient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);
  const [pid, setPid] = useState<number | null>(null);
  const [day, setDay] = useState(1);
  const [slot, setSlot] = useState('09:00');
  const [type, setType] = useState('checkup');
  const [title, setTitle] = useState('');
  const [place, setPlace] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const days = useMemo(() => Array.from({ length: 14 }, (_, i) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + i); return d; }), []);

  const load = useCallback(async () => {
    try {
      const [a, p] = await Promise.all([api.getCaregiverAppointments(), api.getAssignedPatients().catch(() => [] as AssignedPatient[])]);
      setRows(a); setPatients(p); setPid((cur) => cur ?? p[0]?.id ?? null); setError(null);
    } catch (e: any) { setError(e?.message || 'Could not load appointments.'); setRows((r) => r ?? []); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = usePull(load, setRefreshing);

  const create = async () => {
    if (!pid) { setFormError('Choose who the appointment is for.'); return; }
    const [h, m] = slot.split(':').map(Number);
    const start = new Date(days[day]); start.setHours(h, m, 0, 0);
    const end = new Date(start.getTime() + 30 * 60000);
    const who = patients.find((p) => p.id === pid);
    setBusy(true); setFormError(null);
    try {
      await api.createAppointment({ patient_id: pid, title: title.trim() || `${TYPES.find((t) => t.key === type)?.label} with ${who?.patient_name?.split(' ')[0] || 'patient'}`,
        appointment_type: type, start_time: start.toISOString(), end_time: end.toISOString(), location: place.trim() || undefined });
      setOpen(false); setTitle(''); setPlace(''); await load();
    } catch (e: any) { setFormError(e?.message || 'Could not save the appointment.'); }
    finally { setBusy(false); }
  };

  const cancel = (a: CaregiverAppointment) => Alert.alert('Cancel this appointment?', `${a.title}\n${when(a.start_time)}`, [
    { text: 'Keep it', style: 'cancel' },
    { text: 'Cancel appointment', style: 'destructive', onPress: async () => { try { await api.cancelAppointment(a.id); await load(); } catch (e: any) { setError(e?.message || 'Could not cancel.'); } } },
  ]);
  const complete = async (a: CaregiverAppointment) => { try { await api.completeAppointment(a.id); await load(); } catch (e: any) { setError(e?.message || 'Could not update.'); } };

  const now = Date.now();
  const live = (a: CaregiverAppointment) => a.status === 'scheduled' || a.status === 'confirmed';
  const upcoming = (rows || []).filter((a) => live(a) && new Date(a.end_time).getTime() > now).sort((x, y) => +new Date(x.start_time) - +new Date(y.start_time));
  const needsClosing = (rows || []).filter((a) => live(a) && new Date(a.end_time).getTime() <= now);
  const earlier = (rows || []).filter((a) => !live(a)).sort((x, y) => +new Date(y.start_time) - +new Date(x.start_time)).slice(0, 15);

  return (
    <ProtectedRoute>
      <Screen header={<ScreenHeader title="Appointments" subtitle="Visits with your patients" onBack={() => router.back()} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />} contentStyle={{ gap: 14, paddingBottom: 48 }}>
        {error ? <Banner tone="warning" text={error} action="Try again" onAction={load} /> : null}

        {!open ? <Button title="New appointment" icon="calendar-outline" onPress={() => setOpen(true)} disabled={patients.length === 0} /> : (
          <Card>
            <T v="heading">Who is it for</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {patients.map((p) => <Chip key={p.id} label={p.patient_name} selected={pid === p.id} onPress={() => setPid(p.id)} />)}
            </View>
            <T v="heading" style={{ marginTop: 14 }}>Day</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {days.map((d, i) => <Chip key={i} label={i === 0 ? 'Today' : dayLabel(d)} selected={day === i} onPress={() => setDay(i)} />)}
            </View>
            <T v="heading" style={{ marginTop: 14 }}>Time</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {SLOTS.map((s) => <Chip key={s} label={s} selected={slot === s} onPress={() => setSlot(s)} />)}
            </View>
            <T v="heading" style={{ marginTop: 14 }}>Kind</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {TYPES.map((t) => <Chip key={t.key} label={t.label} selected={type === t.key} onPress={() => setType(t.key)} />)}
            </View>
            <View style={{ marginTop: 14, gap: 10 }}>
              <TextField label="Title (optional)" value={title} onChangeText={setTitle} maxLength={120} />
              <TextField label="Where (optional)" value={place} onChangeText={setPlace} maxLength={120} placeholder="For example: at their home" />
            </View>
            {formError ? <View style={{ marginTop: 10 }}><Banner tone="danger" text={formError} /></View> : null}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <View style={{ flex: 1 }}><Button title="Back" variant="secondary" onPress={() => setOpen(false)} /></View>
              <View style={{ flex: 1 }}><Button title="Save" loading={busy} onPress={create} /></View>
            </View>
          </Card>
        )}
        {patients.length === 0 && rows !== null ? <Banner tone="info" text="Link a patient first. Appointments are made for people who approved you as their caregiver." /> : null}

        {rows === null ? <Skeleton height={90} /> : (
          <>
            {needsClosing.length > 0 ? (
              <Section title="Did these happen?">
                {needsClosing.map((a) => (
                  <Card key={a.id} style={{ marginBottom: 10 }}>
                    <T v="bodyStrong">{a.title}</T>
                    <T v="caption" color={C.textSecondary}>{`${a.patient_name}, ${when(a.start_time)}`}</T>
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                      <View style={{ flex: 1 }}><Button title="Done" onPress={() => complete(a)} /></View>
                      <View style={{ flex: 1 }}><Button title="Cancel" variant="secondary" onPress={() => cancel(a)} /></View>
                    </View>
                  </Card>
                ))}
              </Section>
            ) : null}
            <Section title="Upcoming">
              {upcoming.length === 0 ? <EmptyState icon="calendar-outline" title="Nothing scheduled" text="Create an appointment above. The patient sees it in their app." /> : upcoming.map((a) => (
                <Card key={a.id} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <T v="bodyStrong" style={{ flex: 1 }}>{a.title}</T>
                    <Badge label={a.status === 'scheduled' ? 'Scheduled' : 'Confirmed'} tone={TONE[a.status]} />
                  </View>
                  <T v="caption" color={C.textSecondary}>{`${a.patient_name}, ${when(a.start_time)}${a.location ? `, ${a.location}` : ''}`}</T>
                  <View style={{ marginTop: 10 }}><Button title="Cancel" variant="secondary" onPress={() => cancel(a)} /></View>
                </Card>
              ))}
            </Section>
            {earlier.length > 0 ? (
              <Section title="Earlier">
                {earlier.map((a) => (
                  <Card key={a.id} style={{ marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                      <T v="bodyStrong" style={{ flex: 1 }}>{a.title}</T>
                      <Badge label={a.status === 'no_show' ? 'No show' : a.status[0].toUpperCase() + a.status.slice(1)} tone={TONE[a.status] || 'neutral'} />
                    </View>
                    <T v="caption" color={C.textSecondary}>{`${a.patient_name}, ${when(a.start_time)}`}</T>
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
