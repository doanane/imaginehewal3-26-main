import React, { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { theme } from '../../constants/theme';
import api from '../../services/api';
import { Badge, Button, Card, T } from '../ui';
import { Reveal } from '../ui/motion';
import { Ionicons, Pressable, View } from '../themed';
import type { Tr } from './shared';

const C = theme.COLORS;
const AREA_ICON: Record<string, any> = { activity: 'walk-outline', nutrition: 'nutrition-outline', hydration: 'water-outline', sleep: 'moon-outline' };
const fmt = (n: number | null | undefined, unit: string) => (n === null || n === undefined ? '--' : `${Number(n).toLocaleString()} ${unit}`);

/** Goals made for this person: they start from what the person actually does, move toward public guidance in stages, and say why.
 *  Activity and sleep goals can become habit plans in one tap; salt, fibre and water are tracked from the person's own logs. */
export default function GoalsCard({ t, onChange }: { t: Tr; onChange: () => void }) {
  const [g, setG] = useState<any>(null);
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { api.getGoals().then(setG).catch(() => setG(null)); }, []);
  useEffect(load, [load]);
  if (!g || !g.items?.length) return null;

  const habitIds: string[] = g.items.filter((i: any) => i.behavior && i.state !== 'met').map((i: any) => i.id);
  const apply = async () => {
    setBusy(true);
    try {
      const r = await api.applyGoals(habitIds);
      Alert.alert('', r.created?.length ? t('goals.applied', { n: r.created.length }) : t('goals.nothing_new'));
      onChange(); load();
    } catch (e: any) { Alert.alert('', e?.message || ''); }
    finally { setBusy(false); }
  };

  return (
    <Reveal index={2} style={{ marginTop: 18 }}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name="trophy-outline" size={22} color={C.primary} />
          <View style={{ flex: 1 }}><T v="bodyStrong">{t('goals.title')}</T><T v="caption" color={C.textSecondary}>{t('goals.sub')}</T></View>
        </View>
        {g.items.map((i: any) => {
          const down = i.direction === 'down';
          const basis = down ? (i.today ?? i.now) : i.now;
          const pct = basis === null || basis === undefined ? 0 : Math.max(0, Math.min(100, Math.round((down ? basis / i.goal : basis / i.goal) * 100)));
          const over = down && basis !== null && basis !== undefined && basis > i.goal;
          return (
            <View key={i.id} style={{ marginTop: 14 }}>
              <Pressable onPress={() => setOpen(open === i.id ? null : i.id)} accessibilityRole="button" accessibilityLabel={`${i.label}. ${t('goals.tap_why')}`} style={{ minHeight: 44 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name={AREA_ICON[i.area] || 'flag-outline'} size={18} color={C.primary} />
                  <T v="bodyStrong" style={{ flex: 1 }}>{i.label}</T>
                  <Badge label={i.state === 'met' ? t('goals.met') : i.state === 'no_data' ? t('goals.no_data') : t('goals.working')} tone={i.state === 'met' ? 'success' : i.state === 'no_data' ? 'neutral' : 'info'} />
                </View>
                <T v="caption" color={C.textSecondary} style={{ marginTop: 4 }}>
                  {t('goals.now_goal', { now: fmt(i.now, i.unit), goal: fmt(i.goal, i.unit) })}{i.first_goal !== i.goal ? `  ·  ${t('goals.first', { v: fmt(i.first_goal, i.unit) })}` : ''}
                </T>
                <View style={{ height: 6, borderRadius: 3, backgroundColor: C.border, marginTop: 8, overflow: 'hidden' }}>
                  <View style={{ width: `${pct}%`, height: 6, backgroundColor: over ? C.warning : C.primary }} />
                </View>
                {down && i.today !== null && i.today !== undefined ? <T v="caption" color={over ? C.warning : C.textSecondary} style={{ marginTop: 4 }}>{t('goals.today', { v: fmt(i.today, i.unit) })}</T> : null}
              </Pressable>
              {open === i.id ? (
                <View style={{ marginTop: 6 }}>
                  <T v="caption" color={C.textSecondary}>{i.why}</T>
                  <T v="caption" color={C.textSecondary} style={{ marginTop: 4 }}>{t('goals.source')}: {i.source}</T>
                  <T v="caption" color={C.textSecondary} style={{ marginTop: 4 }}>{t('goals.measured')}: {i.measured_by}</T>
                </View>
              ) : null}
            </View>
          );
        })}
        {(g.notes || []).map((n: string, k: number) => <T key={k} v="caption" color={C.textSecondary} style={{ marginTop: 10 }}>{n}</T>)}
        {habitIds.length ? <View style={{ marginTop: 14 }}><Button title={t('goals.use')} onPress={apply} loading={busy} /></View> : null}
        <T v="caption" color={C.textSecondary} style={{ marginTop: 10 }}>{g.limits}</T>
      </Card>
    </Reveal>
  );
}
