import React, { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { theme } from '../../constants/theme';
import api from '../../services/api';
import { Badge, Button, Card, T } from '../ui';
import { Reveal } from '../ui/motion';
import { Ionicons, Pressable, View } from '../themed';
import type { Tr } from './shared';

const C = theme.COLORS;
const TONE = { ok: 'success', declining: 'warning', lapse: 'danger' } as const;

/** One labelled row of the loop (what it noticed, why, what it does, who looks next, did it work). */
function Row({ icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
      <View style={{ width: 30, height: 30, borderRadius: 10, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={16} color={C.primary} /></View>
      <View style={{ flex: 1, minWidth: 0 }}><T v="overline" color={C.primary}>{title}</T>{children}</View>
    </View>
  );
}

/** The care agent, in plain words: what it noticed, why it chose what it chose, what it does, and who looks next.
 *  Shown on the Today tab so a message never arrives without a reason. The person can make the step smaller or stop messages in one tap. */
export default function AgentCard({ t, onChange }: { t: Tr; onChange: () => void }) {
  const [d, setD] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { api.getAgentLoop().then(setD).catch(() => setD(null)); }, []);
  useEffect(load, [load]);
  if (!d || !d.has_plan) return null;

  const act = async (a: 'smaller' | 'stop_messages' | 'not_helpful') => {
    setBusy(true);
    try { const r = await api.actAgent(a); Alert.alert('', r?.message || ''); load(); onChange(); }
    catch (e: any) { Alert.alert('', e?.message || ''); }
    finally { setBusy(false); }
  };
  const state: 'ok' | 'declining' | 'lapse' = d.state;
  const actLabel = d.act.status === 'send' ? t('agent.sends') : d.act.status === 'waiting' ? t('agent.waiting') : t('agent.nothing');

  return (
    <Reveal index={0} style={{ marginTop: 14 }}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name="hardware-chip-outline" size={22} color={C.primary} />
          <View style={{ flex: 1 }}><T v="bodyStrong">{t('agent.title')}</T><T v="caption" color={C.textSecondary}>{t('agent.sub')}</T></View>
        </View>
        <View style={{ marginTop: 10, flexDirection: 'row' }}><Badge label={t(`agent.state.${state}`, { n: d.missed_days })} tone={TONE[state]} /></View>

        <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" accessibilityLabel={open ? t('agent.hide') : t('agent.how')} style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 }}>
          <T v="bodyStrong" color={C.primary}>{open ? t('agent.hide') : t('agent.how')}</T>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={C.primary} />
        </Pressable>

        {open ? (
          <View>
            <Row icon="eye-outline" title={t('agent.sense')}>
              {d.sense.map((s: any) => <T key={s.code} v="caption" color={C.textSecondary}>{s.label}: {s.value}</T>)}
            </Row>
            <Row icon="git-branch-outline" title={t('agent.decide')}>
              {d.decide.reasons.map((r: any) => <T key={r.code} v="caption" color={C.textSecondary}>{r.text}</T>)}
              {d.decide.plan?.text ? <T v="caption" color={C.textSecondary}>{d.decide.plan.text}</T> : null}
              <T v="caption" color={C.textSecondary}>{t('agent.method')}</T>
            </Row>
            <Row icon="paper-plane-outline" title={`${t('agent.act')}: ${actLabel}`}>
              {d.act.message ? <T v="body">“{d.act.message}”</T> : null}
            </Row>
            <Row icon="medkit-outline" title={t('agent.hand')}>
              <T v="caption" color={C.textSecondary}>{d.handoff.needed ? t('agent.clinician', { who: d.handoff.to || '' }) : t('agent.no_clinician')}</T>
            </Row>
            <Row icon="analytics-outline" title={t('agent.measure')}><T v="caption" color={C.textSecondary}>{d.measure.text}</T></Row>
            <View style={{ gap: 8, marginTop: 14 }}>
              <Button title={t('agent.smaller')} variant="secondary" onPress={() => act('smaller')} disabled={busy} />
              <Button title={t('agent.not_helpful')} variant="secondary" onPress={() => act('not_helpful')} disabled={busy} />
              <Button title={t('agent.stop')} variant="secondary" onPress={() => act('stop_messages')} disabled={busy} />
            </View>
            <T v="caption" color={C.textSecondary} style={{ marginTop: 10 }}>{t('agent.if_wrong')}</T>
          </View>
        ) : null}
      </Card>
    </Reveal>
  );
}
