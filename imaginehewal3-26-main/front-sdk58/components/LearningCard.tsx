import { useFocusEffect } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { BEHAVIORS } from '../constants/behavior';
import { theme } from '../constants/theme';
import api, { LearningInsights } from '../services/api';
import { Card, ProgressBar, Section, T } from './ui';
import { Ionicons, View } from './themed';

const C = theme.COLORS;

/** Shows the person what the system has learned about them, in plain sentences and simple bars. */
export default function LearningCard() {
  const [data, setData] = useState<LearningInsights | null>(null);
  const [how, setHow] = useState(false);
  useFocusEffect(useCallback(() => { api.getBehaviorInsights().then(setData).catch(() => setData(null)); }, []));
  if (!data || data.plans.length === 0) return null;

  return (
    <Section title="What works for you">
      {data.plans.map((p) => (
        <Card key={p.plan_id} style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ionicons name={BEHAVIORS[p.behavior]?.icon ?? 'flag-outline'} size={22} color={C.primary} />
            <T v="heading" style={{ flex: 1 }}>{BEHAVIORS[p.behavior]?.label ?? p.behavior}</T>
          </View>

          {p.learned.length ? p.learned.map((l) => (
            <View key={l} style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <Ionicons name="bulb-outline" size={18} color={C.primary} style={{ marginTop: 2 }} />
              <T v="caption" style={{ flex: 1 }}>{l}</T>
            </View>
          )) : (
            <T v="caption" color={C.textSecondary} style={{ marginTop: 10 }}>
              Still learning about you. {p.days_of_data} of about {data.min_days_for_insights} days so far. Keep checking in and this will fill in.
            </T>
          )}

          {p.days_of_data >= 7 ? (
            <View style={{ marginTop: 14 }}>
              <T v="overline" color={C.textSecondary}>Your week</T>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 64, marginTop: 8 }} accessibilityLabel="Success by weekday">
                {p.by_weekday.map((d) => (
                  <View key={d.day} style={{ flex: 1, alignItems: 'center' }}>
                    <View style={{ width: 16, height: d.rate == null ? 4 : Math.max(4, d.rate * 44), borderRadius: 4, backgroundColor: d.rate == null ? C.borderLight : d.rate >= 0.6 ? C.success : d.rate >= 0.4 ? C.warning : C.danger }} />
                    <T v="overline" color={C.textTertiary} style={{ fontSize: 10, marginTop: 4 }}>{d.day}</T>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {p.by_technique.length ? (
            <View style={{ marginTop: 14, gap: 8 }}>
              <T v="overline" color={C.textSecondary}>Styles that suit you</T>
              {p.by_technique.map((t) => (
                <View key={t.technique}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <T v="caption">{t.technique}</T><T v="caption" color={C.textSecondary}>{Math.round(t.rate * 100)}%</T>
                  </View>
                  <View style={{ marginTop: 4 }}><ProgressBar value={t.rate} /></View>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      ))}
      <T v="label" color={C.primary} onPress={() => setHow((h) => !h)} accessibilityRole="button" style={{ paddingVertical: 8 }}>
        {how ? 'Hide how this works' : 'How does it learn?'}
      </T>
      {how ? <T v="caption" color={C.textSecondary}>{data.how}</T> : null}
    </Section>
  );
}
