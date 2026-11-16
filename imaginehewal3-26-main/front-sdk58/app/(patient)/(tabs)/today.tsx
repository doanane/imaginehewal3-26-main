import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';
import {
  Avatar, Badge, Banner, Button, Card, Chip, IconName, ListRow, Screen, Section, LanguageSwitch, Skeleton, T, ThemeToggle,
} from '../../../components/ui';
import { QuickTile, useQuickTileWidth } from '../../../components/ui/QuickTile';
import { AmbientOrb, DepthSurface, PressScale, ProgressRing, Pulse, Reveal } from '../../../components/ui/motion';
import { BARRIERS, BEHAVIORS, EMERGENCY_NUMBER } from '../../../constants/behavior';
import { QUICK } from '../../../constants/quickActions';
import { theme } from '../../../constants/theme';
import { useAuth } from '../../../contexts/AuthContext';
import { useMessaging } from '../../../contexts/MessagingContext';
import api, { ActivitySummary, DashboardData, LiveVitals } from '../../../services/api';
import ActivityRings from '../../../components/ActivityRings';
import { syncStepsNow } from '../../../services/stepSync';
import { realtime } from '../../../services/realtime';
import { isOpen, useEmergency } from '../../../contexts/EmergencyContext';
import { callOrQueue, usePendingActions } from '../../../services/offlineActions';
import { useT } from '../../../i18n';
import { translateText } from '../../../i18n/translate';
import { useHealthSync } from '../../../services/healthSync';
import { profileImageSource } from '../../../services/imageUrl';
import { useUnreadNotifications } from '../../../services/useBadge';
import { Image, Ionicons, LinearGradient, RefreshControl, View } from '../../../components/themed';

const C = theme.COLORS;

function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function scoreLabel(score: number | null): { title: string; tone: string } {
  if (score == null) return { title: 'Getting started', tone: 'Log a reading to see your score.' };
  if (score >= 85) return { title: 'Goals reached', tone: 'You have met most of what you set for today.' };
  if (score >= 60) return { title: 'Doing well', tone: 'A few small steps will finish the day.' };
  if (score >= 25) return { title: 'Making progress', tone: 'Today is still open. Small steps count.' };
  return { title: 'Day just started', tone: 'Steps, sleep, water, meals and medicines you track fill this in.' };
}

function HeroChip({ icon, text, pulse }: { icon: IconName; text: string; pulse?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 }}>
      <Pulse active={!!pulse}><Ionicons name={icon} size={15} color="#fff" /></Pulse>
      <T v="label" color="#fff">{text}</T>
    </View>
  );
}

function ActionCard({ item, onCheckIn }: { item: any; onCheckIn: (id: number, body: any) => Promise<any> }) {
  const { plan, action } = item;
  const meta = BEHAVIORS[plan.behavior];
  const [why, setWhy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [askBarrier, setAskBarrier] = useState(false);
  const [busy, setBusy] = useState(false);
  const done = action.status !== 'pending';

  const submit = async (status: string, barrier?: string) => {
    setBusy(true);
    try {
      const res = await onCheckIn(action.id, { status, barrier });
      setFeedback(res?.feedback ?? null);
      setAskBarrier(status !== 'done' && !barrier);
    } finally { setBusy(false); }
  };

  return (
    <Card style={{ marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={meta?.icon ?? 'flag-outline'} size={22} color={C.primary} />
          </View>
          <Badge label={meta?.short ?? plan.behavior} tone="info" />
        </View>
        {action.is_comeback ? <Badge label="Welcome back step" tone="warning" /> : null}
      </View>
      <T v="heading">{action.title}</T>
      <T v="caption" color={C.textSecondary} style={{ marginTop: 4 }}>{action.detail}</T>
      {item.safety_note ? <View style={{ marginTop: 10 }}><Banner tone="warning" icon="shield-checkmark-outline" text={item.safety_note} /></View> : null}
      <T v="label" color={C.primary} onPress={() => setWhy((w) => !w)} style={{ marginTop: 10 }} accessibilityRole="button">
        {why ? 'Hide reason' : `Why this? (${action.technique})`}</T>
      {why ? <T v="caption" color={C.textSecondary} style={{ marginTop: 6 }}>{action.rationale}</T> : null}

      {!done ? (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
          <Button title="Done" icon="checkmark" onPress={() => submit('done')} loading={busy} style={{ flex: 1 }} />
          <Button title="Some" variant="secondary" onPress={() => submit('partial')} disabled={busy} style={{ flex: 1 }} />
          <Button title="Not today" variant="ghost" onPress={() => submit('skipped')} disabled={busy} style={{ flex: 1 }} />
        </View>
      ) : (
        <View style={{ marginTop: 12 }}>
          <Badge label={action.status === 'done' ? 'Completed' : action.status === 'partial' ? 'Partly done' : 'Skipped'}
            tone={action.status === 'done' ? 'success' : 'neutral'} />
        </View>
      )}
      {feedback ? <T v="caption" color={C.success} style={{ marginTop: 8 }}>{feedback}</T> : null}
      {(askBarrier || (done && action.status !== 'done' && !action.barrier)) ? (
        <View style={{ marginTop: 12 }}>
          <T v="caption" color={C.textSecondary}>What got in the way? This helps us adjust your plan.</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {Object.entries(BARRIERS).map(([k, label]) => <Chip key={k} label={label} onPress={() => submit(action.status, k)} />)}
          </View>
        </View>
      ) : null}
    </Card>
  );
}

export default function Today() {
  const router = useRouter();
  const tileW = useQuickTileWidth(32);
  const { user } = useAuth();
  const { unreadCount } = useMessaging();
  const unreadNotes = useUnreadNotifications();
  const bellCount = unreadNotes + unreadCount;           // notifications (doctor messages, appointments, medicines) plus unread chats
  const { mine, startSos } = useEmergency();
  const { t, lang } = useT();
  const pendingSync = usePendingActions();
  const [meds, setMeds] = useState<any>(null);
  const [wbDue, setWbDue] = useState(false);
  const [tip, setTip] = useState<{ text: string; ai: boolean } | null>(null);
  const [today, setToday] = useState<any>(null);
  const [dash, setDash] = useState<DashboardData | null>(null);
  const [live, setLive] = useState<LiveVitals | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hs = useHealthSync();                         // the same Apple Health state the Health and Devices screens use
  const healthKit = hs.snapshot;
  const [act, setAct] = useState<ActivitySummary | null>(null);
  const [rank, setRank] = useState<{ rank: number; of: number } | null>(null);

  const load = useCallback(async () => {
    // The dashboard is the critical first paint. Optional panels must not block it.
    const dashboard = await api.getHealthDashboard().catch((reason) => {
      setError(reason?.message || 'Could not load your health data');
      return null;
    });
    if (dashboard) { setDash(dashboard); setError(null); }
    setLoading(false);
    setRefreshing(false);

    void Promise.allSettled([api.getBehaviorToday(), api.getLiveVitals(2)]).then(([t, l]) => {
      if (t.status === 'fulfilled') { setToday(t.value); setError(null); }
      if (l.status === 'fulfilled') setLive(l.value);
    });

  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useFocusEffect(useCallback(() => {
    let alive = true;
    const run = async () => {
      await syncStepsNow().catch(() => null);                                   // real phone steps, then the rings reflect them
      api.getActivitySummary().then((a) => { if (alive) setAct(a); }).catch(() => {});
      api.getBoard('steps', 'today').then((b) => { if (alive) setRank(b.me ? { rank: b.me.rank, of: b.participants } : null); }).catch(() => {});
    };
    run();
    return () => { alive = false; };
  }, []));
  useFocusEffect(useCallback(() => {
    api.getDailyTip(lang).then((r) => setTip(r.tip ? { text: r.tip, ai: !!r.ai } : null)).catch(() => {});
    api.getMedicationsToday().then(setMeds).catch(() => {});
    api.getWellbeingDue().then((d) => setWbDue(d.due)).catch(() => {});
  }, [lang]));
  // When new figures were just sent to the backend, read the rings and vitals again so Home matches what was synced.
  useEffect(() => {
    if (hs.uploads === 0) return;
    api.getActivitySummary().then(setAct).catch(() => {});
    api.getLiveVitals(2).then(setLive).catch(() => {});
    api.getHealthDashboard().then(setDash).catch(() => {});
  }, [hs.uploads]);
  useEffect(() => realtime.on('vitals.update', (e) => setLive((p) => ({
    is_live: true, age_seconds: 0, history: p?.history ?? [],
    latest: { heart_rate: e.heart_rate ?? p?.latest?.heart_rate ?? null, blood_oxygen: e.blood_oxygen ?? p?.latest?.blood_oxygen ?? null,
      blood_pressure_systolic: e.blood_pressure_systolic ?? p?.latest?.blood_pressure_systolic ?? null,
      blood_pressure_diastolic: e.blood_pressure_diastolic ?? p?.latest?.blood_pressure_diastolic ?? null,
      is_emergency: (e.alert_reasons?.length ?? 0) > 0, timestamp: e.timestamp },
  }))), []);

  const checkIn = async (id: number, body: any) => {
    try {
      const q = await callOrQueue<any>(`/behavior/actions/${id}/checkin`, 'POST', body);
      if (q.queued) return { feedback: 'Saved on your phone. It will sync when you are back online.' };
      load(); return q.data;
    }
    catch (e: any) { Alert.alert('Could not save', e.message); return null; }
  };
  const startPlan = async (behavior: string) => {
    try { await api.createBehaviorPlan({ behavior }); setLoading(true); load(); }
    catch (e: any) { Alert.alert('Could not start plan', e.message); }
  };
  const callEmergency = () =>
    Alert.alert(`Call ${EMERGENCY_NUMBER}?`, 'This calls your local emergency services.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Call now', style: 'destructive', onPress: () => Linking.openURL(`tel:${EMERGENCY_NUMBER}`) }]);

  const name = (user?.full_name || user?.username || '').split(' ')[0];
  const items: any[] = today?.items ?? [];
  // A reading counts as current only if it was taken in the last 24 hours; older ones are left out rather than shown as today's value.
  const recent = (iso?: string | null) => !!iso && Date.now() - Date.parse(iso) < 24 * 3600e3;
  const lt: any = live?.latest ?? null;
  const liveOk = recent(lt?.timestamp);
  const hkHr = healthKit?.heartRate != null && recent(healthKit.heartRateAt);
  const hkO2 = healthKit?.oxygenSaturation != null && recent(healthKit.oxygenSaturationAt);
  const hkBp = healthKit?.bloodPressure.systolic != null && healthKit?.bloodPressure.diastolic != null && recent(healthKit.bloodPressureAt);
  const hr = (hkHr ? healthKit!.heartRate : null) ?? (liveOk ? lt?.heart_rate ?? null : null);
  const spo2 = (hkO2 ? healthKit!.oxygenSaturation : null) ?? (liveOk ? lt?.blood_oxygen ?? null : null);
  const bp = hkBp ? `${Math.round(healthKit!.bloodPressure.systolic as number)}/${Math.round(healthKit!.bloodPressure.diastolic as number)}`
    : liveOk && lt?.blood_pressure_systolic && lt?.blood_pressure_diastolic ? `${lt.blood_pressure_systolic}/${lt.blood_pressure_diastolic}` : null;
  const score = dash?.daily_score?.score ?? null;
  const trend = dash?.daily_score?.trend_percentage;
  const steps = act ? { value: Math.round(act.rings.steps.value).toLocaleString(), unit: 'steps' } : healthKit?.steps != null ? { value: Math.round(healthKit.steps).toLocaleString(), unit: 'steps' } :
    dash?.categories?.find((c) => c.title.toLowerCase().includes('step'));
  const label = scoreLabel(score);

  // One prioritised alert, in the spirit of "needs your attention".
  const alert = hr && hr >= 120
    ? { tone: C.danger, bg: '#FDECEA', icon: 'warning-outline' as IconName, title: 'Heart rate is high', text: `${hr} bpm right now. Rest, and call your care team if you feel unwell.`, go: '/(patient)/(tabs)/insights' }
    : today?.notice
      ? { tone: C.warning, bg: C.warningLight, icon: 'heart-outline' as IconName, title: 'Welcome back', text: today.notice, go: null }
      : unreadCount > 0
        ? { tone: C.info, bg: C.infoLight, icon: 'chatbubbles-outline' as IconName, title: `${unreadCount} new message${unreadCount > 1 ? 's' : ''}`, text: 'From your care team. Tap to read.', go: '/(patient)/messages' }
        : null;

  return (
    <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); api.invalidateApiCache(); load(); }} tintColor={C.primary} />}
      contentStyle={{ paddingBottom: 120 }}>
      {/* Header: greeting on the left, notifications and profile at the top right */}
      <Reveal index={0}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <View style={{ flex: 1, minWidth: 0 }}>
            <T v="caption" color={C.textSecondary}>{greeting()}</T>
            <T v="display" numberOfLines={1}>{name || 'Welcome'}</T>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <ThemeToggle />
            <LanguageSwitch />
            <PressScale label="Notifications" onPress={() => router.push('/(patient)/notifications' as any)}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.borderLight }}>
              <Ionicons name="notifications-outline" size={22} color={C.textPrimary} />
              {bellCount > 0 ? <View accessibilityLabel={`${bellCount} unread`} style={{ position: 'absolute', top: 3, right: 1, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: C.danger, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}><T v="caption" color="#fff" style={{ fontSize: 11, lineHeight: 14, fontWeight: '700' }}>{bellCount > 9 ? '9+' : bellCount}</T></View> : null}
            </PressScale>
            <PressScale label="Open profile" onPress={() => router.push('/(patient)/profile' as any)}>
              {profileImageSource(user?.profile_image)
                ? <Image source={profileImageSource(user?.profile_image) as any} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 2, borderColor: C.primarySoft }} accessibilityLabel="Your profile photo" />
                : <Avatar name={user?.full_name || user?.username || '?'} size={44} />}
            </PressScale>
          </View>
        </View>
      </Reveal>

      {/* Hero: health score */}
      <Reveal index={1}>
        <DepthSurface label="Health score">
          {/* the shadow sits on a solid-coloured wrapper: a shadow on a gradient view is slow to draw */}
          <View style={{ borderRadius: 24, backgroundColor: '#0B6E6E', ...theme.SHADOWS.medium }}>
          <LinearGradient colors={['#0B6E6E', '#0A7C99']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 24, padding: 20, overflow: 'hidden' }}>
          <AmbientOrb size={170} color="rgba(255,255,255,0.10)" style={{ position: 'absolute', right: -40, top: -40 }} />
          <AmbientOrb size={130} color="rgba(255,255,255,0.07)" style={{ position: 'absolute', right: 30, bottom: -60 }} />
          <View style={{ position: 'absolute', left: -50, bottom: -80, width: 180, height: 180, borderRadius: 90, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T v="overline" color="rgba(255,255,255,0.85)">Today's goals</T>
              <T v="title" color="#fff" style={{ fontSize: 26, lineHeight: 32, marginTop: 4 }}>{label.title}</T>
              <T v="caption" color="rgba(255,255,255,0.9)" style={{ marginTop: 4 }}>{label.tone}</T>
              {trend != null && score != null ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 }}>
                  <Ionicons name={trend >= 0 ? 'trending-up' : 'trending-down'} size={16} color="#fff" />
                  <T v="label" color="#fff">{trend >= 0 ? '+' : ''}{Math.round(trend)}% this week</T>
                </View>) : null}
            </View>
            <ProgressRing value={score ?? 0} size={132} stroke={11}>
              <T v="display" color="#fff" style={{ fontSize: 32, lineHeight: 38 }}>{score != null ? `${Math.round(score)}%` : '--'}</T>
              <T v="caption" color="rgba(255,255,255,0.85)" numberOfLines={1} style={{ marginTop: -4, fontSize: 13 }}>of goals met</T>
            </ProgressRing>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            {hr ? <HeroChip icon="heart" text={`${hr} bpm${live?.is_live ? ' live' : ''}`} pulse={!!live?.is_live} /> : null}
            {(dash?.daily_score?.breakdown || []).filter((p: any) => p.key !== 'steps').map((p: any) => <HeroChip key={p.key} icon={p.key === 'sleep' ? 'moon' : p.key === 'medicine' ? 'medical' : p.key === 'water' ? 'water' : 'restaurant'} text={`${p.label} ${p.pct}%`} />)}
            {steps ? <HeroChip icon="walk" text={`${steps.value} ${steps.unit || 'steps'}`} /> : null}
            {spo2 ? <HeroChip icon="water" text={`${Math.round(spo2)}% oxygen`} /> : null}
            {bp ? <HeroChip icon="pulse" text={`${bp} mmHg`} /> : null}
            {healthKit ? <HeroChip icon="fitness" text="Apple Health synced" /> : null}
          </View>
          </LinearGradient>
          </View>
        </DepthSurface>
      </Reveal>

      {/* Tip for today, written by AI for this person; the same tip all day */}
      {tip ? (
        <Reveal index={2} style={{ marginTop: 16 }}>
          <View style={{ backgroundColor: C.card, borderRadius: 18, padding: 16, borderWidth: 1, borderColor: C.borderLight }} accessible accessibilityLabel={`Tip for today. ${tip.text}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="sparkles" size={20} color={C.primary} />
              </View>
              <T v="overline" color={C.textSecondary} style={{ flex: 1 }}>Tip for today</T>
              {tip.ai ? <Badge label="Written by AI" tone="info" /> : null}
            </View>
            <T v="body" style={{ marginTop: 10, lineHeight: 24 }}>{tip.text}</T>
            <T v="caption" color={C.textTertiary} style={{ marginTop: 8 }}>General guidance, not a diagnosis. A new tip arrives every day.</T>
          </View>
        </Reveal>
      ) : null}

      {/* Alert */}
      {alert ? (
        <Reveal index={2} style={{ marginTop: 16 }}>
          <PressScale label={alert.title} onPress={alert.go ? () => router.push(alert.go as any) : undefined}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: C.borderLight }}>
            <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: alert.bg, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={alert.icon} size={24} color={alert.tone} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T v="bodyStrong">{alert.title}</T>
              <T v="caption" color={C.textSecondary} numberOfLines={2}>{alert.text}</T>
            </View>
            {alert.go ? <Ionicons name="chevron-forward" size={18} color={C.textMuted} /> : null}
          </PressScale>
        </Reveal>
      ) : null}

      {dash?.risk_alerts?.length ? (
        <Reveal index={3} style={{ marginTop: 16 }}>
          <Section title="Risk alerts">
            {dash.risk_alerts.map((risk) => (
              <Card key={risk.code} tone={risk.severity === 'critical' ? 'danger' : 'soft'} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <Ionicons
                    name={risk.severity === 'critical' ? 'warning' : 'alert-circle-outline'}
                    size={22}
                    color={risk.severity === 'critical' ? C.danger : C.warning}
                  />
                  <View style={{ flex: 1 }}>
                    <T v="bodyStrong">{risk.title}</T>
                    <T v="caption" color={C.textSecondary} style={{ marginTop: 4 }}>{risk.message}</T>
                    <T v="overline" color={C.textTertiary} style={{ marginTop: 8 }}>
                      Based on {risk.based_on.map((b: string) => translateText(b, lang)).join(', ')}
                    </T>
                  </View>
                </View>
              </Card>
            ))}
          </Section>
        </Reveal>
      ) : null}

      {dash?.personalized_recommendations?.length ? (
        <Reveal index={4} style={{ marginTop: 8 }}>
          <Section title="Your plan for today">
            {dash.personalized_recommendations.map((recommendation) => (
              <Card key={recommendation.title} style={{ marginBottom: 10 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                  <View style={{ width: 36, height: 36, borderRadius: 11, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="sparkles-outline" size={20} color={C.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="bodyStrong">{recommendation.title}</T>
                    <T v="caption" color={C.textSecondary} style={{ marginTop: 4 }}>{recommendation.message}</T>
                    <T v="overline" color={C.primary} style={{ marginTop: 8 }}>
                      {recommendation.action} | {recommendation.source}
                    </T>
                  </View>
                </View>
              </Card>
            ))}
          </Section>
        </Reveal>
      ) : null}

      {pendingSync > 0 ? (
        <Reveal index={5} style={{ marginTop: 16 }}>
          <Banner tone="info" text={`${pendingSync} update${pendingSync > 1 ? 's are' : ' is'} saved on your phone and will sync when you are back online.`} />
        </Reveal>
      ) : null}

      {/* Quick actions */}
      <Reveal index={5}>
        <Section title="Quick actions">
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 18 }}>
            {QUICK.map((q, i) => <QuickTile key={q.label} item={q} index={i} width={tileW} onPress={() => router.push(q.path as any)} />)}
          </View>
        </Section>
      </Reveal>

      {/* Today's activity */}
      <Reveal index={5}>
        <Section title="Today's activity" action="Open" onAction={() => router.push('/(patient)/activity' as any)}>
          <PressScale label="Open activity" onPress={() => router.push('/(patient)/activity' as any)}>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                <ActivityRings size={110} steps={act?.rings.steps ?? { value: 0, goal: 8000 }} calories={act?.rings.calories ?? { value: 0, goal: 400 }} minutes={act?.rings.minutes ?? { value: 0, goal: 30 }} />
                <View style={{ flex: 1 }}>
                  <T v="title" style={{ fontSize: 26, lineHeight: 32 }}>{Math.round(act?.rings.steps.value ?? 0).toLocaleString()}</T>
                  <T v="caption" color={C.textSecondary}>of {(act?.rings.steps.goal ?? 8000).toLocaleString()} steps</T>
                  <T v="caption" color={C.textSecondary} style={{ marginTop: 6 }}>{Math.round(act?.rings.calories.value ?? 0)} kcal · {Math.round(act?.rings.minutes.value ?? 0)} min active</T>
                  {act?.streak_days ? <T v="label" color="#D9701A" style={{ marginTop: 6 }}>{act.streak_days}-day streak</T> : null}
                </View>
              </View>
            </Card>
          </PressScale>
          <View style={{ marginTop: 10 }}>
            <Card style={{ paddingVertical: 4 }}>
              <ListRow icon="trophy-outline" title="Leaderboard" subtitle={rank ? `You are ${rank.rank}${['th', 'st', 'nd', 'rd'][rank.rank % 100 > 10 && rank.rank % 100 < 14 ? 0 : Math.min(rank.rank % 10, 4) % 4]} of ${rank.of} today` : 'See how you rank today. Joining is optional.'} onPress={() => router.push('/(patient)/leaderboard' as any)} />
            </Card>
          </View>
        </Section>
      </Reveal>

      {/* Today's step */}
      <Reveal index={4}>
        <Section title="Your step for today" action="All habits" onAction={() => router.push('/(patient)/behavior' as any)}>
          {error ? <View style={{ marginBottom: 12 }}><Banner tone="danger" text={error} action="Try again" onAction={load} /></View> : null}
          {loading ? <Card><Skeleton height={20} width="60%" /><Skeleton height={14} style={{ marginTop: 12 }} /><Skeleton height={48} style={{ marginTop: 16 }} /></Card>
            : items.length === 0 ? (
              <Card>
                <T v="bodyStrong">Choose one thing to work on</T>
                <T v="caption" color={C.textSecondary} style={{ marginTop: 4, marginBottom: 12 }}>
                  You will get one small step each day. It adapts to how your week is going, and a missed day never resets your progress.</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(BEHAVIORS).map(([k, b]) => <Chip key={k} label={b.label} icon={b.icon} onPress={() => startPlan(k)} />)}
                </View>
              </Card>
            ) : items.map((it) => <ActionCard key={it.action.id} item={it} onCheckIn={checkIn} />)}
        </Section>
      </Reveal>

      {!live?.latest ? (
        <Reveal index={5} style={{ marginTop: 4 }}>
          <Banner tone="info" text="No watch data yet. Connect your watch to see your heart rate here in real time."
            action="Connect a device" onAction={() => router.push('/(patient)/devices' as any)} />
        </Reveal>
      ) : null}

      {wbDue ? (
        <Reveal index={5} style={{ marginTop: 8 }}>
          <Section title="Weekly check-in">
            <Card onPress={() => router.push('/(patient)/wellbeing' as any)}>
              <ListRow icon="happy-outline" title="How have you been feeling?" subtitle="Four quick questions. Private to you." />
            </Card>
          </Section>
        </Reveal>
      ) : null}

      <Reveal index={6}>
        <Section title="Your medicines" action="Open" onAction={() => router.push('/(patient)/medications' as any)}>
          <Card onPress={() => router.push('/(patient)/medications' as any)}>
            <ListRow icon="medkit-outline" title={meds && meds.total > 0 ? `${meds.taken} of ${meds.total} doses taken today` : 'Add your medicines'}
              subtitle={meds && meds.total > 0 ? (meds.doses.find((d: any) => d.status === 'overdue') ? 'A dose is overdue' : meds.doses.find((d: any) => d.status === 'pending') ? `Next: ${meds.doses.find((d: any) => d.status === 'pending').name}` : 'All done for now') : 'Get reminders and track every dose'}
              right={meds?.doses?.some((d: any) => d.status === 'overdue') ? <Badge label="Overdue" tone="danger" /> : undefined} />
          </Card>
        </Section>
      </Reveal>

      <Reveal index={6}>
        <Section title="Your care team">
          <Card>
            <ListRow icon="chatbubbles-outline" title="Messages" subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'You are all caught up'}
              right={unreadCount > 0 ? <Badge label={String(unreadCount)} tone="danger" /> : undefined}
              onPress={() => router.push('/(patient)/messages' as any)} />
          </Card>
        </Section>
      </Reveal>

      <Reveal index={7}>
        <Section title="Need urgent help?">
          <Card tone="danger">
            <T v="bodyStrong" color={C.danger}>Emergency</T>
            <T v="caption" color={C.textPrimary} style={{ marginTop: 4, marginBottom: 12 }}>
              For chest pain, trouble breathing, stroke signs, severe bleeding or thoughts of self-harm, call emergency services now.</T>
            {isOpen(mine) ? (
              <Button title={t('em.view')} icon="alert-circle" variant="danger" onPress={() => router.push('/(patient)/emergency' as any)} />
            ) : (
              <Button title={t('em.sos_button')} icon="alert-circle" variant="danger" onPress={() => Alert.alert(t('em.sos_confirm_title'), t('em.sos_confirm_text'), [
                { text: t('em.cancel'), style: 'cancel' },
                { text: t('em.send'), style: 'destructive', onPress: () => { startSos().catch((e: any) => Alert.alert(t('em.title'), e.message)); } }])} />
            )}
            <View style={{ height: 10 }} />
            <Button title={`Call ${EMERGENCY_NUMBER}`} icon="call" variant="secondary" onPress={callEmergency} />
          </Card>
        </Section>
      </Reveal>
    </Screen>
  );
}
