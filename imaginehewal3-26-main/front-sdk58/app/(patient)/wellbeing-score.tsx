import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import Svg from 'react-native-svg';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Banner, Button, Screen, ScreenHeader, Skeleton, T } from '../../components/ui';
import { Reveal } from '../../components/ui/motion';
import { theme } from '../../constants/theme';
import api, { WellbeingScore } from '../../services/api';
import { Ionicons, Path, Pressable, RefreshControl, View } from '../../components/themed';

const C = theme.COLORS;
const START = 135, SWEEP = 270, SEGS = 54;
const pt = (cx: number, r: number, deg: number) => ({ x: cx + r * Math.cos((deg * Math.PI) / 180), y: cx + r * Math.sin((deg * Math.PI) / 180) });
const seg = (cx: number, r: number, a: number, b: number) => { const s = pt(cx, r, a), e = pt(cx, r, b); return `M ${s.x} ${s.y} A ${r} ${r} 0 0 1 ${e.x} ${e.y}`; };
// red -> orange -> yellow -> green along the arc
const along = (t: number) => {
  const stops = [[226, 62, 62], [240, 138, 48], [236, 200, 60], [92, 184, 92]];
  const p = t * (stops.length - 1), i = Math.min(stops.length - 2, Math.floor(p)), f = p - i;
  const c = stops[i].map((v, k) => Math.round(v + (stops[i + 1][k] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
};

/** A 270 degree dial: the part up to the score is coloured from red to green, the rest is grey. */
function Dial({ score, band, size = 250 }: { score: number | null; band: string | null; size?: number }) {
  const stroke = 20, r = size / 2 - stroke, cx = size / 2;
  const lit = score == null ? 0 : Math.round((score / 100) * SEGS);
  return (
    <View style={{ width: size, height: size * 0.86, alignSelf: 'center', alignItems: 'center' }} accessibilityRole="image" accessibilityLabel={score != null ? `Wellbeing score ${score} out of 100, ${band}` : 'Wellbeing score not available yet'}>
      <Svg width={size} height={size} style={{ position: 'absolute', top: 0 }}>
        {Array.from({ length: SEGS }).map((_, i) => {
          const a = START + (i * SWEEP) / SEGS, b = START + ((i + 1) * SWEEP) / SEGS - 1.2;
          return <Path key={i} d={seg(cx, r, a, b)} stroke={i < lit ? along(i / (SEGS - 1)) : C.border} strokeWidth={stroke} strokeLinecap="round" fill="none" />;
        })}
      </Svg>
      <View style={{ position: 'absolute', top: size * 0.3, alignItems: 'center' }}>
        <T v="display" style={{ fontSize: 60, lineHeight: 66 }}>{score ?? '--'}</T>
        <T v="heading" style={{ fontSize: 20 }}>{band ?? 'Not enough data'}</T>
      </View>
    </View>
  );
}

function Fold({ title, open, onToggle, children }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode }) {
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: C.borderLight }}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 18 }}>
        <T v="bodyStrong" style={{ flex: 1 }}>{title}</T>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={20} color={C.textSecondary} />
      </Pressable>
      {open ? <View style={{ paddingBottom: 16 }}>{children}</View> : null}
    </View>
  );
}

export default function WellbeingScoreScreen() {
  const router = useRouter();
  const [data, setData] = useState<WellbeingScore | null>(null);
  const [open, setOpen] = useState<'how' | 'improve' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try { setData(await api.getWellbeingScore()); setErr(null); } catch (e: any) { setErr(e.message || 'Could not load your score.'); }
    setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const good = data?.domains.filter((d) => d.has_data && (d.value ?? 0) >= 70) ?? [];
  const grow = data?.domains.filter((d) => !d.has_data || (d.value ?? 100) < 70) ?? [];

  return (
    <ProtectedRoute>
      <Screen header={<ScreenHeader title="Wellbeing score" onBack={() => router.back()} />}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.primary} onRefresh={() => { setRefreshing(true); api.invalidateApiCache(); load(); }} />}>
        {err ? <Banner tone="danger" text={err} /> : null}
        {!data ? <Skeleton height={240} /> : (
          <Reveal>
            <View style={{ marginTop: 8 }}><Dial score={data.score} band={data.band} /></View>
            <View style={{ alignSelf: 'center', gap: 10, marginTop: 4 }}>
              {data.score != null ? good.map((d) => (
                <View key={d.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                  <Ionicons name="checkmark-circle" size={20} color={C.success} /><T v="body">{d.label} is on track</T>
                </View>
              )) : <T v="caption" color={C.textSecondary} style={{ textAlign: 'center', maxWidth: 300 }}>{data.message}</T>}
            </View>
            <T v="caption" color={C.textTertiary} style={{ textAlign: 'center', marginTop: 18 }}>Based on {data.parts_used} of 5 areas. Updated when you open this screen.</T>

            <View style={{ marginTop: 18 }}>
              <Fold title="How is my score calculated?" open={open === 'how'} onToggle={() => setOpen(open === 'how' ? null : 'how')}>
                <T v="body">{data.method}</T>
                {data.domains.map((d) => (
                  <View key={d.key} style={{ marginTop: 14 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <T v="bodyStrong">{d.label} <T v="caption" color={C.textSecondary}>({d.weight}%)</T></T>
                      <T v="bodyStrong" color={d.has_data ? C.textPrimary : C.textTertiary}>{d.has_data ? d.value : '--'}</T>
                    </View>
                    <T v="caption" color={C.textSecondary}>{d.detail}</T>
                  </View>
                ))}
              </Fold>
              <Fold title="Improving your score" open={open === 'improve'} onToggle={() => setOpen(open === 'improve' ? null : 'improve')}>
                {grow.length === 0 ? <T v="body">Every area is on track. Keep doing what you are doing.</T> : grow.map((d) => (
                  <View key={d.key} style={{ marginBottom: 12 }}>
                    <T v="bodyStrong">{d.label}{d.has_data ? '' : ' (no data yet)'}</T>
                    <T v="caption" color={C.textSecondary}>{d.improve}</T>
                  </View>
                ))}
              </Fold>
              <View style={{ borderTopWidth: 1, borderTopColor: C.borderLight }} />
            </View>

            <View style={{ marginTop: 22 }}><Button title="Update my survey answers" variant="secondary" onPress={() => router.push('/(patient)/wellbeing' as any)} /></View>
            <T v="caption" color={C.textTertiary} style={{ marginTop: 18 }}>{data.note}</T>
          </Reveal>
        )}
        <View style={{ height: 40 }} />
      </Screen>
    </ProtectedRoute>
  );
}
