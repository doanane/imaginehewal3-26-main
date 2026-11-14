import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Switch,
  Text, TouchableOpacity, View,
} from 'react-native';
import api from '../../services/api';

const RED = '#AD0023';
const BEHAVIOR_LABELS: Record<string, string> = {
  movement: 'Move more', nutrition: 'Eat more veg & fruit', sleep: 'Sleep better', smoking: 'Smoke less',
};
const BARRIER_LABELS: Record<string, string> = {
  time: 'No time', tired: 'Too tired', forgot: 'Forgot', motivation: 'Low motivation',
  weather: 'Weather', access: 'No access', pain_sick: 'Pain / sick', stress: 'Stressed',
  craving: 'Craving', other: 'Other',
};
const LANGS: Record<string, string> = { en: 'English', ar: 'العربية', fr: 'Français' };

export default function BehaviorScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [today, setToday] = useState<any>(null);
  const [outcomes, setOutcomes] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [feedback, setFeedback] = useState<Record<number, any>>({});
  const [showWhy, setShowWhy] = useState<Record<number, boolean>>({});
  const [showSettings, setShowSettings] = useState(false);

  const load = useCallback(async () => {
    try {
      const [t, o, s] = await Promise.all([
        api.getBehaviorToday(), api.getBehaviorOutcomes(), api.getBehaviorSettings(),
      ]);
      setToday(t); setOutcomes(o); setSettings(s);
    } catch (e: any) {
      Alert.alert('Could not load', e.message);
    } finally {
      setLoading(false); setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const checkIn = async (actionId: number, body: any) => {
    try {
      const res = await api.checkInBehaviorAction(actionId, body);
      setFeedback((f) => ({ ...f, [actionId]: res }));
      load();
    } catch (e: any) { Alert.alert('Error', e.message); }
  };

  const startPlan = async (behavior: string) => {
    try { await api.createBehaviorPlan({ behavior }); setLoading(true); load(); }
    catch (e: any) { Alert.alert('Error', e.message); }
  };

  const saveSetting = async (patch: any) => {
    try { setSettings(await api.updateBehaviorSettings(patch)); load(); }
    catch (e: any) { Alert.alert('Error', e.message); }
  };

  const syncWearable = async () => {
    try { await api.syncBehaviorWearable(); load(); }
    catch (e: any) { Alert.alert('Wearable sync', e.message); }
  };

  const runDemo = async () => {
    try { await api.seedBehaviorDemo(); setLoading(true); load(); }
    catch (e: any) { Alert.alert('Demo', e.message); }
  };

  const eraseAll = () =>
    Alert.alert('Delete behaviour data?', 'This removes your plans, history and preferences.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await api.deleteBehaviorData(); setLoading(true); load(); } },
    ]);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={RED} /></View>;
  }

  const items: any[] = today?.items || [];
  const activeBehaviors = items.map((i) => i.plan.behavior);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color="#333" /></TouchableOpacity>
        <Text style={styles.title}>My daily step</Text>
        <TouchableOpacity onPress={() => setShowSettings((v) => !v)}><Ionicons name="settings-outline" size={22} color="#333" /></TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}>

        {today?.notice && (
          <View style={styles.banner}><Text style={styles.bannerText}>{today.notice}</Text></View>
        )}

        {items.length === 0 && (
          <View style={styles.card}>
            <Text style={styles.h2}>What would you like to work on?</Text>
            <Text style={styles.muted}>Pick one. You will get one small step a day, and it adapts to you.</Text>
            {Object.keys(BEHAVIOR_LABELS).map((b) => (
              <TouchableOpacity key={b} style={styles.choice} onPress={() => startPlan(b)}>
                <Text style={styles.choiceText}>{BEHAVIOR_LABELS[b]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {items.map(({ plan, action, streak }) => {
          const fb = feedback[action.id];
          const done = action.status !== 'pending';
          return (
            <View key={action.id} style={styles.card}>
              <Text style={styles.tag}>{BEHAVIOR_LABELS[plan.behavior]}{action.is_comeback ? ' · welcome back step' : ''}</Text>
              <Text style={styles.h2}>{action.title}</Text>
              <Text style={styles.body}>{action.detail}</Text>

              <TouchableOpacity onPress={() => setShowWhy((w) => ({ ...w, [action.id]: !w[action.id] }))}>
                <Text style={styles.link}>Why this? ({action.technique})</Text>
              </TouchableOpacity>
              {showWhy[action.id] && <Text style={styles.why}>{action.rationale}</Text>}

              {streak && (
                <Text style={styles.muted}>
                  Streak {streak.current} · best {streak.best} · {streak.total_active_days} active days in total
                </Text>
              )}

              {!done ? (
                <View style={styles.row}>
                  <TouchableOpacity style={[styles.btn, { backgroundColor: '#28a745' }]} onPress={() => checkIn(action.id, { status: 'done' })}>
                    <Text style={styles.btnText}>Done</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, { backgroundColor: '#f0ad4e' }]} onPress={() => checkIn(action.id, { status: 'partial' })}>
                    <Text style={styles.btnText}>A bit</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.btn, { backgroundColor: '#888' }]} onPress={() => checkIn(action.id, { status: 'skipped' })}>
                    <Text style={styles.btnText}>Not today</Text></TouchableOpacity>
                </View>
              ) : (
                <Text style={styles.status}>Today: {action.status}</Text>
              )}

              {fb && <Text style={styles.feedback}>{fb.feedback}</Text>}
              {done && action.status !== 'done' && !action.barrier && (
                <View>
                  <Text style={styles.muted}>{fb?.ask_barrier || today.ask_barrier || 'What got in the way?'}</Text>
                  <View style={styles.chips}>
                    {(today.barrier_options || []).map((b: string) => (
                      <TouchableOpacity key={b} style={styles.chip}
                        onPress={() => checkIn(action.id, { status: action.status, barrier: b })}>
                        <Text style={styles.chipText}>{BARRIER_LABELS[b] || b}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
              {plan.behavior === 'movement' && settings?.wearable_data_enabled && !done && (
                <TouchableOpacity onPress={syncWearable}><Text style={styles.link}>Use my step count</Text></TouchableOpacity>
              )}
            </View>
          );
        })}

        {outcomes.map(({ plan, outcomes: o }) => (
          <View key={plan.id} style={styles.card}>
            <Text style={styles.h2}>Your progress · {BEHAVIOR_LABELS[plan.behavior]}</Text>
            <View style={styles.bars}>
              {o.weekly_adherence.map((w: any) => (
                <View key={w.week_ending} style={styles.barWrap}>
                  <View style={[styles.bar, { height: Math.max(4, w.adherence * 60) }]} />
                  <Text style={styles.barLabel}>{w.week_ending.slice(5)}</Text>
                </View>
              ))}
            </View>
            <Text style={styles.body}>Weeks you kept going: {o.weeks_persisted} of {o.weeks_tracked}</Text>
            <Text style={styles.body}>
              Setbacks: {o.lapses}
              {o.avg_days_to_recover != null ? ` · came back after ${o.avg_days_to_recover} days on average` : ''}
            </Text>
            {o.behaviour_change_pct_vs_baseline != null && (
              <Text style={styles.body}>Change vs. where you started: {o.behaviour_change_pct_vs_baseline}%</Text>
            )}
            <TouchableOpacity onPress={() => api.stopBehaviorPlan(plan.id).then(load)}>
              <Text style={styles.link}>Stop this plan</Text>
            </TouchableOpacity>
          </View>
        ))}

        {items.length > 0 && Object.keys(BEHAVIOR_LABELS).some((b) => !activeBehaviors.includes(b)) && (
          <View style={styles.card}>
            <Text style={styles.h2}>Add another</Text>
            <View style={styles.chips}>
              {Object.keys(BEHAVIOR_LABELS).filter((b) => !activeBehaviors.includes(b)).map((b) => (
                <TouchableOpacity key={b} style={styles.chip} onPress={() => startPlan(b)}>
                  <Text style={styles.chipText}>{BEHAVIOR_LABELS[b]}</Text></TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {showSettings && settings && (
          <View style={styles.card}>
            <Text style={styles.h2}>You are in control</Text>
            <Text style={styles.muted}>{settings.privacy_statement}</Text>
            <View style={styles.setting}><Text style={styles.body}>Reminders</Text>
              <Switch value={settings.notifications_enabled} onValueChange={(v) => saveSetting({ notifications_enabled: v })} /></View>
            <View style={styles.setting}><Text style={styles.body}>Use my wearable step data</Text>
              <Switch value={settings.wearable_data_enabled} onValueChange={(v) => saveSetting({ wearable_data_enabled: v })} /></View>
            <View style={styles.setting}><Text style={styles.body}>Streaks and points</Text>
              <Switch value={settings.gamification_enabled} onValueChange={(v) => saveSetting({ gamification_enabled: v })} /></View>
            <Text style={styles.body}>Language</Text>
            <View style={styles.chips}>
              {Object.keys(LANGS).map((l) => (
                <TouchableOpacity key={l} style={[styles.chip, settings.language === l && styles.chipOn]} onPress={() => saveSetting({ language: l })}>
                  <Text style={[styles.chipText, settings.language === l && { color: '#fff' }]}>{LANGS[l]}</Text></TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity onPress={eraseAll}><Text style={[styles.link, { color: '#c00' }]}>Delete all my behaviour data</Text></TouchableOpacity>
            <TouchableOpacity onPress={runDemo}><Text style={styles.link}>Load demo data (6 weeks incl. a setback)</Text></TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 48, backgroundColor: '#fff' },
  title: { fontSize: 18, fontWeight: '700', color: '#333' },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, marginBottom: 16 },
  banner: { backgroundColor: '#FFF3CD', borderRadius: 12, padding: 14, marginBottom: 16 },
  bannerText: { color: '#664d03', fontSize: 15 },
  tag: { color: RED, fontWeight: '600', marginBottom: 4 },
  h2: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 6 },
  body: { fontSize: 15, color: '#333', marginBottom: 6 },
  muted: { fontSize: 13, color: '#666', marginVertical: 6 },
  why: { fontSize: 13, color: '#444', backgroundColor: '#F1F3F5', padding: 10, borderRadius: 8, marginTop: 6 },
  link: { color: RED, fontWeight: '600', marginTop: 8 },
  row: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700' },
  status: { marginTop: 10, fontWeight: '600', color: '#333' },
  feedback: { marginTop: 8, color: '#28a745', fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  chip: { borderWidth: 1, borderColor: RED, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipOn: { backgroundColor: RED },
  chipText: { color: RED, fontSize: 13 },
  choice: { borderWidth: 1, borderColor: '#ddd', borderRadius: 12, padding: 14, marginTop: 10 },
  choiceText: { fontSize: 16, color: '#333' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 80, marginVertical: 10 },
  barWrap: { alignItems: 'center', flex: 1 },
  bar: { width: 16, backgroundColor: RED, borderRadius: 4 },
  barLabel: { fontSize: 9, color: '#888', marginTop: 2 },
  setting: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 6 },
});
