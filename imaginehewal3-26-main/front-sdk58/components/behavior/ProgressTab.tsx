import React, { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import { theme } from '../../constants/theme';
import api from '../../services/api';
import Heatmap from '../charts/Heatmap';
import { Badge, Card, EmptyState, Skeleton, T } from '../ui';
import { Reveal } from '../ui/motion';
import { Ionicons, Pressable, View } from '../themed';
import { Tr } from './shared';

const C = theme.COLORS;

function Bar({ value, label, index }: { value: number; label: string; index: number }) {
  const h = useSharedValue(0);
  useEffect(() => { h.value = withDelay(index * 60, withTiming(Math.max(4, value * 72), { duration: 700, easing: Easing.out(Easing.cubic) })); }, [value]);   // eslint-disable-line react-hooks/exhaustive-deps
  const a = useAnimatedStyle(() => ({ height: h.value }));
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Animated.View style={[{ width: 18, borderRadius: 6, backgroundColor: value >= 0.4 ? C.primary : '#F0CFCB' }, a]} />
      <T v="caption" color={C.textTertiary} style={{ fontSize: 9, marginTop: 4 }}>{label}</T>
    </View>
  );
}

export default function ProgressTab({ outcomes, onChange, t }: { outcomes: any[]; onChange: () => void; t: Tr }) {
  const [heat, setHeat] = useState<any[] | null>(null);
  const [insights, setInsights] = useState<any>(null);
  const [nudges, setNudges] = useState<any>(null);
  useEffect(() => {
    api.getBehaviorHeatmap(8).then((h) => setHeat(h.days)).catch(() => setHeat([]));
    api.getBehaviorInsights().then(setInsights).catch(() => {});
    api.getBehaviorNudges().then(setNudges).catch(() => {});
  }, [outcomes.length]);

  if (!outcomes.length) return <EmptyState icon="trending-up-outline" title={t('habits.progress')} text={t('habits.no_progress')} />;
  const learned: string[] = (insights?.plans || []).flatMap((p: any) => p.learned || []);

  return (
    <View>
      {outcomes.map(({ plan, outcomes: o }, idx) => {
        const verdict = o.sustained === true ? { tone: 'success' as const, label: t('habits.sustained') } : o.sustained === false ? { tone: 'warning' as const, label: t('habits.not_yet') } : { tone: 'neutral' as const, label: t('habits.too_early') };
        return (
          <Reveal key={plan.id} index={idx} style={{ marginTop: idx ? 14 : 0 }}>
            <Card>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <T v="heading" style={{ flex: 1 }}>{t(`habits.beh.${plan.behavior}`)}</T>
                <Badge label={verdict.label} tone={verdict.tone} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 92, marginTop: 14 }}>
                {o.weekly_adherence.map((w: any, i: number) => <Bar key={w.week_ending} value={w.adherence} label={w.week_ending.slice(5)} index={i} />)}
              </View>
              <T v="body" style={{ marginTop: 10 }}>{t('habits.kept_going', { a: o.weeks_persisted, b: o.weeks_tracked })}</T>
              {o.lapses > 0 ? <T v="body" color={C.textSecondary}>{t('habits.gaps', { n: o.lapses, m: o.recovered_lapses })}{o.avg_days_to_recover != null ? ` · ${t('habits.avg_return', { d: o.avg_days_to_recover })}` : ''}</T> : null}
              {o.behaviour_change_pct_vs_baseline != null ? <T v="body" color={C.textSecondary}>{t('habits.change', { p: o.behaviour_change_pct_vs_baseline })}</T> : null}
              <Pressable onPress={() => Alert.alert(t('habits.stop_plan'), '', [{ text: t('habits.cancel'), style: 'cancel' }, { text: t('habits.stop_plan'), style: 'destructive', onPress: () => api.stopBehaviorPlan(plan.id).then(onChange) }])}
                accessibilityRole="button" style={{ marginTop: 10, minHeight: 36, justifyContent: 'center' }}>
                <T v="label" color={C.textSecondary}>{t('habits.stop_plan')}</T>
              </Pressable>
            </Card>
          </Reveal>
        );
      })}

      <T v="overline" color={C.textSecondary} style={{ marginTop: 22 }}>{t('habits.calendar')}</T>
      <Card style={{ marginTop: 8 }}>{heat ? <Heatmap days={heat} /> : <Skeleton height={130} />}</Card>

      {learned.length > 0 ? (
        <View style={{ marginTop: 22 }}>
          <T v="overline" color={C.textSecondary}>{t('habits.learned')}</T>
          <Card style={{ marginTop: 8 }}>
            {learned.map((l, i) => (
              <View key={i} style={{ flexDirection: 'row', gap: 10, marginTop: i ? 10 : 0 }}>
                <Ionicons name="bulb-outline" size={18} color={C.primary} />
                <T v="body" style={{ flex: 1 }}>{l}</T>
              </View>
            ))}
          </Card>
        </View>
      ) : null}

      <View style={{ marginTop: 22 }}>
        <T v="overline" color={C.textSecondary}>{t('habits.nudges')}</T>
        <Card style={{ marginTop: 8 }}>
          {!nudges || (nudges.recent.length === 0 && nudges.learned.length === 0) ? <T v="caption" color={C.textSecondary}>{t('habits.no_messages')}</T> : (
            <>
              {nudges.learned.map((l: string, i: number) => <T key={i} v="body" style={{ marginTop: i ? 6 : 0 }}>{l}</T>)}
              {nudges.recent.slice(0, 4).map((n: any, i: number) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 }}>
                  <Ionicons name={n.came_back ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={n.came_back ? C.success : C.textTertiary} />
                  <T v="caption" color={C.textSecondary}>{new Date(n.sent_at).toLocaleDateString()} · {n.channel}</T>
                </View>
              ))}
              <T v="caption" color={C.textTertiary} style={{ marginTop: 10 }}>{nudges.limits}</T>
            </>
          )}
        </Card>
      </View>
    </View>
  );
}
