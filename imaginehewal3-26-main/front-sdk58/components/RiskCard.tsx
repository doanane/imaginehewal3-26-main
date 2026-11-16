import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { theme } from '../constants/theme';
import api, { Recommendation, RiskSummary } from '../services/api';
import DonutChart, { Slice } from './charts/DonutChart';
import { ReadAloud } from './ReadAloud';
import { Badge, Banner, Card, ListRow, Section, Skeleton, T } from './ui';
import { Ionicons, View } from './themed';

const C = theme.COLORS;
const TONE = { low: 'success', moderate: 'warning', high: 'danger', urgent: 'danger' } as const;
const PALETTE = ['#B42318', '#D9701A', '#B08A00', '#5B4BB7', '#0A7C99', '#17724A', '#1D4ED8', '#7C3A6B'];

/**
 * Guideline-based risk screening explained as a pie of what contributes, with the exact reasons and what to do next.
 * Pass `risk` and `recs` to reuse data the screen already loaded; otherwise the card loads its own.
 */
export default function RiskCard({ risk: given, recs: givenRecs }: { risk?: RiskSummary | null; recs?: Recommendation[] }) {
  const router = useRouter();
  const external = given !== undefined;
  const [own, setOwn] = useState<RiskSummary | null>(null);
  const [ownRecs, setOwnRecs] = useState<Recommendation[]>([]);
  const [how, setHow] = useState(false);
  const [failed, setFailed] = useState(false);

  useFocusEffect(useCallback(() => {
    if (external) return;
    Promise.all([api.getRiskSummary(), api.getRiskRecommendations()])
      .then(([r, c]) => { setOwn(r); setOwnRecs(c.items); setFailed(false); }).catch(() => setFailed(true));
  }, [external]));

  const risk = external ? given : own;
  const recs = external ? givenRecs ?? [] : ownRecs;
  if (!risk) {
    if (failed) return null;
    return <Card><Skeleton height={20} width="50%" /><Skeleton height={12} style={{ marginTop: 12 }} /></Card>;
  }

  const slices: Slice[] = risk.factors.map((f, i) => ({ key: f.key + i, label: f.label, value: f.points, color: PALETTE[i % PALETTE.length], detail: f.detail }));
  const spoken = `${risk.label}. ${risk.summary} ${risk.factors.slice(0, 3).map((f) => f.label).join('. ')}.`;

  return (
    <View>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <Badge label={risk.label} tone={TONE[risk.tier]} />
            <T v="caption" color={C.textSecondary} style={{ marginTop: 8 }}>{risk.summary}</T>
          </View>
        </View>

        {risk.anomalies.map((a) => <View key={a.key} style={{ marginTop: 12 }}><Banner tone="warning" title={a.label} text={a.detail} /></View>)}

        {slices.length ? (
          <View style={{ marginTop: 16 }}>
            <T v="overline" color={C.textSecondary} style={{ marginBottom: 10, textAlign: 'center' }}>What adds to your risk</T>
            <DonutChart data={slices} size={210} thickness={38} centerValue={String(risk.score)} centerLabel="risk points"
              hint="Tap a slice to see why" emptyText="Nothing is adding to your risk" />
          </View>
        ) : (
          <View style={{ marginTop: 14, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Ionicons name="checkmark-circle" size={22} color={C.success} />
            <T v="caption" style={{ flex: 1 }}>Nothing is adding to your risk from the readings we have.</T>
          </View>
        )}

        {risk.missing.length ? <T v="caption" color={C.textSecondary} style={{ marginTop: 12 }}>To make this more accurate, add: {risk.missing.join(', ')}.</T> : null}
        <ReadAloud text={spoken} />
        <T v="label" color={C.primary} onPress={() => setHow((h) => !h)} accessibilityRole="button" style={{ marginTop: 4, paddingVertical: 8 }}>{how ? 'Hide how this works' : 'How is this calculated?'}</T>
        {how ? <T v="caption" color={C.textSecondary}>{risk.method} {risk.disclaimer}</T> : null}
      </Card>

      {recs.length ? (
        <View style={{ marginTop: 12 }}>
          <T v="heading" style={{ marginBottom: 10 }}>What to do next</T>
          <Card style={{ paddingVertical: 4 }}>
            {recs.slice(0, 4).map((r) => <ListRow key={r.id} icon="sparkles-outline" title={r.title} subtitle={r.action} onPress={() => router.push(r.route as any)} />)}
          </Card>
        </View>
      ) : null}
    </View>
  );
}
