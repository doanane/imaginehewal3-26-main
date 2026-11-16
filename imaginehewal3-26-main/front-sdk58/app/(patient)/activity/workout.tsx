import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import BrandLogo from '../../../components/BrandLogo';
import ProtectedRoute from '../../../components/ProtectedRoute';
import RouteMap from '../../../components/RouteMap';
import { Banner, Card, Chip, IconName, Screen, ScreenHeader, Section, T } from '../../../components/ui';
import { theme } from '../../../constants/theme';
import api, { WorkoutFull } from '../../../services/api';
import { fmtPace } from '../../../services/tracker';
import { Ionicons, Pressable, View } from '../../../components/themed';

const C = theme.COLORS;
const KIND: Record<string, { label: string; icon: IconName; noun: string }> = {
  run: { label: 'Run', icon: 'walk-outline', noun: 'run' }, walk: { label: 'Walk', icon: 'footsteps-outline', noun: 'walk' }, cycle: { label: 'Ride', icon: 'bicycle-outline', noun: 'ride' },
};
const ORANGE = '#D9701A';

/** "2 min 39 s", "1 h 05 min": easier to read than 02:39 */
const human = (s: number) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.round(s % 60);
  if (h > 0) return `${h} h ${String(m).padStart(2, '0')} min`;
  if (m > 0) return sec ? `${m} min ${sec} s` : `${m} min`;
  return `${sec} s`;
};
const km = (m: number) => (m / 1000).toFixed(m < 1000 ? 2 : 2);

type Tile = { icon: IconName; label: string; value: string; unit?: string; note?: string; color?: string };

function PaceBar({ pace, max, min, fastest, i, label }: { pace: number; max: number; min: number; fastest: boolean; i: number; label: string }) {
  const w = useSharedValue(0);
  const frac = max === min ? 0.8 : 0.45 + 0.55 * ((max - pace) / (max - min));
  useEffect(() => { w.value = withDelay(i * 90, withTiming(frac, { duration: 700, easing: Easing.out(Easing.cubic) })); }, [frac]);
  const st = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
      <T v="caption" color={C.textSecondary} style={{ width: 44 }}>{label}</T>
      <View style={{ flex: 1, height: 22, justifyContent: 'center' }}>
        <Animated.View style={[{ height: 22, borderRadius: 11, backgroundColor: fastest ? ORANGE : '#BFD9D6' }, st]} />
      </View>
      <T v="label" color={fastest ? ORANGE : C.textPrimary} style={{ width: 62, textAlign: 'right' }}>{fmtPace(pace)}</T>
    </View>
  );
}

function StatTile({ t }: { t: Tile }) {
  return (
    <View style={{ width: '48.5%', backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: C.borderLight, padding: 14 }}>
      <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
        <Ionicons name={t.icon} size={18} color={t.color || C.primary} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
        <T v="heading" style={{ fontSize: 22, lineHeight: 28 }}>{t.value}</T>{t.unit ? <T v="caption" color={C.textSecondary}> {t.unit}</T> : null}
      </View>
      <T v="caption" color={C.textSecondary}>{t.label}</T>
      {t.note ? <T v="caption" color={C.textTertiary}>{t.note}</T> : null}
    </View>
  );
}

export default function WorkoutDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [w, setW] = useState<WorkoutFull | null>(null);
  const [tab, setTab] = useState<'trajectory' | 'chart'>('trajectory');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { api.getWorkout(Number(id)).then(setW).catch((e) => setErr(e.message || 'Could not load this workout.')); }, [id]);

  const remove = () => Alert.alert('Delete this workout?', 'It will also be removed from your totals and leaderboard.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { try { await api.deleteWorkout(Number(id)); router.back(); } catch (e: any) { Alert.alert('Could not delete', e.message); } } },
  ]);

  const splits = w?.splits ?? [];
  const paces = splits.map((s) => s.pace_s);
  const fastestIdx = paces.length ? paces.indexOf(Math.min(...paces)) : -1;
  const date = w ? new Date(w.started_at).toLocaleString(undefined, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }) : '';
  const k = KIND[w?.kind || 'walk'] || KIND.walk;

  // ---- what we know, and where it came from
  const hasRoute = !!w?.route && w.route.length >= 2;
  const realDist = !!w && w.distance_m >= 20;
  const est = w?.estimate || null;
  const cycle = w?.kind === 'cycle';
  const distM = realDist ? w!.distance_m : est ? est.distance_m : null;
  const paceS = realDist ? w!.avg_pace_s_km : est ? est.avg_pace_s_km : null;

  const tiles: Tile[] = [];
  const missing: { icon: IconName; title: string; text: string }[] = [];
  if (w) {
    tiles.push({ icon: 'time-outline', label: 'Active time', value: human(w.duration_s) });
    if (cycle ? realDist : paceS) {
      tiles.push(cycle
        ? { icon: 'speedometer-outline', label: 'Average speed', value: ((w.distance_m / Math.max(1, w.duration_s)) * 3.6).toFixed(1), unit: 'km/h' }
        : { icon: 'speedometer-outline', label: 'Average pace', value: fmtPace(paceS), unit: '/km', note: realDist ? undefined : 'Estimated from steps' });
    }
    if (!cycle && realDist && w.fastest_pace_s_km) tiles.push({ icon: 'flash-outline', label: 'Fastest pace', value: fmtPace(w.fastest_pace_s_km), unit: '/km', color: ORANGE });
    tiles.push({ icon: 'flame-outline', label: 'Calories burned', value: String(w.calories), unit: 'kcal', note: 'Estimated from your weight and time' });
    if (w.steps) tiles.push({ icon: 'footsteps-outline', label: 'Steps', value: w.steps.toLocaleString() });
    if (w.cadence_spm) tiles.push({ icon: 'pulse-outline', label: 'Cadence', value: String(w.cadence_spm), unit: 'steps/min' });
    if (w.avg_hr) tiles.push({ icon: 'heart-outline', label: 'Average heart rate', value: String(w.avg_hr), unit: 'bpm', color: C.danger, note: w.max_hr ? `Highest ${w.max_hr} bpm` : undefined });

    if (!hasRoute) missing.push({ icon: 'location-outline', title: 'No GPS route', text: `This ${k.noun} was recorded without GPS, either as an indoor activity or because Location was off, so the distance is worked out from your steps. For an exact distance and a route map, allow Location and start outdoors.` });
    if (!w.avg_hr) missing.push({ icon: 'heart-outline', title: 'No heart rate', text: 'No heart rate was recorded during this activity. Wear a watch that shares with Apple Health and it will appear here next time.' });
    if (!w.steps && !cycle) missing.push({ icon: 'footsteps-outline', title: 'No step count', text: 'The phone did not report steps for this activity.' });
  }

  const heroValue = distM !== null ? km(distM) : w ? human(w.duration_s) : '';
  const heroLabel = distM !== null ? 'Distance (km)' : 'Time';

  return (
    <ProtectedRoute>
      <Screen header={<ScreenHeader title={w ? k.label : 'Activity'} subtitle={date} onBack={() => router.back()}
        right={<Pressable onPress={remove} accessibilityRole="button" accessibilityLabel="Delete workout" hitSlop={10}><Ionicons name="trash-outline" size={22} color={C.danger} /></Pressable>} />}
        contentStyle={{ paddingBottom: 48 }}>
        {err ? <Banner tone="danger" text={err} /> : null}
        {w ? (
          <>
            <Card tone="soft">
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <BrandLogo />
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 99, paddingHorizontal: 12, paddingVertical: 6 }}>
                  <Ionicons name={k.icon} size={16} color={C.primary} /><T v="label" color={C.primary}>{k.label}</T>
                </View>
              </View>
              <View style={{ alignItems: 'center', paddingVertical: 14 }}>
                <T v="caption" color={C.textSecondary}>{heroLabel}</T>
                <T v="title" style={{ fontSize: distM !== null ? 64 : 44, lineHeight: distM !== null ? 72 : 52 }}>{distM !== null && !realDist ? '~' : ''}{heroValue}</T>
                {distM !== null && !realDist ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <Ionicons name="information-circle-outline" size={16} color={C.textSecondary} />
                    <T v="caption" color={C.textSecondary}>Estimated from {w.steps} steps and your height</T>
                  </View>
                ) : null}
                {realDist && w.kind !== 'cycle' ? <T v="caption" color={C.textSecondary} style={{ marginTop: 4 }}>Measured by GPS</T> : null}
              </View>
            </Card>

            {w.flagged ? <View style={{ marginTop: 12 }}><Banner tone="warning" text={w.flag_note || 'This workout looked faster than a person can move, so it does not count towards the leaderboard.'} /></View> : null}

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginTop: 14 }}>
              {tiles.map((t) => <StatTile key={t.label} t={t} />)}
            </View>

            {hasRoute ? (
              <>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 20 }}>
                  <Chip label="Route" selected={tab === 'trajectory'} onPress={() => setTab('trajectory')} icon="map-outline" />
                  <Chip label="Pace per km" selected={tab === 'chart'} onPress={() => setTab('chart')} icon="bar-chart-outline" />
                </View>
                {tab === 'trajectory' ? (
                  <Section title="Your route">
                    <RouteMap route={w.route} height={300} placeholder="Drawing your route..." />
                    <T v="caption" color={C.textSecondary} style={{ marginTop: 8 }}>Green is your faster stretches, orange is slower. The green dot is the start and the red dot is the finish.</T>
                  </Section>
                ) : (
                  <Section title="Pace per kilometre">
                    {splits.length === 0 ? <Card><T v="caption" color={C.textSecondary}>Pace per kilometre appears once you have covered at least one kilometre.</T></Card> : (
                      <Card>
                        <View style={{ flexDirection: 'row', marginBottom: 14 }}>
                          <View style={{ flex: 1 }}><T v="caption" color={C.textSecondary}>Average pace</T><T v="heading">{fmtPace(w.avg_pace_s_km)}</T></View>
                          <View style={{ flex: 1 }}><T v="caption" color={C.textSecondary}>Fastest pace</T><T v="heading" color={ORANGE}>{fmtPace(w.fastest_pace_s_km)}</T></View>
                        </View>
                        {splits.map((s, i) => (
                          <PaceBar key={i} i={i} pace={s.pace_s} max={Math.max(...paces)} min={Math.min(...paces)} fastest={i === fastestIdx && splits.length > 1}
                            label={s.partial ? `${((s.distance_m ?? 0) / 1000).toFixed(2)}` : String(s.km)} />
                        ))}
                        <T v="caption" color={C.textTertiary}>Longer bar means faster. The fastest kilometre is orange.</T>
                      </Card>
                    )}
                  </Section>
                )}
              </>
            ) : null}

            {missing.length > 0 ? (
              <Section title="Not recorded this time">
                <Card>
                  {missing.map((m, i) => (
                    <View key={m.title} style={{ flexDirection: 'row', gap: 12, paddingTop: i ? 14 : 0 }}>
                      <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={m.icon} size={18} color={C.textSecondary} /></View>
                      <View style={{ flex: 1 }}><T v="bodyStrong">{m.title}</T><T v="caption" color={C.textSecondary}>{m.text}</T></View>
                    </View>
                  ))}
                </Card>
              </Section>
            ) : null}
          </>
        ) : !err ? <T v="body" color={C.textSecondary}>Loading...</T> : null}
      </Screen>
    </ProtectedRoute>
  );
}
