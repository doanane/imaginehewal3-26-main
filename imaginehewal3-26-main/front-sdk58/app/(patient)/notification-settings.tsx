import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Linking } from 'react-native';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Banner, Card, Chip, Screen, ScreenHeader, Section, T } from '../../components/ui';
import { Ionicons, Switch, View } from '../../components/themed';
import { theme } from '../../constants/theme';
import api from '../../services/api';
import { applyHabitReminders, habitRemindersAvailable } from '../../services/habitReminders';
import { getReminderSettings, LEAD_CHOICES, refreshMedicineReminders, saveReminderSettings } from '../../services/medicationReminders';
import { pushModulePresent, pushSwitchedOff, registerForPush, setPushSwitchedOff, unregisterPush } from '../../services/pushNotifications';

const C = theme.COLORS;

function Row({ icon, title, text, value, onChange, disabled }: { icon: React.ComponentProps<typeof Ionicons>['name']; title: string; text: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 }}>
      <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={20} color={C.primary} /></View>
      <View style={{ flex: 1 }}>
        <T v="bodyStrong">{title}</T>
        <T v="caption" color={C.textSecondary}>{text}</T>
      </View>
      <Switch value={value} onValueChange={onChange} disabled={disabled} accessibilityLabel={title} />
    </View>
  );
}

/** What reaches this phone, and when. Every switch here changes something real and is remembered. */
export default function NotificationSettings() {
  const router = useRouter();
  const [push, setPush] = useState(true);
  const [pushNote, setPushNote] = useState<string | null>(null);
  const [med, setMed] = useState<{ enabled: boolean; leadMin: number }>({ enabled: true, leadMin: 5 });
  const [habit, setHabit] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let live = true;
    pushSwitchedOff().then((off) => { if (live) setPush(!off); });
    getReminderSettings().then((s) => { if (live) setMed(s); });
    api.getReminderPlan().then((r) => { if (live) setHabit((r?.settings?.mode || 'auto') !== 'off'); }).catch(() => { if (live) setHabit(null); });
    return () => { live = false; };
  }, []));

  const togglePush = async (on: boolean) => {
    setPush(on); setPushNote(null);
    if (!on) { await setPushSwitchedOff(true); await unregisterPush(); setPushNote('Switched off. This phone will not get alerts when the app is closed. Emergency alerts inside the app still show.'); return; }
    await setPushSwitchedOff(false);
    const r = await registerForPush();
    if (r === 'registered') setPushNote('On. You will get alerts when the app is closed.');
    else if (r === 'denied') { setPush(false); await setPushSwitchedOff(true); setPushNote('Your phone is blocking notifications for HEWAL3. Allow them in your phone settings, then switch this on again.'); }
    else setPushNote(r === 'unavailable' ? 'This version of the app cannot receive push alerts yet.' : 'Could not switch it on. Check your connection and try again.');
  };

  const saveMed = async (next: { enabled: boolean; leadMin: number }) => {
    setMed(next);
    await saveReminderSettings(next);
    const r = await refreshMedicineReminders({ ask: next.enabled });
    if (next.enabled && r === 'denied') { setError('Your phone is blocking notifications for HEWAL3, so medicine reminders cannot ring. Allow them in your phone settings.'); setMed({ ...next, enabled: false }); await saveReminderSettings({ ...next, enabled: false }); }
    else setError(null);
  };

  const toggleHabit = async (on: boolean) => {
    setHabit(on);
    try {
      const plan = await api.setReminderSettings(on ? 'auto' : 'off');
      if (habitRemindersAvailable()) await applyHabitReminders(plan, { title: 'A small step today', body: 'Open HEWAL3 for your next step.' }, { ask: on });
      setError(null);
    } catch (e: any) { setHabit(!on); Alert.alert('', e?.message || 'Could not save that.'); }
  };

  return (
    <ProtectedRoute>
      <Screen header={<ScreenHeader title="Notifications" subtitle="What reaches your phone" onBack={() => router.back()} />} contentStyle={{ gap: 14, paddingBottom: 48 }}>
        {error ? <Banner tone="warning" text={error} action="Open phone settings" onAction={() => Linking.openSettings().catch(() => {})} /> : null}

        <Section title="On this phone">
          <Card>
            <Row icon="notifications-outline" title="Alerts when the app is closed" text="Messages, appointment changes, test results and calls" value={push} onChange={togglePush} disabled={!pushModulePresent()} />
            {pushNote ? <T v="caption" color={C.textSecondary} style={{ marginTop: 8 }}>{pushNote}</T> : null}
            {!pushModulePresent() ? <T v="caption" color={C.textSecondary} style={{ marginTop: 8 }}>This version of the app cannot receive push alerts. Update the app to get them.</T> : null}
          </Card>
        </Section>

        <Section title="Reminders">
          <Card style={{ gap: 14 }}>
            <Row icon="medkit-outline" title="Medicine reminders" text="A reminder before each dose, even when the app is closed" value={med.enabled} onChange={(v) => saveMed({ ...med, enabled: v })} />
            {med.enabled ? (
              <View style={{ gap: 8 }}>
                <T v="label" color={C.textSecondary}>Remind me</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {LEAD_CHOICES.map((m) => <Chip key={m} label={m === 0 ? 'At the time' : `${m} min before`} selected={med.leadMin === m} onPress={() => saveMed({ ...med, leadMin: m })} />)}
                </View>
              </View>
            ) : null}
            <View style={{ height: 1, backgroundColor: C.borderLight }} />
            <Row icon="alarm-outline" title="Habit reminders" text={habit === null ? 'Could not load this right now' : 'A gentle nudge at the time you usually check in. It slows down if you are busy.'} value={!!habit} onChange={toggleHabit} disabled={habit === null} />
          </Card>
        </Section>

        <Section title="Always on">
          <Card>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Ionicons name="alert-circle-outline" size={22} color={C.primary} />
              <T v="caption" color={C.textSecondary} style={{ flex: 1 }}>Emergency alerts and calls from your care team cannot be switched off here, because missing one could matter. Change how your phone shows them in your phone settings.</T>
            </View>
          </Card>
        </Section>

        <T v="caption" color={C.textSecondary} style={{ textAlign: 'center' }} onPress={() => Linking.openSettings().catch(() => {})}>Open phone notification settings</T>
      </Screen>
    </ProtectedRoute>
  );
}
