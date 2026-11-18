import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Share } from 'react-native';
import { theme } from '../../constants/theme';
import api from '../../services/api';
import { Badge, Button, Card, TextField, T } from '../ui';
import { Reveal } from '../ui/motion';
import { View } from '../themed';
import RemindersCard from './RemindersCard';
import { TimeField } from '../TimePicker';
import { Choice, EVIDENCE_TONE, SwitchRow, Tr } from './shared';

const C = theme.COLORS;
const SEGMENTS = ['chronic', 'sedentary', 'young_adult', 'adult', 'older_adult'] as const;
const LANGS = [{ v: 'en', label: 'English' }, { v: 'fr', label: 'Français' }, { v: 'ar', label: 'العربية' }];

export default function YouTab({ settings, approaches, onChange, t }: { settings: any; approaches: any; onChange: () => void; t: Tr }) {
  const [ctx, setCtx] = useState<any>(null);
  const [reason, setReason] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [canSeed, setCanSeed] = useState(false);            // sample history exists only on servers that are not in production

  useEffect(() => { api.getSystemCard().then((c: any) => setCanSeed(!!c && c.environment !== 'production')).catch(() => setCanSeed(false)); }, []);
  useEffect(() => { api.getBehaviorContext().then((c) => { setCtx(c); setReason(c.motivation_text || ''); }).catch(() => {}); }, []);
  const saveCtx = useCallback(async (patch: Record<string, unknown>) => {
    try { const c = await api.updateBehaviorContext(patch); setCtx(c); onChange(); } catch (e: any) { Alert.alert('', e?.message || ''); }
  }, [onChange]);
  const saveSettings = async (patch: Record<string, unknown>) => { try { await api.updateBehaviorSettings(patch); onChange(); } catch (e: any) { Alert.alert('', e?.message || ''); } };
  const opts = (key: string, ids: string[]) => ids.map((id) => ({ v: id, label: t(`habits.opt.${id}`) }));

  const exportAll = async () => {
    try { const data = await api.exportBehaviorData(); await Share.share({ message: JSON.stringify(data, null, 2), title: 'HEWAL3 habits' }); }
    catch (e: any) { Alert.alert('', e?.message || ''); }
  };
  const erase = () => Alert.alert(t('habits.erase_title'), t('habits.erase_text'), [
    { text: t('habits.cancel'), style: 'cancel' },
    { text: t('habits.delete'), style: 'destructive', onPress: async () => { await api.deleteBehaviorData(); onChange(); } },
  ]);

  return (
    <View>
      <RemindersCard t={t} />
      <Reveal index={0}>
        <T v="title">{t('habits.about_you')}</T>
        <T v="body" color={C.textSecondary} style={{ marginTop: 4 }}>{t('habits.about_sub')}</T>
        {ctx ? (
          <Card style={{ marginTop: 12 }}>
            <Choice label={t('habits.q.segment')} value={ctx.segment || ctx.segment_resolved} options={SEGMENTS.map((id) => ({ v: id, label: t(`habits.seg.${id}`) + (!ctx.segment && ctx.segment_suggested === id ? ` (${t('habits.seg.auto')})` : '') }))} onChange={(v) => saveCtx({ segment: v })} />
            <T v="caption" color={C.textSecondary} style={{ marginTop: 6 }}>{t('habits.seg.note')}</T>
            <Choice label={t('habits.q.region')} value={ctx.region} options={['gh', 'ae'].map((id) => ({ v: id, label: t(`habits.region.${id}`) }))} onChange={(v) => saveCtx({ region: v })} />
            {ctx.region === 'ae' ? <SwitchRow label={t('habits.q.prayer')} sub={t('habits.prayer_sub')} value={!!ctx.respect_prayer} onChange={(v) => saveCtx({ respect_prayer: v })} /> : null}
            <View style={{ marginTop: 14 }}>
              <TimeField label={t('habits.q.time')} value={ctx.preferred_clock} placeholder={t('time.none')} onChange={(v) => saveCtx({ preferred_clock: v })} />
              {ctx.preferred_clock ? <View style={{ marginTop: 6 }}><Button title={t('time.clear')} variant="ghost" onPress={() => saveCtx({ preferred_clock: '' })} /></View> : null}
            </View>
            <Choice label={t('habits.q.work')} value={ctx.work_pattern} options={opts('work', ['regular', 'desk', 'shift', 'irregular', 'not_working'])} onChange={(v) => saveCtx({ work_pattern: v })} />
            <Choice label={t('habits.q.mobility')} value={ctx.mobility} options={opts('mobility', ['full', 'limited', 'wheelchair'])} onChange={(v) => saveCtx({ mobility: v })} />
            <Choice label={t('habits.q.support')} value={ctx.support} options={opts('support', ['alone', 'family', 'friend', 'workplace'])} onChange={(v) => saveCtx({ support: v })} />
            <Choice label={t('habits.q.ready')} value={ctx.readiness} options={[1, 2, 3, 4, 5].map((n) => ({ v: n, label: t(`habits.ready.${n}`) }))} onChange={(v) => saveCtx({ readiness: v })} />
            <SwitchRow label={t('habits.q.simple')} value={ctx.literacy === 'simple'} onChange={(v) => saveCtx({ literacy: v ? 'simple' : 'standard' })} />
            <TextField label={t('habits.q.reason')} value={reason} onChangeText={setReason} onEndEditing={() => saveCtx({ motivation_text: reason })} placeholder={t('habits.q.reason_ph')} maxLength={200} />
          </Card>
        ) : null}
        {ctx?.today && ctx.region === 'ae' ? <RegionCard today={ctx.today} t={t} /> : null}
      </Reveal>

      {settings ? (
        <View style={{ marginTop: 24 }}>
          <T v="title">{t('habits.you_control')}</T>
          <Card style={{ marginTop: 12 }}>
            <SwitchRow label={t('habits.reminders')} value={!!settings.notifications_enabled} onChange={(v) => saveSettings({ notifications_enabled: v })} />
            {settings.notifications_enabled ? (
              <>
                <Choice label={t('habits.channel')} value={settings.reengage_channel} options={['push', 'in_app', 'none'].map((c) => ({ v: c, label: t(`habits.ch.${c}`) }))} onChange={(v) => saveSettings({ reengage_channel: v })} />
                <Choice label={t('habits.weekly_cap')} value={settings.max_nudges_per_week} options={[1, 2, 3, 5].map((n) => ({ v: n, label: String(n) }))} onChange={(v) => saveSettings({ max_nudges_per_week: v })} />
              </>
            ) : null}
            <SwitchRow label={t('habits.wearable')} value={!!settings.wearable_data_enabled} onChange={(v) => saveSettings({ wearable_data_enabled: v })} />
            <SwitchRow label={t('habits.gamification')} value={!!settings.gamification_enabled} onChange={(v) => saveSettings({ gamification_enabled: v })} />
            <SwitchRow label={t('habits.share_doctor')} value={!!settings.share_with_doctor} onChange={(v) => saveSettings({ share_with_doctor: v })} />
            <Choice label={t('habits.language')} value={settings.language} options={LANGS} onChange={(v) => saveSettings({ language: v })} />
            <T v="caption" color={C.textTertiary} style={{ marginTop: 8 }}>{t('habits.language_note')}</T>
          </Card>
        </View>
      ) : null}

      {approaches ? (
        <View style={{ marginTop: 24 }}>
          <T v="title">{t('habits.how_works')}</T>
          <T v="body" color={C.textSecondary} style={{ marginTop: 4 }}>{t('habits.how_sub')}</T>
          {approaches.approaches.map((a: any, i: number) => (
            <Reveal key={a.id} index={Math.min(i, 6)} style={{ marginTop: 10 }}>
              <Card onPress={() => setOpen(open === a.id ? null : a.id)}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <T v="bodyStrong" style={{ flex: 1 }}>{a.name}</T>
                  <Badge label={a.enabled ? t('habits.on') : t('habits.off')} tone={a.enabled ? 'success' : 'neutral'} />
                </View>
                {open === a.id ? (
                  <View style={{ marginTop: 10 }}>
                    <T v="label" color={C.textSecondary}>{t('habits.why_it_works')}</T>
                    <T v="body">{a.why_it_works}</T>
                    <T v="label" color={C.textSecondary} style={{ marginTop: 8 }}>{t('habits.limits')}</T>
                    <T v="body">{a.limits}</T>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                      <Badge label={`${a.bct_name} (${a.bct_code})`} tone="neutral" />
                      <Badge label={`${t('habits.evidence')}: ${t(`habits.evidence.${a.evidence}`)}`} tone={EVIDENCE_TONE[a.evidence] || 'neutral'} />
                    </View>
                    <T v="caption" color={C.textTertiary} style={{ marginTop: 8 }}>{a.control}</T>
                  </View>
                ) : null}
              </Card>
            </Reveal>
          ))}
          {approaches.commitments.map((c: string, i: number) => <T key={i} v="caption" color={C.textSecondary} style={{ marginTop: 8 }}>• {c}</T>)}
        </View>
      ) : null}

      <View style={{ marginTop: 24 }}>
        <T v="title">{t('habits.your_data')}</T>
        <T v="caption" color={C.textSecondary} style={{ marginTop: 4 }}>{t('habits.guarantee')}</T>
        <View style={{ gap: 10, marginTop: 12 }}>
          <Button title={t('habits.export')} variant="secondary" icon="download-outline" onPress={exportAll} />
          <Button title={t('habits.erase')} variant="danger" icon="trash-outline" onPress={erase} />
          {canSeed ? <Button title="Load sample history (test servers only)" variant="ghost" icon="flask-outline"
            onPress={async () => { try { await api.seedBehaviorDemo(); onChange(); } catch (e: any) { Alert.alert('', e?.message || ''); } }} /> : null}
        </View>
      </View>
    </View>
  );
}


/** What is true today in the person's region, from the server. Estimates are labelled as estimates. */
function RegionCard({ today, t }: { today: any; t: Tr }) {
  const lines: string[] = [];
  if (today.ramadan?.is_ramadan) lines.push(t('habits.gulf.ramadan', { d: today.ramadan.day }));
  if (today.day_kind === 'weekend') lines.push(t('habits.gulf.weekend'));
  else if (today.day_kind === 'short_friday') lines.push(t('habits.gulf.friday'));
  if (today.heat === 'extreme') lines.push(t('habits.gulf.heat_extreme'));
  else if (today.heat === 'hot') lines.push(t('habits.gulf.heat_hot'));
  const pt = today.prayer_times;
  const e = today.emergency || {};
  return (
    <Card style={{ marginTop: 12 }}>
      <T v="heading">{t('habits.gulf.title')}</T>
      {lines.map((l) => <T key={l} v="body" style={{ marginTop: 6 }}>{l}</T>)}
      {pt ? <T v="caption" color={C.textSecondary} style={{ marginTop: 8 }}>{`${t('habits.gulf.prayer')}: Fajr ${pt.fajr}, Dhuhr ${pt.dhuhr}, Asr ${pt.asr}, Maghrib ${pt.maghrib}, Isha ${pt.isha}`}</T> : null}
      {e.ambulance ? <T v="caption" color={C.textSecondary} style={{ marginTop: 6 }}>{t('habits.gulf.emergency', { a: e.ambulance, p: e.police })}</T> : null}
    </Card>
  );
}
