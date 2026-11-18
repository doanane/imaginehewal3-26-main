import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import ProtectedRoute from '../../components/ProtectedRoute';
import { TimeList } from '../../components/TimePicker';
import { Badge, Banner, Button, Card, Chip, EmptyState, ListRow, ProgressBar, Screen, ScreenHeader, Section, T, TextField } from '../../components/ui';
import { Reveal } from '../../components/ui/motion';
import { theme } from '../../constants/theme';
import api, { MedDose } from '../../services/api';
import { callOrQueue } from '../../services/offlineActions';
import { getReminderSettings, LEAD_CHOICES, refreshMedicineReminders, remindersAvailable, saveReminderSettings, ReminderSettings } from '../../services/medicationReminders';
import { Ionicons, RefreshControl, View } from '../../components/themed';

const C = theme.COLORS;
const label = (t: string) => { const [h, m] = t.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`; };
const TONE = { taken: 'success', skipped: 'neutral', overdue: 'danger', pending: 'info' } as const;

export default function Medications() {
  const router = useRouter();
  const [today, setToday] = useState<{ doses: MedDose[]; taken: number; total: number; weekly_adherence: number | null } | null>(null);
  const [meds, setMeds] = useState<{ id: number; name: string; dose: string | null; times: string[] }[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [offline, setOffline] = useState(false);
  const [name, setName] = useState('');
  const [dose, setDose] = useState('');
  const [times, setTimes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [rem, setRem] = useState<ReminderSettings>({ enabled: true, leadMin: 5 });
  const [remNote, setRemNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [t, m] = await Promise.allSettled([api.getMedicationsToday(), api.getMedications()]);
    if (t.status === 'fulfilled') setToday(t.value);
    if (m.status === 'fulfilled') setMeds(m.value);
    setRefreshing(false);
    getReminderSettings().then(setRem);
    refreshMedicineReminders({ ask: true }).then((r) => setRemNote(r === 'denied' ? 'Allow notifications for HEWAL3 in Settings so reminders can reach you.' : r === 'unavailable' && !remindersAvailable() ? 'Reminders need the updated HEWAL3 app (a new build).' : null));
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const mark = async (d: MedDose, status: 'taken' | 'skipped') => {
    setToday((p) => p && { ...p, doses: p.doses.map((x) => (x.medication_id === d.medication_id && x.time === d.time ? { ...x, status } : x)), taken: p.taken + (status === 'taken' ? 1 : 0) });  // instant feedback
    try {
      const r = await callOrQueue(`/medications/${d.medication_id}/log`, 'POST', { time: d.time, status });
      setOffline(r.queued);
      refreshMedicineReminders();                                   // a dose just handled must not remind again
      if (!r.queued) load();
    } catch (e: any) { Alert.alert('Could not save', e.message); load(); }
  };

  const add = async () => {
    if (!name.trim() || !times.length) { Alert.alert('Add a medicine', 'Enter its name and choose at least one time.'); return; }
    setSaving(true);
    try { await api.addMedication({ name: name.trim(), dose: dose.trim() || undefined, times }); setName(''); setDose(''); setTimes([]); setAdding(false); await load(); }
    catch (e: any) { Alert.alert('Could not add', e.message); }
    finally { setSaving(false); }
  };

  const remove = (id: number, n: string) => Alert.alert(`Remove ${n}?`, 'You will stop getting reminders for it.', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: async () => { await api.removeMedication(id); load(); } }]);

  const pct = today?.total ? today.taken / today.total : 0;
  return (
    <ProtectedRoute>
      <Screen keyboard header={<ScreenHeader title="My medicines" onBack={() => router.back()} />}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.primary} onRefresh={() => { setRefreshing(true); load(); }} />}>
        {offline ? <View style={{ marginBottom: 12 }}><Banner tone="info" text="Saved on your phone. It will sync when you are back online." /></View> : null}

        <Reveal index={0}>
          <Card>
            <T v="overline" color={C.textSecondary}>Today</T>
            <T v="title" style={{ marginTop: 2 }}>{today ? `${today.taken} of ${today.total} doses taken` : '...'}</T>
            <View style={{ marginTop: 10 }}><ProgressBar value={pct} color={C.success} /></View>
            {today?.weekly_adherence != null ? <T v="caption" color={C.textSecondary} style={{ marginTop: 8 }}>This week: {Math.round(today.weekly_adherence * 100)}% of doses taken</T> : null}
          </Card>
        </Reveal>

        <Section title="Reminders">
          <Card>
            <T v="bodyStrong">Remind me before each dose</T>
            <T v="caption" color={C.textSecondary} style={{ marginTop: 2 }}>You choose how early. A reminder arrives even when the app is closed.</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              <Chip label="Off" selected={!rem.enabled} onPress={async () => { const n = { ...rem, enabled: false }; setRem(n); await saveReminderSettings(n); refreshMedicineReminders(); }} />
              {LEAD_CHOICES.map((lead) => (
                <Chip key={lead} label={lead === 0 ? 'At the time' : `${lead} min before`} selected={rem.enabled && rem.leadMin === lead}
                  onPress={async () => { const n = { enabled: true, leadMin: lead }; setRem(n); await saveReminderSettings(n); refreshMedicineReminders({ ask: true }); }} />
              ))}
            </View>
            {remNote ? <View style={{ marginTop: 10 }}><Banner tone="warning" text={remNote} /></View> : null}
          </Card>
        </Section>

        <Section title="Doses today">
          {!today || today.doses.length === 0 ? (
            <Card><EmptyState icon="medkit-outline" title="No medicines yet" text="Add the medicines you take so we can remind you and keep track." action="Add a medicine" onAction={() => setAdding(true)} /></Card>
          ) : today.doses.map((d, i) => (
            <Reveal key={`${d.medication_id}-${d.time}`} index={i}>
              <Card style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="medkit-outline" size={22} color={C.primary} />
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <T v="bodyStrong" numberOfLines={1}>{d.name}{d.dose ? `, ${d.dose}` : ''}</T>
                    <T v="caption" color={C.textSecondary}>{label(d.time)}</T>
                  </View>
                  <Badge label={d.status === 'taken' ? 'Taken' : d.status === 'skipped' ? 'Skipped' : d.status === 'overdue' ? 'Overdue' : 'Due'} tone={TONE[d.status]} />
                </View>
                {d.status === 'pending' || d.status === 'overdue' ? (
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                    <Button title="Taken" icon="checkmark" onPress={() => mark(d, 'taken')} style={{ flex: 1 }} />
                    <Button title="Skip" variant="secondary" onPress={() => mark(d, 'skipped')} style={{ flex: 1 }} />
                  </View>
                ) : null}
              </Card>
            </Reveal>
          ))}
        </Section>

        <Section title="Add a medicine" action={adding ? 'Close' : 'Add'} onAction={() => setAdding((a) => !a)}>
          {adding ? (
            <Card>
              <TextField label="Name" value={name} onChangeText={setName} placeholder="For example Amlodipine" autoCapitalize="words" />
              <TextField label="Dose (optional)" value={dose} onChangeText={setDose} placeholder="For example 5 mg" />
              <T v="label" color={C.textSecondary} style={{ marginBottom: 8 }}>When do you take it?</T>
              <View style={{ marginBottom: 16 }}><TimeList times={times} onChange={setTimes} addLabel="Add a time" /></View>
              <Button title="Save medicine" onPress={add} loading={saving} />
              <T v="caption" color={C.textTertiary} style={{ marginTop: 10 }}>Only add what your clinician or pharmacist has told you to take.</T>
            </Card>
          ) : null}
        </Section>

        {meds.length ? (
          <Section title="All my medicines">
            <Card>{meds.map((m) => (
              <ListRow key={m.id} icon="medkit-outline" title={m.name} subtitle={`${m.dose ? m.dose + ', ' : ''}${m.times.map(label).join(', ')}`} onPress={() => remove(m.id, m.name)}
                right={<Ionicons name="trash-outline" size={20} color={C.danger} />} />
            ))}</Card>
          </Section>
        ) : null}
      </Screen>
    </ProtectedRoute>
  );
}
