import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useRealtimeReload } from '../../components/CareParts';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Badge, Banner, Button, Chip, IconName, Screen, ScreenHeader, Skeleton, T, TextField } from '../../components/ui';
import { Glass, GlassBackdrop } from '../../components/ui/Glass';
import { Ionicons, View } from '../../components/themed';
import { theme } from '../../constants/theme';
import { checkDiabetesRisk, checkHeat, DiabetesResult, getMyWorkplaces, getScreenings, HeatResult, joinWorkplace, leaveWorkplace, MyWorkplace, Screening } from '../../services/api';

const C = theme.COLORS;
const BAND: Record<string, { label: string; tone: 'success' | 'info' | 'warning' | 'danger' }> = {
  low: { label: 'Low', tone: 'success' }, slightly_elevated: { label: 'Slightly raised', tone: 'info' }, moderate: { label: 'Moderate', tone: 'warning' }, high: { label: 'High', tone: 'danger' }, very_high: { label: 'Very high', tone: 'danger' },
};
const HEAT: Record<string, 'success' | 'info' | 'warning' | 'danger'> = { low: 'success', caution: 'info', extreme_caution: 'warning', danger: 'danger', extreme_danger: 'danger' };
const num = (s: string) => { const n = parseFloat(s.replace(',', '.')); return Number.isFinite(n) ? n : undefined; };

function Block({ icon, title, sub, children }: { icon: IconName; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <Glass radius={24} style={{ padding: 16, gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={icon} size={20} color={C.primary} /></View>
        <View style={{ flex: 1 }}><T v="heading">{title}</T>{sub ? <T v="caption" color={C.textSecondary}>{sub}</T> : null}</View>
      </View>
      {children}
    </Glass>
  );
}

const YesNo = ({ label, value, onChange }: { label: string; value: boolean | null; onChange: (v: boolean) => void }) => (
  <View style={{ gap: 6 }}>
    <T v="label" color={C.textSecondary}>{label}</T>
    <View style={{ flexDirection: 'row', gap: 8 }}><Chip label="Yes" selected={value === true} onPress={() => onChange(true)} /><Chip label="No" selected={value === false} onPress={() => onChange(false)} /></View>
  </View>
);

/** Prevention: checks that suit your age, a type 2 diabetes risk questionnaire and a heat check for people who work outdoors. General guidance, never a diagnosis. */
export default function Prevention() {
  const router = useRouter();
  const [screen, setScreen] = useState<Screening[] | null>(null);
  const [sNote, setSNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState<{ waist: string; active: boolean | null; veg: boolean | null; bp: boolean | null; gl: boolean | null; family: string }>({ waist: '', active: null, veg: null, bp: null, gl: null, family: 'none' });
  const [risk, setRisk] = useState<DiabetesResult | null>(null);
  const [riskErr, setRiskErr] = useState<string | null>(null);
  const [h, setH] = useState({ temp: '', rh: '', effort: 'light', sun: false });
  const [heat, setHeat] = useState<HeatResult | null>(null);
  const [heatErr, setHeatErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<'risk' | 'heat' | 'join' | null>(null);
  const [sites, setSites] = useState<MyWorkplace[]>([]);
  const [code, setCode] = useState('');
  const [joinErr, setJoinErr] = useState<string | null>(null);
  const loadSites = useCallback(() => { getMyWorkplaces().then((r) => setSites(r.workplaces)).catch(() => {}); }, []);
  useRealtimeReload(loadSites, ['workplace.update', 'notification.new']);

  useFocusEffect(useCallback(() => {
    loadSites();
    getScreenings().then((r) => { setScreen(r.screenings); setSNote(r.note); setError(null); }).catch((e) => { setError(e?.message || 'Could not load.'); setScreen([]); });
  }, [loadSites]));

  const join = async () => {
    setBusy('join'); setJoinErr(null);
    try { await joinWorkplace(code.trim()); setCode(''); loadSites(); } catch (e: any) { setJoinErr(e?.message || 'Could not join.'); } finally { setBusy(null); }
  };

  const ready = q.active !== null && q.veg !== null && q.bp !== null && q.gl !== null;
  const runRisk = async () => {
    setBusy('risk'); setRiskErr(null);
    try { setRisk(await checkDiabetesRisk({ waist_cm: num(q.waist), active_30min_daily: !!q.active, veg_fruit_daily: !!q.veg, bp_medicine: !!q.bp, high_glucose_before: !!q.gl, family: q.family })); }
    catch (e: any) { setRiskErr(e?.message || 'Could not work this out.'); } finally { setBusy(null); }
  };
  const runHeat = async () => {
    const t = num(h.temp), rh = num(h.rh);
    if (t === undefined || rh === undefined) { setHeatErr('Enter the temperature and the humidity.'); return; }
    setBusy('heat'); setHeatErr(null);
    try { setHeat(await checkHeat({ temp_c: t, humidity_pct: rh, effort: h.effort, direct_sun: h.sun })); }
    catch (e: any) { setHeatErr(e?.message || 'Could not work this out.'); } finally { setBusy(null); }
  };

  return (
    <ProtectedRoute>
      <View style={{ flex: 1, backgroundColor: C.background }}>
        <GlassBackdrop />
        <Screen bg="transparent" header={<ScreenHeader title="Prevention" subtitle="Checks, risk and heat safety" onBack={() => router.back()} />} contentStyle={{ gap: 14, paddingBottom: 60 }} keyboard>
          {error ? <Banner tone="warning" text={error} /> : null}

          <Block icon="calendar-outline" title="Checks that suit you" sub={sNote || undefined}>
            {!screen ? <Skeleton height={90} /> : screen.length === 0 ? <T v="caption" color={C.textSecondary}>Add your age in Edit profile to see these.</T> : screen.map((s) => (
              <View key={s.name} style={{ paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.borderLight }}>
                <T v="bodyStrong">{s.name}</T>
                <T v="caption" color={C.textSecondary}>{s.every}{s.why ? `. ${s.why}` : ''}</T>
              </View>
            ))}
          </Block>

          <Block icon="pulse-outline" title="Diabetes risk check" sub="Seven short questions. Takes a minute.">
            <TextField label="Waist in centimetres (optional)" value={q.waist} onChangeText={(v) => setQ((p) => ({ ...p, waist: v }))} keyboardType="decimal-pad" maxLength={5} />
            <YesNo label="Do you move for 30 minutes or more on most days?" value={q.active} onChange={(v) => setQ((p) => ({ ...p, active: v }))} />
            <YesNo label="Do you eat fruit or vegetables every day?" value={q.veg} onChange={(v) => setQ((p) => ({ ...p, veg: v }))} />
            <YesNo label="Do you take medicine for high blood pressure?" value={q.bp} onChange={(v) => setQ((p) => ({ ...p, bp: v }))} />
            <YesNo label="Has a test ever shown high blood sugar?" value={q.gl} onChange={(v) => setQ((p) => ({ ...p, gl: v }))} />
            <View style={{ gap: 6 }}>
              <T v="label" color={C.textSecondary}>Family members with diabetes</T>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {[['none', 'None'], ['second_degree', 'Grandparent, aunt or uncle'], ['first_degree', 'Parent, brother or sister']].map(([k, l]) => <Chip key={k} label={l} selected={q.family === k} onPress={() => setQ((p) => ({ ...p, family: k }))} />)}
              </View>
            </View>
            {riskErr ? <T v="caption" color={C.danger}>{riskErr}</T> : null}
            <Button title="See my result" disabled={!ready} loading={busy === 'risk'} onPress={runRisk} />
            {risk ? (
              <View style={{ gap: 6, padding: 14, borderRadius: 16, backgroundColor: C.primarySoft }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <T v="display" style={{ fontSize: 30 }}>{risk.score} <T v="caption" color={C.textSecondary}>of {risk.max}</T></T>
                  <Badge label={BAND[risk.band]?.label || risk.band} tone={BAND[risk.band]?.tone || 'neutral'} />
                </View>
                <T v="bodyStrong">{risk.next_step}</T>
                {risk.parts.map((p) => <T key={p.label} v="caption" color={C.textSecondary}>{p.label}: {p.points} ({p.why})</T>)}
                <T v="caption" color={C.textSecondary} style={{ marginTop: 4 }}>{risk.note}</T>
              </View>
            ) : null}
          </Block>

          <Block icon="business-outline" title="My workplace" sub="Join with the code from your occupational health doctor. You can leave any time.">
            {sites.map((w) => (
              <View key={w.id} style={{ gap: 6, padding: 14, borderRadius: 16, backgroundColor: C.primarySoft }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <T v="heading">{w.name}</T>
                  {w.advice ? <Badge label={w.advice.title} tone={HEAT[w.level || 'low'] || 'neutral'} /> : <Badge label="No recent reading" tone="neutral" />}
                </View>
                {w.latest ? <T v="caption" color={C.textSecondary}>{w.latest.temp_c}°C, {w.latest.humidity_pct}% humidity{w.latest.at ? `, ${new Date(w.latest.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}</T> : <T v="caption" color={C.textSecondary}>Your site has not recorded the heat yet.</T>}
                {w.advice ? (<><T v="body">{w.advice.water}</T><T v="body">{w.advice.rest}</T>{w.advice.raised_because.length ? <T v="caption" color={C.textSecondary}>Raised for you because of {w.advice.raised_because.join(', ')}.</T> : null}{w.advice.do.map((d) => <T key={d} v="caption">{d}</T>)}</>) : null}
                <Button title="Leave this workplace" variant="secondary" onPress={() => leaveWorkplace(w.id).then(loadSites).catch(() => {})} />
              </View>
            ))}
            <TextField label="Join code" value={code} onChangeText={setCode} autoCapitalize="characters" maxLength={12} placeholder="6 characters" />
            {joinErr ? <T v="caption" color={C.danger}>{joinErr}</T> : null}
            <Button title="Join" icon="log-in-outline" disabled={code.trim().length < 4} loading={busy === 'join'} onPress={join} />
            <T v="caption" color={C.textSecondary}>Your employer sees how many people joined (only when 5 or more) and never your health information.</T>
          </Block>

          <Block icon="sunny-outline" title="Heat check for work" sub="For outdoor and hot indoor work. Type what your thermometer shows.">
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}><TextField label="Temperature (°C)" value={h.temp} onChangeText={(v) => setH((p) => ({ ...p, temp: v }))} keyboardType="decimal-pad" maxLength={5} /></View>
              <View style={{ flex: 1 }}><TextField label="Humidity (%)" value={h.rh} onChangeText={(v) => setH((p) => ({ ...p, rh: v }))} keyboardType="decimal-pad" maxLength={5} /></View>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {['light', 'moderate', 'heavy'].map((e) => <Chip key={e} label={`${e} work`} selected={h.effort === e} onPress={() => setH((p) => ({ ...p, effort: e }))} />)}
              <Chip label="In direct sun" selected={h.sun} onPress={() => setH((p) => ({ ...p, sun: !p.sun }))} />
            </View>
            {heatErr ? <T v="caption" color={C.danger}>{heatErr}</T> : null}
            <Button title="Check the heat risk" icon="thermometer-outline" loading={busy === 'heat'} onPress={runHeat} />
            {heat ? (
              <View style={{ gap: 6, padding: 14, borderRadius: 16, backgroundColor: C.primarySoft }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <T v="heading">{heat.title}</T><Badge label={`Feels like ${Math.round(heat.heat_index_c)}°C`} tone={HEAT[heat.level] || 'neutral'} />
                </View>
                <T v="body">{heat.water}</T>
                <T v="body">{heat.rest}</T>
                {heat.raised_because.length ? <T v="caption" color={C.textSecondary}>Raised because of {heat.raised_because.join(', ')}.</T> : null}
                {heat.do.map((d) => <T key={d} v="caption">{d}</T>)}
                <T v="caption" color={C.textSecondary}>In an emergency call {heat.emergency_number}. {heat.note}</T>
              </View>
            ) : null}
          </Block>
          <T v="caption" color={C.textSecondary} style={{ textAlign: 'center' }}>HEWAL3 supports care and does not diagnose. Talk to a clinician about any result.</T>
        </Screen>
      </View>
    </ProtectedRoute>
  );
}
