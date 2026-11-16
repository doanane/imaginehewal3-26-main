import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert, Platform } from 'react-native';
import Svg from 'react-native-svg';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { Banner, Button, Card, Screen, ScreenHeader, Section, T } from '../../../components/ui';
import { theme } from '../../../constants/theme';
import api, { SleepNight, SleepReport } from '../../../services/api';
import { readWeightAndSleep } from '../../../services/healthkit';
import { Ionicons, Pressable, Rect, View } from '../../../components/themed';

const C = theme.COLORS;
type Stage = 'awake' | 'rem' | 'light' | 'deep';
const ROWS: Stage[] = ['awake', 'rem', 'light', 'deep'];
const STAGE_COLOR: Record<Stage, string> = { awake: '#E8913A', rem: '#8B7BE0', light: '#7FB6E8', deep: '#2F5FB3' };
const STAGE_LABEL: Record<Stage, string> = { awake: 'Awake', rem: 'REM', light: 'Light', deep: 'Deep' };
const hm = (m: number) => `${Math.floor(m / 60)}h ${String(Math.round(m % 60)).padStart(2, '0')}m`;
const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

function Hypnogram({ night, width }: { night: SleepNight; width: number }) {
  const stages = night.stages ?? [];
  if (!stages.length || width <= 0) return null;
  const t0 = new Date(night.start).getTime(), span = Math.max(1, new Date(night.end).getTime() - t0), rowH = 26, h = rowH * 4;
  return (
    <Svg width={width} height={h} accessibilityLabel="Sleep stages through the night">
      {ROWS.map((r, i) => <Rect key={r} x={0} y={i * rowH + 3} width={width} height={rowH - 6} rx={6} fill="#F2F6F7" />)}
      {stages.map((s, i) => {
        const x = ((new Date(s.start).getTime() - t0) / span) * width, w = Math.max(2, ((new Date(s.end).getTime() - new Date(s.start).getTime()) / span) * width);
        return <Rect key={i} x={x} y={ROWS.indexOf(s.stage) * rowH + 3} width={w} height={rowH - 6} rx={6} fill={STAGE_COLOR[s.stage]} />;
      })}
    </Svg>
  );
}

function Stepper({ label, text, onMinus, onPlus }: { label: string; text: string; onMinus: () => void; onPlus: () => void }) {
  const B = ({ icon, f, a }: { icon: 'add' | 'remove'; f: () => void; a: string }) => (
    <Pressable onPress={f} accessibilityRole="button" accessibilityLabel={a} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={22} color={C.primary} /></Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 }}>
      <T v="body">{label}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}><B icon="remove" f={onMinus} a={`Decrease ${label}`} /><T v="bodyStrong" style={{ minWidth: 70, textAlign: 'center' }}>{text}</T><B icon="add" f={onPlus} a={`Increase ${label}`} /></View>
    </View>
  );
}

export default function SleepScreen() {
  const router = useRouter();
  const [rep, setRep] = useState<SleepReport | null>(null);
  const [w, setW] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [bed, setBed] = useState(23 * 60);          // minutes after midnight
  const [dur, setDur] = useState(7.5 * 60);

  const load = useCallback(async () => { try { setRep(await api.getSleepReport(14)); } catch (e: any) { setErr(e.message); } }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const saveManual = async () => {
    setBusy(true); setErr(null);
    try {
      const now = new Date(), start = new Date(now); start.setHours(0, 0, 0, 0);
      start.setMinutes(bed);
      if (bed >= 12 * 60 || start.getTime() + dur * 60e3 > now.getTime()) start.setDate(start.getDate() - 1);
      const end = new Date(start.getTime() + dur * 60e3);
      if (end.getTime() > now.getTime()) throw new Error('That night has not finished yet.');
      await api.logSleep({ start: start.toISOString(), end: end.toISOString(), source: 'manual' });
      await load();
    } catch (e: any) { setErr(e.message || 'Could not save.'); } finally { setBusy(false); }
  };

  const importHealth = async () => {
    setBusy(true); setErr(null);
    try {
      const { nights } = await readWeightAndSleep();
      if (!nights.length) { Alert.alert('No sleep data found', Platform.OS === 'ios' ? 'Apple Health has no sleep from the last three weeks that this app may read. Open the Health app, then Sharing, then Apps, then HEWAL3, and allow Sleep. A watch or a sleep app must also be writing sleep to Apple Health.' : 'This needs Apple Health on an iPhone. You can log sleep by hand below.'); return; }
      await api.importSleepFromHealth(nights); api.invalidateApiCache(); await load();
    } catch (e: any) { setErr(e.message || 'Could not read Apple Health.'); } finally { setBusy(false); }
  };

  const last = rep?.last;
  const total = last ? Math.max(1, last.awake_min + last.light_min + last.deep_min + last.rem_min) : 1;
  const fmtBed = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  return (
    <ProtectedRoute>
      <Screen header={<ScreenHeader title="Sleep" subtitle="Stages, score and advice" onBack={() => router.back()} />} contentStyle={{ paddingBottom: 48 }}>
        {err ? <Banner tone="danger" text={err} /> : null}
        {last ? (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View><T v="caption" color={C.textSecondary}>Last night</T><T v="title" style={{ fontSize: 34, lineHeight: 42 }}>{hm(last.total_min)}</T><T v="caption" color={C.textSecondary}>{clock(last.start)} to {clock(last.end)}</T></View>
              {last.score != null ? <View style={{ alignItems: 'center' }}><T v="title" color={C.primary} style={{ fontSize: 40, lineHeight: 46 }}>{last.score}</T><T v="caption" color={C.textSecondary}>Sleep score</T></View> : null}
            </View>
            {last.has_stages ? (
              <View style={{ marginTop: 16 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
                <Hypnogram night={last} width={w} />
                <View style={{ flexDirection: 'row', marginTop: 14, flexWrap: 'wrap', rowGap: 10 }}>
                  {ROWS.map((r) => {
                    const m = r === 'awake' ? last.awake_min : r === 'rem' ? last.rem_min : r === 'light' ? last.light_min : last.deep_min;
                    return (
                      <View key={r} style={{ width: '50%' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: STAGE_COLOR[r] }} /><T v="caption" color={C.textSecondary}>{STAGE_LABEL[r]}</T></View>
                        <T v="bodyStrong">{hm(m)} <T v="caption" color={C.textSecondary}>{Math.round((m / total) * 100)}%</T></T>
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : <View style={{ marginTop: 12 }}><Banner tone="info" text={rep?.stage_note || 'Sleep stages need a watch or a sleep app that records them. This night has duration only.'} /></View>}
          </Card>
        ) : <Card><T v="body" color={C.textSecondary}>No sleep logged yet. Import it from Apple Health or add last night below.</T></Card>}

        {(rep?.advice ?? []).length ? (
          <Section title="Advice for you">
            {rep!.advice.map((a, i) => <View key={i} style={{ marginBottom: 10 }}><Banner tone="info" text={a} /></View>)}
          </Section>
        ) : null}

        {rep?.avg_hours != null ? (
          <Section title="Last 14 nights">
            <Card>
              <View style={{ flexDirection: 'row' }}>
                <View style={{ flex: 1 }}><T v="bodyStrong">{rep.avg_hours} h</T><T v="caption" color={C.textSecondary}>Average</T></View>
                <View style={{ flex: 1 }}><T v="bodyStrong">{rep.avg_deep_pct != null ? `${rep.avg_deep_pct}%` : '--'}</T><T v="caption" color={C.textSecondary}>Deep sleep</T></View>
                <View style={{ flex: 1 }}><T v="bodyStrong">{rep.bedtime_spread_min != null ? `${rep.bedtime_spread_min} min` : '--'}</T><T v="caption" color={C.textSecondary}>Bedtime spread</T></View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 90, gap: 5, marginTop: 16 }}>
                {[...rep.nights].reverse().map((n) => (
                  <View key={n.id} style={{ flex: 1, height: `${Math.min(100, (n.total_min / 600) * 100)}%`, borderRadius: 6, backgroundColor: n.total_min >= 420 ? '#2F5FB3' : '#BFD1EA' }} accessibilityLabel={`${hm(n.total_min)}`} />
                ))}
              </View>
              <T v="caption" color={C.textTertiary} style={{ marginTop: 8 }}>Dark bars are 7 hours or more.</T>
            </Card>
          </Section>
        ) : null}

        <Section title="From Apple Health">
          <Card>
            <T v="caption" color={C.textSecondary}>Sleep is read from Apple Health automatically whenever the app opens. Nothing to type. Use this to check right now.</T>
            <Button title="Check Apple Health now" icon="download-outline" variant="secondary" onPress={importHealth} loading={busy} style={{ marginTop: 12 }} />
          </Card>
        </Section>
        <Section title="Only if you have no watch: log by hand">
          <Card>
            <Stepper label="Went to bed" text={fmtBed(bed)} onMinus={() => setBed((b) => (b - 15 + 1440) % 1440)} onPlus={() => setBed((b) => (b + 15) % 1440)} />
            <Stepper label="Slept for" text={hm(dur)} onMinus={() => setDur((d) => Math.max(60, d - 15))} onPlus={() => setDur((d) => Math.min(16 * 60, d + 15))} />
            <Button title="Save sleep" onPress={saveManual} loading={busy} style={{ marginTop: 12 }} />
            <T v="caption" color={C.textTertiary} style={{ marginTop: 8 }}>Manual entries have no stages, because stages cannot be known without a sensor.</T>
          </Card>
        </Section>
      </Screen>
    </ProtectedRoute>
  );
}
