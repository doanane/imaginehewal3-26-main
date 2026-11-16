import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import ActivityRings, { RING_COLORS } from '../../../components/ActivityRings';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { Badge, Banner, Button, Card, IconName, ListRow, Screen, ScreenHeader, Section, T } from '../../../components/ui';
import { PressScale, Reveal } from '../../../components/ui/motion';
import { theme } from '../../../constants/theme';
import api, { ActivitySummary, WorkoutBrief } from '../../../services/api';
import { REASON_TEXT, syncStepsNow } from '../../../services/stepSync';
import { fmtClock, fmtPace } from '../../../services/tracker';
import { Ionicons, LinearGradient, Pressable, RefreshControl, View } from '../../../components/themed';

const C = theme.COLORS;
const KIND: Record<string, { label: string; icon: IconName }> = { run: { label: 'Run', icon: 'walk-outline' }, walk: { label: 'Walk', icon: 'footsteps-outline' }, cycle: { label: 'Ride', icon: 'bicycle-outline' } };
const km = (m: number) => (m / 1000).toFixed(2);
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

function Legend({ color, label, value, goal, unit }: { color: string; label: string; value: number; goal: number; unit: string }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: color }} /><T v="label" color={C.textSecondary}>{label}</T></View>
      <T v="title" style={{ fontSize: 20, lineHeight: 26 }}>{Math.round(value).toLocaleString()}<T v="caption" color={C.textSecondary}> / {goal.toLocaleString()} {unit}</T></T>
    </View>
  );
}

function Stepper({ label, value, step, min, max, unit, onChange }: { label: string; value: number; step: number; min: number; max: number; unit: string; onChange: (v: number) => void }) {
  const Btn = ({ icon, d }: { icon: IconName; d: number }) => (
    <Pressable onPress={() => onChange(Math.max(min, Math.min(max, value + d)))} accessibilityRole="button" accessibilityLabel={`${d > 0 ? 'Increase' : 'Decrease'} ${label}`}
      style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={22} color={C.primary} /></Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
      <T v="body">{label}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><Btn icon="remove" d={-step} /><T v="bodyStrong" style={{ minWidth: 86, textAlign: 'center' }}>{value.toLocaleString()} {unit}</T><Btn icon="add" d={step} /></View>
    </View>
  );
}

export default function ActivityHub() {
  const router = useRouter();
  const [s, setS] = useState<ActivitySummary | null>(null);
  const [workouts, setWorkouts] = useState<WorkoutBrief[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [goals, setGoals] = useState({ steps: 8000, calories: 400, active_minutes: 30 });

  const load = useCallback(async () => {
    const sync = await syncStepsNow();                                  // real phone steps first, so the rings are current
    setNote(sync.steps == null && sync.reason ? REASON_TEXT[sync.reason] ?? null : null);
    const [a, w, g] = await Promise.allSettled([api.getActivitySummary(), api.listWorkouts(5), api.getActivityGoals()]);
    if (a.status === 'fulfilled') setS(a.value);
    if (w.status === 'fulfilled') setWorkouts(w.value);
    if (g.status === 'fulfilled') setGoals({ steps: g.value.steps, calories: g.value.calories, active_minutes: g.value.active_minutes });
    setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveGoals = async () => { try { await api.setActivityGoals(goals); setEditing(false); load(); } catch (e: any) { Alert.alert('Could not save', e.message); } };
  const r = s?.rings;

  return (
    <ProtectedRoute>
      <Screen header={<ScreenHeader title="Activity" subtitle="Steps, workouts, weight and sleep" onBack={() => router.back()} />}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.primary} onRefresh={() => { setRefreshing(true); api.invalidateApiCache(); load(); }} />} contentStyle={{ paddingBottom: 48 }}>
        <Reveal index={0}>
          <Card style={{ paddingVertical: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <ActivityRings size={150} steps={r?.steps ?? { value: 0, goal: goals.steps }} calories={r?.calories ?? { value: 0, goal: goals.calories }} minutes={r?.minutes ?? { value: 0, goal: goals.active_minutes }}>
                <Ionicons name="flame" size={26} color={C.primary} />
              </ActivityRings>
              <View style={{ flex: 1 }}>
                <Legend color={RING_COLORS.steps} label="Steps" value={r?.steps.value ?? 0} goal={goals.steps} unit="steps" />
                <Legend color={RING_COLORS.calories} label="Active calories" value={r?.calories.value ?? 0} goal={goals.calories} unit="kcal" />
                <Legend color={RING_COLORS.minutes} label="Active minutes" value={r?.minutes.value ?? 0} goal={goals.active_minutes} unit="min" />
              </View>
            </View>
            {s?.streak_days ? <View style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name="flame" size={18} color="#D9701A" /><T v="label">{s.streak_days}-day streak</T></View> : null}
            {note ? <View style={{ marginTop: 12 }}><Banner tone="info" text={note} /></View> : null}
            <T v="label" color={C.primary} onPress={() => setEditing((e) => !e)} accessibilityRole="button" style={{ marginTop: 10, paddingVertical: 6 }}>{editing ? 'Close goals' : 'Edit my goals'}</T>
            {editing ? (
              <View style={{ marginTop: 4 }}>
                <Stepper label="Steps" value={goals.steps} step={500} min={1000} max={60000} unit="" onChange={(v) => setGoals((g) => ({ ...g, steps: v }))} />
                <Stepper label="Active calories" value={goals.calories} step={50} min={50} max={3000} unit="kcal" onChange={(v) => setGoals((g) => ({ ...g, calories: v }))} />
                <Stepper label="Active minutes" value={goals.active_minutes} step={5} min={5} max={300} unit="min" onChange={(v) => setGoals((g) => ({ ...g, active_minutes: v }))} />
                <Button title="Save goals" onPress={saveGoals} style={{ marginTop: 10 }} />
              </View>
            ) : null}
          </Card>
        </Reveal>

        <Reveal index={1} style={{ marginTop: 16 }}>
          <PressScale label="Start an activity" onPress={() => router.push('/(patient)/activity/live' as any)}>
            <LinearGradient colors={['#D9701A', '#E8913A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}><Ionicons name="play" size={26} color="#fff" /></View>
              <View style={{ flex: 1 }}><T v="heading" color="#fff">Start an activity</T><T v="caption" color="rgba(255,255,255,0.92)">Run, walk or ride with live pace, route and voice reminders</T></View>
              <Ionicons name="chevron-forward" size={22} color="#fff" />
            </LinearGradient>
          </PressScale>
        </Reveal>

        <Reveal index={2}>
          <Section title="Your numbers">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
              {[
                { key: 'weight', icon: 'barbell-outline' as IconName, title: 'Weight', value: s?.weight ? `${s.weight.kg}` : '--', unit: 'kg', hint: s?.weight?.target_kg ? `Goal ${s.weight.target_kg} kg` : 'Add yours', go: '/(patient)/activity/weight', color: '#5B4BB7' },
                { key: 'sleep', icon: 'moon-outline' as IconName, title: 'Sleep', value: s?.sleep ? `${Math.floor(s.sleep.total_min / 60)}h ${s.sleep.total_min % 60}m` : '--', unit: '', hint: s?.sleep?.score != null ? `Score ${s.sleep.score}` : 'Log last night', go: '/(patient)/activity/sleep', color: '#1D4ED8' },
                { key: 'hr', icon: 'heart-outline' as IconName, title: 'Heart rate', value: s?.heart_rate ? `${s.heart_rate.bpm}` : '--', unit: 'bpm', hint: s?.heart_rate ? 'Latest reading' : 'Connect a watch', go: '/(patient)/(tabs)/insights', color: C.danger },
                { key: 'know', icon: 'book-outline' as IconName, title: 'Health knowledge', value: 'Learn', unit: '', hint: 'Simple, trusted guidance', go: '/(patient)/activity/knowledge', color: '#17724A' },
              ].map((c) => (
                <PressScale key={c.key} label={c.title} onPress={() => router.push(c.go as any)} containerStyle={{ width: '47.5%' }}
                  style={{ backgroundColor: '#fff', borderRadius: 18, padding: 14, borderWidth: 1, borderColor: C.borderLight, minHeight: 118 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Ionicons name={c.icon} size={20} color={c.color} /><T v="label" color={C.textSecondary}>{c.title}</T></View>
                  <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 10 }}><T v="title" style={{ fontSize: 24, lineHeight: 30 }}>{c.value}</T>{c.unit ? <T v="caption" color={C.textSecondary}> {c.unit}</T> : null}</View>
                  <T v="caption" color={C.textTertiary} style={{ marginTop: 4 }}>{c.hint}</T>
                </PressScale>
              ))}
            </View>
          </Section>
        </Reveal>

        <Reveal index={3}>
          <Section title="Recent workouts">
            {workouts.length === 0 ? (
              <Card><T v="caption" color={C.textSecondary}>No workouts yet. Start one above and it will appear here with its route and pace.</T></Card>
            ) : (
              <Card style={{ paddingVertical: 4 }}>
                {workouts.map((w) => (
                  <ListRow key={w.id} icon={KIND[w.kind].icon} title={`${KIND[w.kind].label} · ${km(w.distance_m)} km`}
                    subtitle={`${day(w.started_at)} · ${fmtClock(w.duration_s)}${w.kind !== 'cycle' && w.avg_pace_s_km ? ` · ${fmtPace(w.avg_pace_s_km)}/km` : w.distance_m < 20 && w.steps ? ` · ${w.steps} steps` : w.distance_m >= 20 ? ` · ${(w.distance_m / 1000).toFixed(2)} km` : ''}`}
                    right={w.flagged ? <Badge label="Not counted" tone="warning" /> : <Badge label={`${w.calories} kcal`} tone="neutral" />}
                    onPress={() => router.push({ pathname: '/(patient)/activity/workout' as any, params: { id: String(w.id) } })} />
                ))}
              </Card>
            )}
          </Section>
        </Reveal>

        <Reveal index={4}>
          <Section title="Compete">
            <Card><ListRow icon="trophy-outline" title="Leaderboard" subtitle="See how you rank. Join in if you like." onPress={() => router.push('/(patient)/leaderboard' as any)} /></Card>
          </Section>
        </Reveal>
        <T v="caption" color={C.textTertiary} style={{ marginTop: 16 }}>{s?.estimates_note}</T>
      </Screen>
    </ProtectedRoute>
  );
}
