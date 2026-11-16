import React from 'react';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { theme } from '../../constants/theme';
import type { IconName } from '../ui';
import { Card, T } from '../ui';
import { Row } from '../../services/healthMath';
import { Ionicons, View } from '../themed';
import { Spark } from './Spark';

const C = theme.COLORS;
const LOOK: Record<string, { icon: IconName; color: string }> = {
  resting: { icon: 'heart', color: C.danger }, steps: { icon: 'walk', color: C.success }, sleep: { icon: 'moon', color: '#5B6FD6' }, weight: { icon: 'barbell', color: '#8B5CF6' },
};
const TONE = { good: C.success, watch: C.warning, none: C.textSecondary };

/** The last seven days from Apple Health, side by side with the seven before: one clear number, one plain sentence, one small trend. */
export function WeekReview({ rows }: { rows: Row[] }) {
  return (
    <Card>
      <T v="heading">This week</T>
      <T v="caption" color={C.textSecondary}>From your Apple Health, compared with the week before</T>
      {rows.length === 0 ? (
        <T v="body" color={C.textSecondary} style={{ marginTop: 14 }}>Not enough recent Apple Health data yet. Wear your watch, or open the apps that write to Health, and this fills in by itself.</T>
      ) : rows.map((r, i) => {
        const look = LOOK[r.key] || LOOK.resting;
        return (
          <Animated.View key={r.key} entering={FadeInDown.delay(i * 80).duration(420)}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: C.separator, marginTop: i ? 0 : 10 }}>
            <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: `${look.color}1F`, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name={look.icon} size={19} color={look.color} />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T v="caption" color={C.textSecondary}>{r.label}</T>
              <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
                <T v="title" style={{ fontSize: 22, lineHeight: 28 }}>{r.value}</T>
                {r.unit ? <T v="caption" color={C.textSecondary}> {r.unit}</T> : null}
              </View>
              <T v="caption" color={TONE[r.tone]} numberOfLines={2} style={{ fontWeight: r.tone === 'none' ? '400' : '600' }}>{r.change}</T>
            </View>
            <Spark values={r.spark} color={look.color} />
          </Animated.View>
        );
      })}
    </Card>
  );
}
