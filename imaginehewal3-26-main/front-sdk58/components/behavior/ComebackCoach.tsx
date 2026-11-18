import React, { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { theme } from '../../constants/theme';
import api from '../../services/api';
import { Badge, Button, Card, Chip, T } from '../ui';
import { TimeField } from '../TimePicker';
import { Reveal } from '../ui/motion';
import { Ionicons, View } from '../themed';
import type { Tr } from './shared';

const C = theme.COLORS;
type Step = 'start' | 'barrier' | 'options' | 'done';

/** The comeback coach. Appears after 3 days away. It opens without blame, asks what got in the way, offers up to three ways back ordered for that
 *  cause, writes an if-then plan and a relapse-prevention plan, and remembers the choice so we can learn which options really bring people back. */
export default function ComebackCoach({ t, onChange, onOpenSupport }: { t: Tr; onChange: () => void; onOpenSupport?: () => void }) {
  const [d, setD] = useState<any>(null);
  const [step, setStep] = useState<Step>('start');
  const [barrier, setBarrier] = useState<string | null>(null);
  const [opts, setOpts] = useState<any>(null);
  const [when, setWhen] = useState<string | null>(null);          // HH:MM, picked by the person
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { api.getComeback().then(setD).catch(() => setD(null)); }, []);
  useEffect(load, [load]);
  if (!d || !d.needed) return null;

  const label = (id: string, fallback: string) => { const k = `habits.barrier.${id}`; const v = t(k); return v && v !== k ? v : fallback; };
  const pick = async (id: string) => {
    setBarrier(id); setBusy(true);
    try { setOpts(await api.getComeback(id)); setStep('options'); } catch (e: any) { Alert.alert('', e?.message || ''); } finally { setBusy(false); }
  };
  const choose = async (option: string) => {
    if (!barrier) return;
    if (option === 'retime' && !when) { Alert.alert('', t('cb.pick_time')); return; }
    setBusy(true);
    try {
      const r = await api.chooseComeback(barrier, option, option === 'retime' ? when || undefined : undefined);
      setResult({ ...r, relapse: opts?.relapse_plan || [], safety: opts?.safety });
      setStep('done'); onChange();
      if (r.open === 'support') onOpenSupport?.();
    } catch (e: any) { Alert.alert('', e?.message || ''); } finally { setBusy(false); }
  };

  return (
    <Reveal index={0} style={{ marginTop: 14 }}>
      <Card tone="soft">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name="heart-outline" size={22} color={C.primary} />
          <View style={{ flex: 1 }}><T v="bodyStrong">{t('cb.title')}</T><T v="caption" color={C.textSecondary}>{t('cb.sub', { n: d.missed_days })}</T></View>
        </View>
        <T v="body" style={{ marginTop: 10 }}>{d.opening}</T>

        {step === 'start' ? <View style={{ marginTop: 12 }}><Button title={t('cb.begin')} onPress={() => setStep('barrier')} /></View> : null}

        {step === 'barrier' ? (
          <View style={{ marginTop: 12 }}>
            <T v="label" color={C.textSecondary}>{t('cb.ask')}</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {d.barriers.map((b: any) => <Chip key={b.id} label={label(b.id, b.label)} selected={barrier === b.id} onPress={() => pick(b.id)} />)}
            </View>
          </View>
        ) : null}

        {step === 'options' && opts?.options ? (
          <View style={{ marginTop: 12, gap: 10 }}>
            {opts.safety ? <T v="caption" color={C.warning}>{opts.safety}</T> : null}
            <T v="label" color={C.textSecondary}>{t('cb.ways')}</T>
            {opts.options.map((o: any) => (
              <Card key={o.id}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <T v="bodyStrong" style={{ flex: 1 }}>{o.label}</T>
                  {o.recommended ? <Badge label={t('cb.best')} tone="success" /> : null}
                </View>
                <T v="caption" color={C.textSecondary} style={{ marginTop: 4 }}>{o.detail}</T>
                {o.evidence ? <T v="caption" color={C.textSecondary} style={{ marginTop: 4 }}>{o.evidence}</T> : null}
                {o.id === 'retime' ? <View style={{ marginTop: 8 }}><TimeField value={when} placeholder={t('time.pick')} onChange={setWhen} /></View> : null}
                <View style={{ marginTop: 10 }}><Button title={t('cb.choose')} variant={o.recommended ? 'primary' : 'secondary'} onPress={() => choose(o.id)} loading={busy} /></View>
              </Card>
            ))}
            <T v="caption" color={C.textSecondary}>{opts.limits}</T>
          </View>
        ) : null}

        {step === 'done' && result ? (
          <View style={{ marginTop: 12, gap: 8 }}>
            <Badge label={t('cb.done')} tone="success" />
            <T v="body">{result.message}</T>
            <T v="label" color={C.textSecondary}>{t('cb.plan')}</T>
            <T v="body">{result.if_then}</T>
            <T v="label" color={C.textSecondary} style={{ marginTop: 6 }}>{t('cb.relapse')}</T>
            {(result.relapse || []).map((r: string, i: number) => <T key={i} v="caption" color={C.textSecondary}>• {r}</T>)}
            {result.safety ? <T v="caption" color={C.warning}>{result.safety}</T> : null}
          </View>
        ) : null}
      </Card>
    </Reveal>
  );
}
