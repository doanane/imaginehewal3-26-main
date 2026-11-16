import React, { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { theme } from '../../constants/theme';
import api from '../../services/api';
import { Badge, Banner, Button, Card, Chip, T, TextField } from '../ui';
import { Reveal } from '../ui/motion';
import { Ionicons, Pressable, View } from '../themed';
import { Tr } from './shared';

const C = theme.COLORS;
const KINDS = ['workplace', 'community', 'family'] as const;

export default function SupportTab({ plans, t }: { plans: any[]; t: Tr }) {
  const [eligible, setEligible] = useState<any[]>([]);
  const [shares, setShares] = useState<any[]>([]);
  const [cheers, setCheers] = useState<{ text: string; at: string | null }[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [level, setLevel] = useState<'cheers' | 'progress'>('cheers');
  const [name, setName] = useState('');
  const [kind, setKind] = useState<string>('workplace');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [e, s, c, g] = await Promise.allSettled([api.getBehaviorSupporters(), api.getBehaviorShares(), api.getBehaviorCheers(), api.getBehaviorGroups()]);
    if (e.status === 'fulfilled') setEligible(e.value.eligible);
    if (s.status === 'fulfilled') setShares(s.value.shares);
    if (c.status === 'fulfilled') setCheers(c.value.cheers);
    if (g.status === 'fulfilled') setGroups(g.value.groups);
  }, []);
  useEffect(() => { load(); }, [load]);
  const wrap = (fn: () => Promise<any>) => async () => { try { setError(null); await fn(); await load(); } catch (e: any) { setError(e?.message || ''); } };

  return (
    <View>
      {error ? <Banner tone="warning" text={error} action="OK" onAction={() => setError(null)} /> : null}

      <Reveal index={0}>
        <T v="title">{t('habits.supporter')}</T>
        <T v="body" color={C.textSecondary} style={{ marginTop: 4 }}>{t('habits.supporter_sub')}</T>
        {plans.length === 0 ? null : (
          <Card style={{ marginTop: 12 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <Chip label={t('habits.share_cheers')} selected={level === 'cheers'} onPress={() => setLevel('cheers')} />
              <Chip label={t('habits.share_progress')} selected={level === 'progress'} onPress={() => setLevel('progress')} />
            </View>
            {eligible.length === 0 ? <T v="caption" color={C.textSecondary} style={{ marginTop: 12 }}>{t('habits.no_supporters')}</T> : plans.map(({ plan }) => (
              <View key={plan.id} style={{ marginTop: 14 }}>
                <T v="label" color={C.textSecondary}>{t('habits.share_for', { b: t(`habits.beh.${plan.behavior}`) })}</T>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {eligible.map((p) => {
                    const mine = shares.find((s) => s.plan_id === plan.id && s.supporter_id === p.id);
                    return mine
                      ? <Chip key={p.id} icon="checkmark" label={`${p.name}`} selected onPress={wrap(() => api.stopBehaviorShare(mine.id))} />
                      : <Chip key={p.id} label={p.name} onPress={wrap(() => api.shareBehaviorPlan({ plan_id: plan.id, supporter_id: p.id, level }))} />;
                  })}
                </View>
              </View>
            ))}
            {shares.length > 0 ? <T v="caption" color={C.textTertiary} style={{ marginTop: 12 }}>{shares.map((s) => t('habits.sharing_with', { name: s.supporter })).join(' · ')}. {t('habits.tap_to_stop')}</T> : null}
          </Card>
        )}
      </Reveal>

      <View style={{ marginTop: 22 }}>
        <T v="overline" color={C.textSecondary}>{t('habits.kind_words')}</T>
        <Card style={{ marginTop: 8 }}>
          {cheers.length === 0 ? <T v="caption" color={C.textSecondary}>{t('habits.no_cheers')}</T> : cheers.slice(0, 5).map((c, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 10, marginTop: i ? 10 : 0 }}>
              <Ionicons name="heart" size={18} color={C.primary} /><T v="body" style={{ flex: 1 }}>{c.text}</T>
            </View>
          ))}
        </Card>
      </View>

      <View style={{ marginTop: 22 }}>
        <T v="title">{t('habits.groups')}</T>
        <T v="body" color={C.textSecondary} style={{ marginTop: 4 }}>{t('habits.groups_sub')}</T>
        {groups.map((g, i) => (
          <Reveal key={g.id} index={i} style={{ marginTop: 12 }}>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <T v="heading" style={{ flex: 1 }}>{g.name}</T>
                <Badge label={t(`habits.kind.${g.kind}`)} tone="info" />
              </View>
              <T v="caption" color={C.textSecondary}>{t('habits.members', { n: g.members })}</T>
              {g.visible ? (
                <View style={{ marginTop: 8 }}>
                  <T v="bodyStrong">{t('habits.active_week', { p: g.active_this_week_pct })}</T>
                  {g.average_adherence_pct != null ? <T v="caption" color={C.textSecondary}>{g.average_adherence_pct}%</T> : null}
                </View>
              ) : <T v="caption" color={C.textTertiary} style={{ marginTop: 8 }}>{t('habits.needs_five')}</T>}
              {g.join_code ? <T v="label" color={C.primary} style={{ marginTop: 8 }}>{t('habits.share_code', { c: g.join_code })}</T> : null}
              <Pressable onPress={() => Alert.alert(g.name, '', [{ text: t('habits.cancel'), style: 'cancel' }, { text: t('habits.leave'), style: 'destructive', onPress: wrap(() => api.leaveBehaviorGroup(g.id)) }])}
                accessibilityRole="button" style={{ marginTop: 6, minHeight: 36, justifyContent: 'center' }}><T v="label" color={C.textSecondary}>{t('habits.leave')}</T></Pressable>
            </Card>
          </Reveal>
        ))}
        <Card style={{ marginTop: 14 }}>
          <TextField label={t('habits.group_name')} value={name} onChangeText={setName} maxLength={60} />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
            {KINDS.map((k) => <Chip key={k} label={t(`habits.kind.${k}`)} selected={kind === k} onPress={() => setKind(k)} />)}
          </View>
          <View style={{ marginTop: 10 }}><Button title={t('habits.create_group')} disabled={name.trim().length < 2} onPress={wrap(async () => { await api.createBehaviorGroup(name.trim(), kind); setName(''); })} /></View>
        </Card>
        <Card style={{ marginTop: 12 }}>
          <TextField label={t('habits.code')} value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" maxLength={8} />
          <View style={{ marginTop: 10 }}><Button title={t('habits.join_group')} variant="secondary" disabled={code.trim().length < 4} onPress={wrap(async () => { await api.joinBehaviorGroup(code.trim()); setCode(''); })} /></View>
        </Card>
      </View>
    </View>
  );
}
