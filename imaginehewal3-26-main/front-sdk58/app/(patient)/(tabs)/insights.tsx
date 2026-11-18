import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import DonutChart from '../../../components/charts/DonutChart';
import Gauge from '../../../components/charts/Gauge';
import Heatmap from '../../../components/charts/Heatmap';
import LineChart, { Point } from '../../../components/charts/LineChart';
import LearningCard from '../../../components/LearningCard';
import RiskCard from '../../../components/RiskCard';
import SummaryShare from '../../../components/SummaryShare';
import { Badge, Banner, Button, Card, EmptyState, IconButton, IconName, ListRow, ProgressBar, Screen, Section, Skeleton, T, ThemeToggle } from '../../../components/ui';
import { PressScale, Pulse, Reveal } from '../../../components/ui/motion';
import { theme } from '../../../constants/theme';
import ActivityRings, { RING_COLORS } from '../../../components/ActivityRings';
import api, { ActivitySummary, AiInsights, DashboardData, HeatDayData, LiveVitals, MealsToday, Recommendation, RiskSummary } from '../../../services/api';
import { getHealthKitConnection, HealthKitHistory, readHealthKitHistory } from '../../../services/healthkit';
import { useHealthSync } from '../../../services/healthSync';
import { SourcesCard } from '../../../components/health/SourcesCard';
import { Fold } from '../../../components/health/Fold';
import { HeartCard } from '../../../components/health/HeartCard';
import { HealthOverview } from '../../../components/health/HealthOverview';
import { GlassBackdrop } from '../../../components/ui/Glass';
import { WeekReview } from '../../../components/health/WeekReview';
import { useHealthInsights } from '../../../services/healthInsights';
import { fmtKg, weekRows } from '../../../services/healthMath';
import { Status, VitalTile, tileStyles } from '../../../components/health/VitalTile';
import { ago } from '../../../components/CareParts';
import { flushVitalQueue, queueVital } from '../../../services/offlineVitals';
import { realtime } from '../../../services/realtime';
import { Ionicons, Pressable, RefreshControl, View } from '../../../components/themed';

const C = theme.COLORS;
type Period = 'live' | '24h' | '7d';
const PERIODS: { key: Period; label: string }[] = [{ key: 'live', label: 'Live' }, { key: '24h', label: '24 hours' }, { key: '7d', label: '7 days' }];

function hrZone(hr: number): { label: string; tone: 'success' | 'warning' | 'danger' } {
  if (hr < 50) return { label: 'Low', tone: 'warning' };
  if (hr <= 100) return { label: 'Normal resting range', tone: 'success' };
  if (hr <= 120) return { label: 'Elevated', tone: 'warning' };
  return { label: 'High', tone: 'danger' };
}

function Segmented<K extends string>({ options, value, onChange }: { options: { key: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: C.background, borderRadius: 12, padding: 3, marginVertical: 14 }} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} accessibilityRole="tab" accessibilityState={{ selected: on }}
            style={{ flex: 1, minHeight: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: on ? C.card : 'transparent',
              shadowColor: '#10202F', shadowOpacity: on ? 0.1 : 0, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: on ? 2 : 0 }}>
            <T v="label" color={on ? C.textPrimary : C.textSecondary}>{o.label}</T>
          </Pressable>
        );
      })}
    </View>
  );
}

function Chip({ icon, value, label, tone = C.primary, pulse }: { icon: IconName; value: string; label: string; tone?: string; pulse?: boolean }) {
  return (
    <View style={{ flex: 1, minWidth: 74, alignItems: 'center', backgroundColor: C.background, borderRadius: 14, paddingVertical: 10, paddingHorizontal: 6 }}>
      <Pulse active={!!pulse}><Ionicons name={icon} size={20} color={tone} /></Pulse>
      <T v="bodyStrong" style={{ marginTop: 4 }}>{value}</T>
      <T v="caption" color={C.textSecondary} style={{ fontSize: 12, lineHeight: 16 }}>{label}</T>
    </View>
  );
}

function MiniStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ flex: 1, minWidth: 96, backgroundColor: C.background, borderRadius: 14, padding: 12 }}>
      <T v="title">{value}</T>
      <T v="caption" color={C.textSecondary}>{label}</T>
    </View>
  );
}

const MACRO = { carbs: '#D9701A', protein: '#0B6E6E', fat: '#5B4BB7' };

export default function Insights() {
  const router = useRouter();
  const [live, setLive] = useState<LiveVitals | null>(null);
  const [outcomes, setOutcomes] = useState<any[]>([]);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [risk, setRisk] = useState<RiskSummary | null>(null);
  const [riskFailed, setRiskFailed] = useState(false);
  const [act, setAct] = useState<ActivitySummary | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [meals, setMeals] = useState<MealsToday | null>(null);
  const [heat, setHeat] = useState<HeatDayData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const sync = useHealthSync();                       // one shared Apple Health state for Home, Health and Devices
  const healthKitSnapshot = sync.snapshot;
  const insights = useHealthInsights(!!sync.connection?.connected, sync.uploads);   // this screen's own Apple Health data: windowed reads, never the whole history

  const [ai, setAi] = useState<AiInsights | null>(null);
  const loadAi = useCallback((refresh = false) => { api.getAiInsights(refresh).then(setAi).catch(() => {}); }, []);

  const load = useCallback(async () => {
    loadAi();
    const dashboard = await api.getHealthDashboard().catch(() => null);
    if (dashboard) setDash(dashboard);
    setLoading(false);
    setRefreshing(false);

    void Promise.allSettled([api.getLiveVitals(15), api.getBehaviorOutcomes(), api.getRiskSummary(), api.getRiskRecommendations(), api.getMealsToday(), api.getBehaviorHeatmap(8), api.getActivitySummary()])
      .then(([l, o, r, c, m, h, a]) => {
        if (a.status === 'fulfilled') setAct(a.value);
        if (l.status === 'fulfilled') setLive(l.value);
        if (o.status === 'fulfilled') setOutcomes(o.value);
        if (r.status === 'fulfilled') { setRisk(r.value); setRiskFailed(false); } else setRiskFailed(true);
        if (c.status === 'fulfilled') setRecs(c.value.items);
        if (m.status === 'fulfilled') setMeals(m.value);
        if (h.status === 'fulfilled') setHeat(h.value.days);
      });
  }, []);

  useFocusEffect(useCallback(() => { load(); void sync.syncNow(); }, [load]));   // eslint-disable-line react-hooks/exhaustive-deps
  // Every time new figures are sent to the backend, read the rings and vitals again so the screen matches what was just synced.
  useEffect(() => {
    if (sync.uploads === 0) return;
    api.getActivitySummary().then(setAct).catch(() => {});
    api.getLiveVitals(15).then(setLive).catch(() => {});
    api.getHealthDashboard().then(setDash).catch(() => {});
  }, [sync.uploads]);
  // realtime pushes, plus a slow poll as a safety net when the socket is down
  useEffect(() => realtime.on('vitals.update', (e) => setLive((p) => ({
    is_live: true, age_seconds: 0,
    latest: { heart_rate: e.heart_rate ?? p?.latest?.heart_rate ?? null, blood_oxygen: e.blood_oxygen ?? p?.latest?.blood_oxygen ?? null, timestamp: e.timestamp },
    history: e.heart_rate ? [...(p?.history ?? []), { t: e.timestamp, hr: e.heart_rate, spo2: e.blood_oxygen ?? null }].slice(-120) : p?.history ?? [],
  }))), []);
  useEffect(() => { const id = setInterval(() => { if (!realtime.connected) api.getLiveVitals(15).then(setLive).catch(() => {}); }, 15000); return () => clearInterval(id); }, []);

  type Reading = { v: number; at: string; src: string | null } | null;
  const recent = (iso?: string | null) => !!iso && Date.now() - Date.parse(iso) < 24 * 3600e3;
  const newest = (x: Reading, y: Reading): Reading => (x && y ? (Date.parse(x.at) >= Date.parse(y.at) ? x : y) : x || y);
  const kit = (v: number | null | undefined, at: string | null | undefined, src: string | null | undefined): Reading => (v != null && recent(at) ? { v, at: at as string, src: src || 'Apple Health' } : null);
  const back = (v: number | null | undefined, at: string | null | undefined): Reading => (v != null && recent(at) ? { v, at: at as string, src: 'synced to HEWAL3' } : null);
  const lat: any = live?.latest ?? null;
  const hrR = newest(kit(healthKitSnapshot?.heartRate, healthKitSnapshot?.heartRateAt, healthKitSnapshot?.heartRateSource), back(lat?.heart_rate, lat?.timestamp));
  const spo2R = newest(kit(healthKitSnapshot?.oxygenSaturation, healthKitSnapshot?.oxygenSaturationAt, healthKitSnapshot?.oxygenSource), back(lat?.blood_oxygen, lat?.timestamp));
  const sysR = newest(kit(healthKitSnapshot?.bloodPressure.systolic, healthKitSnapshot?.bloodPressureAt, healthKitSnapshot?.bloodPressureSource), back(lat?.blood_pressure_systolic, lat?.timestamp));
  const diaR = newest(kit(healthKitSnapshot?.bloodPressure.diastolic, healthKitSnapshot?.bloodPressureAt, healthKitSnapshot?.bloodPressureSource), back(lat?.blood_pressure_diastolic, lat?.timestamp));
  const hr = hrR?.v ?? null, spo2 = spo2R?.v ?? null, sys = sysR?.v ?? null, dia = diaR?.v ?? null;
  const hint = (r: Reading, none: string) => (r ? `${ago(r.at)}${r.src ? ` · ${r.src}` : ''}` : none);
  const steps = act?.rings.steps.value ?? healthKitSnapshot?.steps ?? (dash?.categories?.find((c) => c.title.toLowerCase().includes('step'))?.value ?? null);
  const NONE: Status = { label: 'No recent reading', tone: 'none' };
  const hrState = (v: number): Status => (v < 50 ? { label: 'Low', tone: 'watch' } : v <= 100 ? { label: 'Normal', tone: 'good' } : v <= 120 ? { label: 'Elevated', tone: 'watch' } : { label: 'High', tone: 'bad' });
  const o2State = (v: number): Status => (v >= 95 ? { label: 'Normal', tone: 'good' } : v >= 90 ? { label: 'A little low', tone: 'watch' } : { label: 'Low', tone: 'bad' });
  const bpState = (sy: number, di: number): Status => (sy >= 180 || di >= 120 ? { label: 'Dangerously high', tone: 'bad' } : sy >= 140 || di >= 90 ? { label: 'High', tone: 'bad' }
    : sy >= 130 || di >= 80 ? { label: 'Raised', tone: 'watch' } : { label: 'Normal', tone: 'good' });
  const stepGoal = act?.rings.steps?.goal || 8000;
  const stepNum = steps != null ? Number(String(steps).replace(/,/g, '')) : null;

  const kc = meals?.macros.kcal_from;
  const macroSlices = kc ? [
    { key: 'carbs', label: 'Carbs', value: kc.carbs, color: MACRO.carbs, detail: `${meals!.macros.carbs_g} g of carbohydrate. Rice, banku, fufu, yam and bread are mostly carbohydrate.` },
    { key: 'protein', label: 'Protein', value: kc.protein, color: MACRO.protein, detail: `${meals!.macros.protein_g} g of protein. Fish, eggs, beans and meat help you feel full and keep muscle.` },
    { key: 'fat', label: 'Fat', value: kc.fat, color: MACRO.fat, detail: `${meals!.macros.fat_g} g of fat. Oil, palm oil, groundnuts and fried foods add fat.` },
  ] : [];
  const macroTotal = macroSlices.reduce((a, b) => a + b.value, 0);
  const macroHint = macroTotal > 0
    ? (kc!.carbs / macroTotal > 0.62 ? 'Mostly starch today. A little more protein or vegetables would balance it.'
      : kc!.protein / macroTotal < 0.12 ? 'Low in protein today. Fish, eggs or beans would help.'
      : kc!.fat / macroTotal > 0.38 ? 'On the oily side today. Lighter cooking will help.' : 'A well-balanced day so far.') : null;

  const first = outcomes[0]?.outcomes;

  // ---- tiles built from real data. A reading older than a day is still shown, labelled with how old it is; a signal with no data at all is left out.
  const ih = insights.data;
  const DAY = 24 * 3600e3;
  const ageOf = (t: number) => ago(new Date(t).toISOString());
  const liveHrFresh = lat?.heart_rate != null && !!lat?.timestamp && Date.now() - Date.parse(lat.timestamp) < 15 * 60e3;
  const hrShown = liveHrFresh ? { v: Number(lat.heart_rate), t: Date.parse(lat.timestamp) } : ih?.heart.latest ?? null;
  const hrIsFresh = !!hrShown && Date.now() - hrShown.t < DAY;
  const stepsToday = ih?.steps.today ?? stepNum;
  const sleepMin = ih?.sleep.last ? Math.round(ih.sleep.last.hours * 60) : act?.sleep?.total_min ?? null;
  const weightShown = ih?.weight ? { kg: ih.weight.latest.v, change: ih.weight.change, span: ih.weight.spanDays } : act?.weight ? { kg: act.weight.kg, change: null, span: null } : null;
  const oxyShown = ih?.oxygen ? { v: ih.oxygen.v, t: ih.oxygen.t } : spo2 != null ? { v: spo2, t: Date.now() } : null;
  const bpShown = ih?.bp ? { sy: ih.bp.sys, di: ih.bp.dia, t: ih.bp.t } : sys && dia ? { sy: Math.round(sys), di: Math.round(dia), t: Date.now() } : null;
  const openVital = (k: string) => router.push({ pathname: '/(patient)/health/vital' as any, params: { k } });          // the full chart for that vital, like Apple Health
  const tiles: ((i: number, wide: boolean) => React.ReactNode)[] = [];
  const add = (make: (i: number, wide: boolean) => React.ReactNode) => { tiles.push(make); };
  if (hrShown) add((i, wide) => <VitalTile wide={wide} key="hr" index={i} icon="heart" tone={C.danger} title="Heart rate" value={String(Math.round(hrShown.v))} unit="bpm" pulse={liveHrFresh}
    status={hrIsFresh ? hrState(hrShown.v) : { label: `Last ${ageOf(hrShown.t)}`, tone: 'none' }}
    hint={ih?.heart.today ? `Today ${ih.heart.today.min} to ${ih.heart.today.max} bpm` : 'From Apple Health'} onPress={() => openVital('hr')} />);
  if (ih?.heart.restingLatest) add((i, wide) => <VitalTile wide={wide} key="rest" index={i} icon="pulse" tone="#E0527A" title="Resting heart rate" value={String(Math.round(ih.heart.restingLatest!.v))} unit="bpm"
    status={{ label: ageOf(ih.heart.restingLatest!.t), tone: 'none' }} hint="From your watch" onPress={() => openVital('resting')} />);
  if (stepsToday != null) add((i, wide) => <VitalTile wide={wide} key="steps" index={i} icon="walk" tone={C.success} title="Steps today" value={Math.round(stepsToday).toLocaleString()}
    status={{ label: `${Math.min(100, Math.round((stepsToday / stepGoal) * 100))}% of goal`, tone: stepsToday >= stepGoal ? 'good' : 'watch' }} progress={stepsToday / stepGoal}
    hint={`Goal ${stepGoal.toLocaleString()}`} onPress={() => openVital('steps')} />);
  if (sleepMin) add((i, wide) => <VitalTile wide={wide} key="sleep" index={i} icon="moon" tone="#5B6FD6" title="Sleep" value={`${Math.floor(sleepMin / 60)}h ${sleepMin % 60}m`}
    status={sleepMin >= 420 ? { label: 'A full night', tone: 'good' } : { label: sleepMin >= 360 ? 'A little short' : 'A short night', tone: 'watch' }} progress={Math.min(1, sleepMin / 480)}
    hint={ih?.sleep.last ? `Night ending ${new Date(`${ih.sleep.last.day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' })}` : 'Last night'} onPress={() => openVital('sleep')} />);
  if (weightShown) add((i, wide) => <VitalTile wide={wide} key="weight" index={i} icon="barbell" tone="#8B5CF6" title="Weight" value={fmtKg(weightShown.kg)} unit="kg"
    status={weightShown.change == null ? { label: 'Latest weigh-in', tone: 'none' } : { label: `${weightShown.change > 0 ? 'Up' : weightShown.change < 0 ? 'Down' : 'Unchanged'} ${weightShown.change ? `${Math.abs(weightShown.change)} kg` : ''}`.trim(), tone: 'none' }}
    hint={weightShown.span ? `Over ${weightShown.span} days` : 'From Apple Health'} onPress={() => openVital('weight')} />);
  if (oxyShown) add((i, wide) => <VitalTile wide={wide} key="o2" index={i} icon="water" tone={C.info} title="Oxygen" value={String(Math.round(oxyShown.v))} unit="%" status={o2State(oxyShown.v)} hint={ageOf(oxyShown.t)} onPress={() => openVital('spo2')} />);
  if (bpShown) add((i, wide) => <VitalTile wide={wide} key="bp" index={i} icon="speedometer" tone={C.warning} title="Blood pressure" value={`${bpShown.sy}/${bpShown.di}`} unit="mmHg" status={bpState(bpShown.sy, bpShown.di)}
    hint={ageOf(bpShown.t)} onPress={() => openVital('bp')} />);
  const missing = [oxyShown ? null : 'oxygen', bpShown ? null : 'blood pressure'].filter(Boolean) as string[];

  return (
    <View style={{ flex: 1, backgroundColor: C.background }}>
    <GlassBackdrop />
    <Screen bg="transparent" refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); api.invalidateApiCache(); loadAi(true); load(); }} tintColor={C.primary} />} contentStyle={{ paddingBottom: 120 }}>
      <Reveal index={0}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T v="display" style={{ fontFamily: Platform.select({ ios: 'Georgia', default: 'serif' }), fontStyle: 'italic', fontWeight: '400' }}>Health</T>
            <T v="caption" color={sync.connection?.connected ? C.textSecondary : C.warning} numberOfLines={1}>
              {sync.connection?.connected ? `Apple Health read ${sync.readAt ? ago(new Date(sync.readAt).toISOString()) : 'just now'}` : 'No device connected yet'}
            </T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <IconButton icon={sync.connection?.connected ? 'watch' : 'watch-outline'} label={sync.connection?.connected ? 'Connected devices' : 'Connect a device'} onPress={() => router.push('/(patient)/devices' as any)} color={sync.connection?.connected ? C.success : C.warning} />
            <ThemeToggle />
          </View>
        </View>
      </Reveal>

      {sync.connection?.connected && ih ? <Reveal index={1} style={{ marginTop: 16 }}><HealthOverview data={ih} /></Reveal> : null}

      <Reveal index={1} style={{ marginTop: 16 }}>
        <SourcesCard sync={sync} onConnect={() => router.push('/(patient)/devices' as any)} onSync={() => { void sync.syncNow({ force: true }); }} />
      </Reveal>

      {/* Your week, written by the AI from your own readings (or a plain summary of the same numbers when the AI is unavailable) */}
      {ai ? (
        <Reveal index={1}>
          <Fold title="Your week in words" icon="sparkles-outline" subtitle={ai.headline}>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Ionicons name="sparkles-outline" size={20} color={C.primary} />
              <T v="heading" style={{ flex: 1 }}>Your week</T>
              <Badge label={ai.source === 'ai' ? 'AI summary' : 'Summary'} tone={ai.source === 'ai' ? 'info' : 'neutral'} />
            </View>
            <T v="bodyStrong" style={{ marginTop: 8 }}>{ai.headline}</T>
            {ai.insights.map((i) => (
              <View key={i.title + i.detail} style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <Ionicons name={i.tone === 'good' ? 'checkmark-circle-outline' : i.tone === 'watch' ? 'alert-circle-outline' : 'information-circle-outline'} size={20} color={i.tone === 'good' ? C.success : i.tone === 'watch' ? C.warning : C.textSecondary} />
                <View style={{ flex: 1 }}><T v="label">{i.title}</T><T v="caption" color={C.textSecondary}>{i.detail}</T></View>
              </View>
            ))}
            {ai.next_step ? <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}><Ionicons name="arrow-forward-circle-outline" size={20} color={C.primary} /><T v="caption" style={{ flex: 1 }}>{ai.next_step}</T></View> : null}
            <T v="caption" color={C.textTertiary} style={{ marginTop: 10, fontSize: 12 }}>{ai.based_on ? `${ai.based_on} ` : ''}General guidance, not a diagnosis.</T>
          </Card>
          </Fold>
        </Reveal>
      ) : null}

      {/* 1. Today hero: rings, then one tile per signal */}
      <Reveal index={1} style={{ marginTop: 16 }}>
        <PressScale label="Open activity" onPress={() => router.push('/(patient)/activity' as any)}>
          <Card style={{ paddingVertical: 18 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <ActivityRings size={132} steps={act?.rings.steps ?? { value: 0, goal: 8000 }} calories={act?.rings.calories ?? { value: 0, goal: 400 }} minutes={act?.rings.minutes ?? { value: 0, goal: 30 }} />
              <View style={{ flex: 1, gap: 10 }}>
                {([['Steps', RING_COLORS.steps, act?.rings.steps, ''], [act?.rings.calories?.estimated ? 'Calories (estimated)' : 'Calories', RING_COLORS.calories, act?.rings.calories, 'kcal'], [act?.rings.minutes?.estimated ? 'Active minutes (estimated)' : 'Active minutes', RING_COLORS.minutes, act?.rings.minutes, 'min']] as const).map(([label, color, r, unit]) => (
                  <View key={label}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} /><T v="caption" color={C.textSecondary}>{label}</T></View>
                    <T v="bodyStrong">{r ? Math.round(r.value).toLocaleString() : '--'}<T v="caption" color={C.textSecondary}> / {r ? r.goal.toLocaleString() : '--'} {unit}</T></T>
                  </View>
                ))}
              </View>
            </View>
            <T v="caption" color={C.textTertiary} style={{ marginTop: 10, fontSize: 12 }}>
              {act ? (act.rings.calories.estimated || act.rings.minutes.estimated ? 'Calories and minutes marked estimated come from your steps.' : '') : 'Loading...'}
            </T>
          </Card>
        </PressScale>

        {insights.status === 'loading' && tiles.length === 0 ? <View style={{ marginTop: 12 }}><Skeleton height={150} /></View> : null}
        {tiles.length > 0 ? <View style={tileStyles.grid}>{tiles.map((make, i) => make(i, tiles.length % 2 === 1 && i === tiles.length - 1))}</View> : null}
        {missing.length > 0 && sync.connection?.connected ? (
          <T v="caption" color={C.textTertiary} style={{ marginTop: 12 }}>
            Not in Apple Health yet: {missing.join(' and ')}. They appear here as soon as a watch, a blood pressure cuff or a pulse oximeter writes them to Health.
          </T>
        ) : null}

      </Reveal>

      {/* 2. This week, then the heart, both from Apple Health */}
      {sync.connection?.connected ? (
        <Reveal index={2} style={{ marginTop: 16 }}>
          {!ih ? <Skeleton height={180} /> : null}
          {ih ? <View style={{ marginTop: 16 }}><WeekReview rows={weekRows(ih)} /></View> : null}
          {ih ? <View style={{ marginTop: 16 }}><HeartCard heart={ih.heart} restingLatest={ih.heart.restingLatest} live={liveHrFresh} /></View> : null}
        </Reveal>
      ) : null}

      {/* 3. Nutrition */}
      <Reveal index={3}>
        <Fold title="Today's nutrition" icon="restaurant-outline" subtitle={meals ? `${meals.calories} calories so far` : 'Calories and balance'} action="Log a meal" onAction={() => router.push('/(patient)/nutrition/meal' as any)}>
          <Card>
            <DonutChart data={macroSlices} size={220} thickness={42} centerValue={meals ? String(meals.calories) : '--'} centerLabel="calories today"
              emptyText="Log a meal to see how balanced your day is" hint="Tap a slice to see what it means" />
            {meals ? (
              <View style={{ marginTop: 16 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                  <T v="caption" color={C.textSecondary}>{meals.calories} of about {meals.target} calories</T>
                  <T v="caption" color={C.textSecondary}>{meals.percent}%</T>
                </View>
                <ProgressBar value={meals.percent / 100} color={meals.percent > 100 ? C.danger : C.primary} />
              </View>
            ) : null}
            {macroHint ? <View style={{ marginTop: 14 }}><Banner tone="info" text={macroHint} /></View> : null}
            {meals?.meals.length ? (
              <View style={{ marginTop: 10 }}>
                {meals.meals.slice(0, 4).map((m) => (
                  <ListRow key={m.id} icon="restaurant-outline" title={m.name} subtitle={`${m.meal_type[0].toUpperCase()}${m.meal_type.slice(1)} · ${m.calories} cal`}
                    right={m.diet_score != null ? <Badge label={`${m.diet_score}`} tone={m.diet_score >= 70 ? 'success' : m.diet_score >= 45 ? 'warning' : 'danger'} /> : undefined} />
                ))}
              </View>
            ) : null}
            <T v="caption" color={C.textTertiary} style={{ marginTop: 10 }}>Nutrition values are estimates for a typical serving.</T>
          </Card>
        </Fold>
      </Reveal>

      {/* 4. Risk */}
      <Reveal index={4}>
        <Fold title="Your risk check" icon="shield-checkmark-outline" subtitle={risk ? `${risk.label}` : 'What could be improved'}>
        {risk ? (
          <Card style={{ marginBottom: 12, paddingVertical: 16 }}>
            <T v="overline" color={C.textSecondary} style={{ textAlign: 'center' }}>Health risk score</T>
            <View style={{ marginTop: 8, alignItems: 'center' }}><Gauge value={risk.score} width={250} /></View>
            <View style={{ alignItems: 'center', marginTop: 2 }}>
              <T v="display" style={{ fontSize: 34, lineHeight: 40 }}>{risk.score}</T>
              <Badge label={risk.label} tone={risk.tier === 'low' ? 'success' : risk.tier === 'moderate' ? 'warning' : 'danger'} />
              <T v="caption" color={C.textSecondary} style={{ textAlign: 'center', marginTop: 8, paddingHorizontal: 8 }}>{risk.summary}</T>
            </View>
          </Card>
        ) : null}
          <RiskCard risk={riskFailed ? undefined : risk} recs={riskFailed ? undefined : recs} />
        </Fold>
      </Reveal>

      {/* 5. Consistency */}
      <Reveal index={5}>
        <Fold title="Your consistency" icon="calendar-outline" subtitle="Habits over the last weeks">
          {outcomes.length === 0 && !loading ? (
            <Card><EmptyState icon="trending-up-outline" title="No progress yet" text="Start a goal on the Home tab and your progress will appear here."
              action="Go to Home" onAction={() => router.push('/(patient)/(tabs)/today' as any)} /></Card>
          ) : (
            <Card>
              {heat ? <Heatmap days={heat} /> : <Skeleton height={140} />}
              {first ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
                  <MiniStat value={`${first.weeks_persisted}/${first.weeks_tracked}`} label="Weeks kept going" />
                  <MiniStat value={String(first.streak?.total_active_days ?? 0)} label="Active days" />
                  <MiniStat value={String(first.lapses)} label="Setbacks" />
                  <MiniStat value={first.avg_days_to_recover != null ? `${first.avg_days_to_recover} d` : '--'} label="Time to bounce back" />
                </View>
              ) : null}
              {first?.behaviour_change_pct_vs_baseline != null ? (
                <T v="caption" color={C.textSecondary} style={{ marginTop: 12 }}>Change since you started: <T v="label">{first.behaviour_change_pct_vs_baseline}%</T></T>
              ) : null}
            </Card>
          )}
          <LearningCard />
        </Fold>
      </Reveal>

      <Reveal index={6}><SummaryShare /></Reveal>

      {dash?.trends?.length ? (
        <Section title="Trends">
          <Card>{dash.trends.slice(0, 4).map((t, i) => (
            <ListRow key={i} title={t.category} subtitle={t.message} right={<T v="bodyStrong">{t.value}</T>} />
          ))}</Card>
        </Section>
      ) : null}

      <Section title="Log and connect">
        <Card>
          <ListRow icon="create-outline" title="Log a health reading" subtitle="Blood pressure, glucose, weight" onPress={() => router.push('/(patient)/health/log-health' as any)} />
          <ListRow icon="restaurant-outline" title="Log a meal" subtitle="Photo or search" onPress={() => router.push('/(patient)/nutrition/meal' as any)} />
          <ListRow icon="watch-outline" title="Devices" subtitle="Connect your smartwatch" onPress={() => router.push('/(patient)/devices' as any)} />
        </Card>
      </Section>
      <View style={{ marginTop: 16 }}><Banner tone="info" text="These readings support, and do not replace, advice from your clinician." /></View>
    </Screen>
    </View>
  );
}
