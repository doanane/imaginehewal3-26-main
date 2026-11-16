import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { theme } from '../../constants/theme';
import api from '../../services/api';
import { callOrQueue } from '../../services/offlineActions';
import { Badge, Banner, Button, Card, Chip, T } from '../ui';
import { DepthSurface, ProgressRing, Reveal } from '../ui/motion';
import { Ionicons, Pressable, View } from '../themed';
import AgentCard from './AgentCard';
import { BARRIER_IDS, BEHAVIOR_IDS, BEH_ICON, EVIDENCE_TONE, Tr } from './shared';

const C = theme.COLORS;

/** A short pop when a step is finished, so the person feels it. */
function Pop({ children, on }: { children: React.ReactNode; on: boolean }) {
  const s = useSharedValue(1);
  useEffect(() => { if (on) { s.value = 0.9; s.value = withSpring(1, { damping: 7, stiffness: 160 }); } }, [on]);        // eslint-disable-line react-hooks/exhaustive-deps
  const a = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return <Animated.View style={a}>{children}</Animated.View>;
}

function StepCard({ item, meta, t, wearable, onChange }: { item: any; meta: Record<string, any>; t: Tr; wearable: boolean; onChange: () => void }) {
  const { plan, action, streak, safety_note, step_held } = item;
  const [why, setWhy] = useState(false);
  const [fb, setFb] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [local, setLocal] = useState<string | null>(null);          // what was just reported while offline, until it syncs
  const status = local ?? action.status;
  const done = status !== 'pending';
  const m = meta[action.technique] || null;

  const send = async (body: any) => {
    setBusy(true);
    try {
      const q = await callOrQueue<any>(`/behavior/actions/${action.id}/checkin`, 'POST', body);        // kept on the phone and sent when the network returns
      if (q.queued) { setLocal(body.status || 'done'); setFb({ feedback: t('habits.saved_offline') }); }
      else { setFb(q.data); onChange(); }
    }
    catch (e: any) { Alert.alert('', e?.message || 'Could not save'); }
    finally { setBusy(false); }
  };
  const sync = async () => { try { await api.syncBehaviorWearable(); onChange(); } catch (e: any) { Alert.alert('', e?.message || 'No data yet'); } };

  return (
    <DepthSurface label={action.title} style={{ marginTop: 14 }}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={BEH_ICON[plan.behavior] || 'walk-outline'} size={20} color={C.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <T v="overline" color={C.primary}>{t(`habits.beh.${plan.behavior}`)}</T>
            {action.is_comeback ? <T v="caption" color={C.warning} style={{ fontWeight: '700' }}>{t('habits.welcome_back_step')}</T> : null}
          </View>
          {step_held ? <Badge label={t('habits.step_held')} tone="warning" /> : null}
        </View>

        <T v="title" style={{ marginTop: 12 }}>{action.title}</T>
        <T v="body" color={C.textSecondary} style={{ marginTop: 4 }}>{action.detail}</T>

        {safety_note ? <View style={{ marginTop: 12 }}><Banner tone="warning" icon="shield-checkmark-outline" text={safety_note} /></View> : null}

        <Pressable onPress={() => setWhy((w) => !w)} accessibilityRole="button" accessibilityState={{ expanded: why }} style={{ marginTop: 12, minHeight: 36, justifyContent: 'center' }}>
          <T v="label" color={C.primary}>{t('habits.why')}  {why ? '▴' : '▾'}</T>
        </Pressable>
        {why ? (
          <Animated.View entering={FadeInDown.duration(220)} style={{ backgroundColor: C.background, borderRadius: 12, padding: 12 }}>
            <T v="body">{action.rationale}</T>
            {m ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, alignItems: 'center' }}>
                <Badge label={`${t('habits.technique')}: ${m.bct_name} (${m.bct_code})`} tone="neutral" />
                <Badge label={`${t('habits.evidence')}: ${t(`habits.evidence.${m.evidence}`)}`} tone={EVIDENCE_TONE[m.evidence] || 'neutral'} />
              </View>
            ) : null}
          </Animated.View>
        ) : null}

        {streak ? (
          <T v="caption" color={C.textSecondary} style={{ marginTop: 10 }}>
            {t('habits.streak', { n: streak.current })} · {t('habits.best', { n: streak.best })} · {t('habits.active_days', { n: streak.total_active_days })}
          </T>
        ) : null}

        {!done ? (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 14 }}>
            <View style={{ flex: 1 }}><Button title={t('habits.done')} icon="checkmark" loading={busy} onPress={() => send({ status: 'done' })} /></View>
            <View style={{ flex: 1 }}><Button title={t('habits.a_bit')} variant="secondary" onPress={() => send({ status: 'partial' })} /></View>
            <View style={{ flex: 1 }}><Button title={t('habits.not_today')} variant="ghost" onPress={() => send({ status: 'skipped' })} /></View>
          </View>
        ) : (
          <Pop on={done}><View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name={status === 'done' ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={status === 'done' ? C.success : C.textSecondary} />
            <T v="bodyStrong">{t('habits.today_status', { s: t(`habits.status.${status}`) })}</T>
          </View></Pop>
        )}

        {wearable && !done && ['movement', 'activity', 'sleep'].includes(plan.behavior) ? (
          <Pressable onPress={sync} accessibilityRole="button" style={{ marginTop: 10, minHeight: 40, justifyContent: 'center' }}><T v="label" color={C.primary}>{t('habits.use_health_data')}</T></Pressable>
        ) : null}

        {fb?.feedback ? <T v="bodyStrong" color={C.success} style={{ marginTop: 10 }}>{fb.feedback}</T> : null}
        {fb?.recognition ? (
          <Animated.View entering={FadeInDown.springify()} style={{ marginTop: 12 }}>
            <Banner tone="success" icon="ribbon-outline" title={t('habits.came_back')} text={t('habits.came_back_text')} />
          </Animated.View>
        ) : null}

        {done && status !== 'done' && !action.barrier && !local ? (
          <View style={{ marginTop: 14 }}>
            <T v="label" color={C.textSecondary}>{fb?.ask_barrier || t('habits.what_got_in_way')}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {BARRIER_IDS.map((b) => <Chip key={b} label={t(`habits.barrier.${b}`)} onPress={() => send({ status, barrier: b })} />)}
            </View>
          </View>
        ) : null}
      </Card>
    </DepthSurface>
  );
}

export default function TodayTab({ today, recommendations, approaches, settings, onChange, t }: {
  today: any; recommendations: any[]; approaches: any; settings: any; onChange: () => void; t: Tr;
}) {
  const items: any[] = today?.items || [];
  const meta: Record<string, any> = {};
  (approaches?.approaches || []).forEach((a: any) => { if (a.technique) meta[a.technique] = a; });
  const active = items.map((i) => i.plan.behavior);
  const finished = items.filter((i) => i.action.status !== 'pending').length;
  const start = async (behavior: string) => { try { await api.createBehaviorPlan({ behavior }); onChange(); } catch (e: any) { Alert.alert('', e?.message || ''); } };

  return (
    <View>
      {today?.notice ? <Reveal index={0}><Banner tone="info" icon="heart-outline" text={today.notice} /></Reveal> : null}

      {items.length > 0 ? <AgentCard t={t} onChange={onChange} /> : null}

      {items.length > 0 ? (
        <Reveal index={1} style={{ marginTop: 14 }}>
          <Card tone="soft">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <ProgressRing value={(finished / items.length) * 100} size={84} stroke={9} color={C.primary} track="rgba(11,110,110,0.15)">
                <T v="title" style={{ fontSize: 22, lineHeight: 28 }}>{finished}/{items.length}</T>
              </ProgressRing>
              <View style={{ flex: 1 }}>
                <T v="heading">{t('habits.tab.today')}</T>
                <T v="caption" color={C.textSecondary}>{t('habits.subtitle')}</T>
              </View>
            </View>
          </Card>
        </Reveal>
      ) : null}

      {items.map((it) => <StepCard key={it.action.id} item={it} meta={meta} t={t} wearable={!!settings?.wearable_data_enabled} onChange={onChange} />)}

      {(items.length === 0 || BEHAVIOR_IDS.some((b) => !active.includes(b))) ? (
        <View style={{ marginTop: 20 }}>
          {items.length === 0 ? <><T v="title">{t('habits.start_title')}</T><T v="body" color={C.textSecondary} style={{ marginTop: 4 }}>{t('habits.start_sub')}</T></> : null}
          {recommendations.length > 0 ? (
            <View style={{ marginTop: 14 }}>
              <T v="overline" color={C.textSecondary}>{t('habits.suggested')}</T>
              {recommendations.map((r, i) => (
                <Reveal key={r.behavior} index={i} style={{ marginTop: 10 }}>
                  <Card>
                    <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                      <Ionicons name={BEH_ICON[r.behavior] || 'walk-outline'} size={24} color={C.primary} />
                      <View style={{ flex: 1 }}>
                        <T v="bodyStrong">{t(`habits.beh.${r.behavior}`)}</T>
                        <T v="caption" color={C.textSecondary}>{r.reason}</T>
                      </View>
                    </View>
                    <View style={{ marginTop: 10 }}><Button title={t('habits.start')} onPress={() => start(r.behavior)} /></View>
                  </Card>
                </Reveal>
              ))}
            </View>
          ) : null}
          <T v="overline" color={C.textSecondary} style={{ marginTop: 18 }}>{t('habits.all_behaviors')}</T>
          <View style={{ gap: 8, marginTop: 8 }}>
            {BEHAVIOR_IDS.filter((b) => !active.includes(b)).map((b) => (
              <Card key={b} onPress={() => start(b)}>
                <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <Ionicons name={BEH_ICON[b]} size={22} color={C.primary} />
                  <View style={{ flex: 1 }}>
                    <T v="bodyStrong">{t(`habits.beh.${b}`)}</T>
                    <T v="caption" color={C.textSecondary}>{t(`habits.beh.${b}.d`)}</T>
                  </View>
                  <Ionicons name="add-circle-outline" size={22} color={C.primary} />
                </View>
              </Card>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}
