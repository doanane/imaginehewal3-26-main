import { useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { useFocusEffect } from 'expo-router';
import LineChart from '../../../components/charts/LineChart';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { Banner, Button, Card, Chip, ProgressBar, Screen, ScreenHeader, Section, T, TextField } from '../../../components/ui';
import { theme } from '../../../constants/theme';
import api, { WeightReport } from '../../../services/api';
import { View } from '../../../components/themed';

const C = theme.COLORS;
const parseKg = (s: string) => { const n = parseFloat(s.replace(',', '.')); return isFinite(n) && n >= 20 && n <= 400 ? Math.round(n * 10) / 10 : null; };

export default function WeightScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'weekly' | 'monthly'>('weekly');
  const [rep, setRep] = useState<WeightReport | null>(null);
  const [kg, setKg] = useState('');
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (m = mode) => { try { setRep(await api.getWeightReport(m)); } catch (e: any) { setErr(e.message); } }, [mode]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const add = async () => {
    const v = parseKg(kg); if (!v) { setErr('Enter a weight between 20 and 400 kg.'); return; }
    setBusy(true); setErr(null);
    try { await api.addWeight(v); setKg(''); await load(); } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  };
  const saveTarget = async () => {
    const v = parseKg(target); if (!v) { setErr('Enter a target between 20 and 400 kg.'); return; }
    try { await api.setActivityGoals({ target_weight_kg: v }); setTarget(''); await load(); } catch (e: any) { setErr(e.message); }
  };
  const remove = (id: number) => Alert.alert('Delete this entry?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await api.deleteWeight(id).catch(() => {}); load(); } }]);

  const st = rep?.stats;
  const series = (rep?.points ?? []).map((p) => ({ t: new Date(p.at).getTime(), v: p.kg }));
  const trendText = st?.trend === 'down' ? 'Trending down' : st?.trend === 'up' ? 'Trending up' : st?.trend === 'steady' ? 'Holding steady' : null;

  return (
    <ProtectedRoute>
      <Screen header={<ScreenHeader title="Weight" subtitle="Read from Apple Health automatically" onBack={() => router.back()} />} contentStyle={{ paddingBottom: 48 }} keyboard>
        {err ? <Banner tone="danger" text={err} /> : null}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
            <T v="title" style={{ fontSize: 44, lineHeight: 52 }}>{st?.latest_kg ?? '--'}</T><T v="body" color={C.textSecondary}> kg</T>
          </View>
          {trendText ? <T v="label" color={C.primary}>{trendText}{st?.slope_kg_per_week != null ? ` · ${st.slope_kg_per_week > 0 ? '+' : ''}${st.slope_kg_per_week} kg/week` : ''}</T> : null}
          <View style={{ flexDirection: 'row', marginTop: 14 }}>
            {[['Change', st?.change_kg != null ? `${st.change_kg > 0 ? '+' : ''}${st.change_kg} kg` : '--'], ['BMI', st?.bmi != null ? String(st.bmi) : '--'], ['Target', st?.target_kg ? `${st.target_kg} kg` : '--']].map(([k, v]) => (
              <View key={k} style={{ flex: 1 }}><T v="bodyStrong">{v}</T><T v="caption" color={C.textSecondary}>{k}</T></View>
            ))}
          </View>
          {st?.goal_progress != null ? <View style={{ marginTop: 14 }}><ProgressBar value={st.goal_progress} /><T v="caption" color={C.textSecondary} style={{ marginTop: 6 }}>{Math.round(st.goal_progress * 100)}% of the way to your target{st.to_go_kg != null ? `, ${Math.abs(st.to_go_kg)} kg to go` : ''}</T></View> : null}
        </Card>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 18 }}>
          <Chip label="Weekly" selected={mode === 'weekly'} onPress={() => { setMode('weekly'); load('weekly'); }} />
          <Chip label="Monthly" selected={mode === 'monthly'} onPress={() => { setMode('monthly'); load('monthly'); }} />
        </View>
        <Section title={mode === 'weekly' ? 'Weekly report' : 'Monthly report'}>
          <Card>
            {series.length >= 2 ? <LineChart data={series} height={170} color="#5B4BB7" unit="kg" replayKey={mode} formatTime={(t) => new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} />
              : <T v="caption" color={C.textSecondary}>Add at least two weigh-ins to see your trend.</T>}
            {(rep?.buckets ?? []).length ? (
              <View style={{ marginTop: 14 }}>
                {rep!.buckets.map((b) => (
                  <View key={b.label} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: C.borderLight }}>
                    <T v="body">{b.label}</T><T v="bodyStrong">{b.avg_kg} kg <T v="caption" color={C.textSecondary}>({b.n} {b.n === 1 ? 'entry' : 'entries'})</T></T>
                  </View>
                ))}
              </View>
            ) : null}
          </Card>
          {(st?.notes ?? []).map((n, i) => <View key={i} style={{ marginTop: 10 }}><Banner tone="info" text={n} /></View>)}
        </Section>

        <Section title="No scale connected? Add one by hand">
          <Card>
            <TextField label="Weight (kg)" value={kg} onChangeText={setKg} keyboardType="decimal-pad" placeholder="e.g. 72.4" />
            <Button title="Save weight" onPress={add} loading={busy} style={{ marginTop: 12 }} />
          </Card>
        </Section>
        <Section title="Target weight">
          <Card>
            <TextField label="Target (kg)" value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder={st?.target_kg ? String(st.target_kg) : 'e.g. 68'} />
            <Button title="Set target" variant="secondary" onPress={saveTarget} style={{ marginTop: 12 }} />
          </Card>
        </Section>
        {(rep?.points ?? []).length ? (
          <Section title="History">
            <Card style={{ paddingVertical: 4 }}>
              {[...rep!.points].reverse().slice(0, 12).map((p) => (
                <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }}>
                  <T v="body">{new Date(p.at).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}</T>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}><T v="bodyStrong">{p.kg} kg</T><T v="label" color={C.danger} onPress={() => remove(p.id)} accessibilityRole="button">Delete</T></View>
                </View>
              ))}
            </Card>
          </Section>
        ) : null}
        <T v="caption" color={C.textTertiary} style={{ marginTop: 16 }}>Weight naturally moves a little each day. Look at the trend, not a single number.</T>
      </Screen>
    </ProtectedRoute>
  );
}
