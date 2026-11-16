import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import ProtectedRoute from '../../../components/ProtectedRoute';
import RouteMap from '../../../components/RouteMap';
import BrandLogo from '../../../components/BrandLogo';
import { Banner, Button, IconName, Screen, ScreenHeader, T } from '../../../components/ui';
import { theme } from '../../../constants/theme';
import api, { WorkoutKind } from '../../../services/api';
import { ActivityTracker, TrackerState, fmtClock, fmtPace } from '../../../services/tracker';
import { Ionicons, Pressable, StatusBar, Switch, View } from '../../../components/themed';

const C = theme.COLORS;
const keep = (on: boolean) => { try { const k = require('expo-keep-awake'); if (on) k.activateKeepAwakeAsync().catch(() => {}); else k.deactivateKeepAwake(); } catch { /* module missing: the screen may dim */ } };
const KINDS: { k: WorkoutKind; label: string; icon: IconName }[] = [
  { k: 'run', label: 'Run', icon: 'walk-outline' }, { k: 'walk', label: 'Walk', icon: 'footsteps-outline' }, { k: 'cycle', label: 'Ride', icon: 'bicycle-outline' },
];

function Metric({ label, value, unit, big }: { label: string; value: string; unit?: string; big?: boolean }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
        <T v="title" style={{ fontSize: big ? 44 : 26, lineHeight: big ? 52 : 32 }}>{value}</T>{unit ? <T v="caption" color={C.textSecondary}> {unit}</T> : null}
      </View>
      <T v="caption" color={C.textSecondary}>{label}</T>
    </View>
  );
}

export default function LiveActivity() {
  const router = useRouter();
  const tracker = useRef(new ActivityTracker()).current;
  const [kind, setKind] = useState<WorkoutKind>('run');
  const [voice, setVoice] = useState(true);
  const [indoor, setIndoor] = useState(false);
  const [phase, setPhase] = useState<'setup' | 'countdown' | 'active' | 'saving'>('setup');
  const [count, setCount] = useState(3);
  const [st, setSt] = useState<TrackerState>(tracker.state());
  const [weight, setWeight] = useState(70);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => tracker.subscribe(setSt), [tracker]);
  useEffect(() => { api.getWeightReport('weekly').then((r) => { if (r.stats.latest_kg) setWeight(r.stats.latest_kg); }).catch(() => {}); }, []);
  useEffect(() => () => { tracker.discard(); keep(false); }, [tracker]);

  useEffect(() => {
    if (phase !== 'countdown') return;
    if (count === 0) {
      keep(true);
      tracker.start(kind, { voice, weightKg: weight, indoor }).then(() => setPhase('active')).catch((e) => { setError(e.message); setPhase('setup'); });
      return;
    }
    const t = setTimeout(() => setCount((c) => c - 1), 900);
    return () => clearTimeout(t);
  }, [phase, count, kind, voice, weight, indoor, tracker]);

  const leave = () => {
    if (phase === 'active') {
      Alert.alert('Stop this activity?', 'Your progress will be lost unless you finish and save it.', [
        { text: 'Keep going', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: () => { tracker.discard(); router.back(); } },
      ]);
    } else router.back();
  };

  const finish = async () => {
    setPhase('saving');
    const r = await tracker.finish();
    keep(false);
    if (r.duration_s < 20) { Alert.alert('Too short', 'Activities under 20 seconds are not saved.'); tracker.discard(); router.back(); return; }
    try {
      const w = await api.createWorkout({ kind, started_at: r.startedAt.toISOString(), duration_s: r.duration_s, distance_m: r.distance_m, steps: r.steps, route: r.route.length >= 2 ? r.route : undefined });
      const badges = (w as any).new_achievements as string[] | undefined;
      if (badges?.length) Alert.alert('New badge', badges.join(', '));
      router.replace({ pathname: '/(patient)/activity/workout' as any, params: { id: String(w.id) } });
    } catch (e: any) {
      setError(e.message || 'Could not save this activity.');
      setPhase('active');
    }
  };

  const meta = KINDS.find((x) => x.k === kind)!;
  const showSpeed = kind === 'cycle';
  const distKm = (st.distance_m / 1000).toFixed(2);
  const cur = useMemo(() => (showSpeed ? `${(st.speed_ms * 3.6).toFixed(1)}` : st.pace_s_km ? fmtPace(st.pace_s_km) : 'Get moving'), [showSpeed, st.speed_ms, st.pace_s_km]);
  const noGps = indoor || (st.gps === 'denied');                                            // no distance can be measured: lead with steps instead of a blank
  const cadence = st.steps > 0 && st.elapsed_s >= 30 ? String(Math.round(st.steps / (st.elapsed_s / 60))) : 'Counting';
  const avgSpeed = st.elapsed_s > 5 && st.distance_m > 0 ? ((st.distance_m / st.elapsed_s) * 3.6).toFixed(1) : '0.0';

  return (
    <ProtectedRoute>
      <StatusBar barStyle="dark-content" />
      <Screen header={<ScreenHeader title={phase === 'setup' ? 'Start an activity' : meta.label} onBack={leave} />} contentStyle={{ paddingBottom: 40 }}>
        {error ? <Banner tone="danger" text={error} /> : null}

        {phase === 'setup' ? (
          <View style={{ gap: 18 }}>
            <View style={{ alignItems: 'center' }}><BrandLogo width={96} height={40} /></View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              {KINDS.map((x) => {
                const on = x.k === kind;
                return (
                  <Pressable key={x.k} onPress={() => setKind(x.k)} accessibilityRole="button" accessibilityState={{ selected: on }} accessibilityLabel={x.label}
                    style={{ flex: 1, alignItems: 'center', paddingVertical: 18, borderRadius: 18, borderWidth: 2, borderColor: on ? C.primary : C.borderLight, backgroundColor: on ? C.primarySoft : '#fff' }}>
                    <Ionicons name={x.icon} size={30} color={on ? C.primary : C.textSecondary} /><T v="bodyStrong" color={on ? C.primary : C.textPrimary} style={{ marginTop: 6 }}>{x.label}</T>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: C.borderLight, padding: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 }}>
                <Ionicons name="volume-high-outline" size={22} color={C.primary} />
                <View style={{ flex: 1 }}><T v="bodyStrong">Voice reminders</T><T v="caption" color={C.textSecondary}>Hear your pace at every kilometre</T></View>
                <Switch value={voice} onValueChange={setVoice} trackColor={{ true: C.primary }} accessibilityLabel="Voice reminders" />
              </View>
              <View style={{ height: 1, backgroundColor: C.borderLight, marginHorizontal: 12 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', padding: 12, gap: 12 }}>
                <Ionicons name="home-outline" size={22} color={C.primary} />
                <View style={{ flex: 1 }}><T v="bodyStrong">Indoors (no GPS)</T><T v="caption" color={C.textSecondary}>Treadmill or gym. Time and steps only.</T></View>
                <Switch value={indoor} onValueChange={setIndoor} trackColor={{ true: C.primary }} accessibilityLabel="Indoor mode" />
              </View>
            </View>
            <T v="caption" color={C.textSecondary}>Keep the app open while you move. Location is used only during the activity and the route is saved to your account.</T>
            <Button title={`Start ${meta.label.toLowerCase()}`} icon="play" onPress={() => { setError(null); setCount(3); setPhase('countdown'); }} />
          </View>
        ) : null}

        {phase === 'countdown' ? (
          <View style={{ alignItems: 'center', justifyContent: 'center', height: 380 }}>
            <T v="title" style={{ fontSize: 120, lineHeight: 130 }} color={C.primary}>{count > 0 ? count : 'Go'}</T>
            <T v="body" color={C.textSecondary}>Get ready</T>
          </View>
        ) : null}

        {phase === 'active' || phase === 'saving' ? (
          <View style={{ gap: 16 }}>
            <View style={{ alignItems: 'center', paddingTop: 4 }}>
              <T v="caption" color={C.textSecondary}>{noGps ? 'Steps' : 'Distance (km)'}</T>
              <T v="title" style={{ fontSize: 76, lineHeight: 84 }}>{noGps ? String(st.steps) : distKm}</T>
            </View>
            <View style={{ flexDirection: 'row' }}>
              <Metric label="Time" value={fmtClock(st.elapsed_s)} />
              {noGps ? <Metric label="Calories" value={String(st.calories)} unit="kcal" /> : <Metric label={showSpeed ? 'Speed (km/h)' : 'Pace (/km)'} value={cur} />}
              {noGps ? <Metric label="Cadence" value={cadence} unit={cadence === 'Counting' ? undefined : 'spm'} /> : <Metric label="Avg pace" value={showSpeed ? `${avgSpeed}` : fmtPace(st.avg_pace_s_km)} unit={showSpeed ? 'km/h' : undefined} />}
            </View>
            {noGps ? null : (
              <View style={{ flexDirection: 'row' }}>
                <Metric label="Calories" value={String(st.calories)} unit="kcal" />
                <Metric label="Steps" value={String(st.steps)} />
                {showSpeed ? <Metric label="Distance" value={distKm} unit="km" /> : <Metric label={st.lastKm ? 'Last km' : 'Cadence'} value={st.lastKm ? fmtPace(st.lastKm.pace_s) : cadence} />}
              </View>
            )}
            {!indoor ? <RouteMap route={st.route} height={220} placeholder={st.gps === 'denied' ? 'Location is off' : 'Searching for GPS. Step outside for a clear sky.'} /> : null}
            {st.gps === 'denied' ? <Banner tone="warning" text="Location permission is off, so distance and route cannot be recorded. Time is still tracked. Allow Location in Settings, or choose indoor mode next time." /> : null}
            {st.status === 'paused' ? <Banner tone="info" text="Paused. Press play to continue." /> : null}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Button title={st.status === 'paused' ? 'Resume' : 'Pause'} icon={st.status === 'paused' ? 'play' : 'pause'} variant="secondary" style={{ flex: 1 }}
                onPress={() => (st.status === 'paused' ? tracker.resume() : tracker.pause())} disabled={phase === 'saving'} />
              <Button title="Finish" icon="stop" style={{ flex: 1 }} loading={phase === 'saving'} onPress={finish} />
            </View>
          </View>
        ) : null}
      </Screen>
    </ProtectedRoute>
  );
}
