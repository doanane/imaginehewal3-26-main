import React, { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { theme } from '../../constants/theme';
import api from '../../services/api';
import { applyHabitReminders, habitRemindersAvailable } from '../../services/habitReminders';
import { Badge, Card, Chip, T } from '../ui';
import { TimeField } from '../TimePicker';
import { Reveal } from '../ui/motion';
import { Ionicons, View } from '../themed';
import type { Tr } from './shared';

const C = theme.COLORS;

/** Reminders that learn. The time follows when the person actually checks in, avoids quiet hours and prayer time, and if reminders are ignored they
 *  slow down and then pause, instead of nagging. The person can fix the time or switch them off at any moment. Scheduled on the phone itself. */
export default function RemindersCard({ t }: { t: Tr }) {
  const [p, setP] = useState<any>(null);
  const [choosing, setChoosing] = useState(false);          // the person pressed "I choose the time" and has not picked one yet
  const text = { title: t('rem.notice_title'), body: t('rem.notice_body') };
  const sync = useCallback(async (plan: any, ask = false) => {
    if (habitRemindersAvailable()) await applyHabitReminders(plan, text, { ask });
  }, []);                                                   // eslint-disable-line react-hooks/exhaustive-deps
  const load = useCallback(() => { api.getReminderPlan().then((r) => { setP(r); sync(r); }).catch(() => setP(null)); }, [sync]);
  useEffect(load, [load]);
  if (!p) return null;

  const set = async (mode: 'auto' | 'off' | 'fixed', time?: string) => {
    try { const r = await api.setReminderSettings(mode, time); setP(r); setChoosing(false); await sync(r, true); }
    catch (e: any) { Alert.alert('', e?.message || ''); }
  };
  const mode = p.settings?.mode || 'auto';
  const freq = p.frequency === 'every_other_day' ? t('rem.every_other') : p.frequency === 'paused' ? t('rem.paused') : p.frequency === 'off' ? t('rem.off') : t('rem.daily');

  return (
    <Reveal index={0} style={{ marginTop: 14 }}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name="alarm-outline" size={22} color={C.primary} />
          <View style={{ flex: 1 }}><T v="bodyStrong">{t('rem.title')}</T><T v="caption" color={C.textSecondary}>{t('rem.sub')}</T></View>
          <Badge label={p.enabled ? `${p.time} · ${freq}` : freq} tone={p.enabled ? 'success' : 'neutral'} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <Chip label={t('rem.auto')} selected={mode === 'auto' && !choosing} onPress={() => { setChoosing(false); set('auto'); }} />
          <Chip label={t('rem.fixed')} selected={mode === 'fixed' || choosing} onPress={() => setChoosing(true)} />
          <Chip label={t('rem.off_chip')} selected={mode === 'off' && !choosing} onPress={() => { setChoosing(false); set('off'); }} />
        </View>
        {mode === 'fixed' || choosing ? (
          <View style={{ marginTop: 10 }}>
            <TimeField label={t('rem.pick')} value={mode === 'fixed' ? p.settings?.time : null} placeholder={t('time.pick')} onChange={(v) => set('fixed', v)} />
          </View>
        ) : null}
        <T v="overline" color={C.primary} style={{ marginTop: 14 }}>{t('rem.why')}</T>
        {(p.why || []).map((w: string, i: number) => <T key={i} v="caption" color={C.textSecondary} style={{ marginTop: 4 }}>{w}</T>)}
        {p.observed ? <T v="caption" color={C.textSecondary} style={{ marginTop: 6 }}>{t('rem.observed', { a: p.observed.answered, d: p.observed.days })}</T> : null}
        {p.how_it_learns ? <T v="caption" color={C.textSecondary} style={{ marginTop: 6 }}>{p.how_it_learns}</T> : null}
        {!habitRemindersAvailable() ? <T v="caption" color={C.warning} style={{ marginTop: 6 }}>{t('rem.needs_build')}</T> : null}
      </Card>
    </Reveal>
  );
}
