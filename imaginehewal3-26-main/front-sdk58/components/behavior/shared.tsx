import React from 'react';
import { theme } from '../../constants/theme';
import type { IconName } from '../ui';
import { Chip, T } from '../ui';
import { Switch, View } from '../themed';

const C = theme.COLORS;

export const BEHAVIOR_IDS = ['movement', 'activity', 'breaks', 'nutrition', 'sleep'] as const;
export const BEH_ICON: Record<string, IconName> = {
  movement: 'walk-outline', activity: 'body-outline', breaks: 'timer-outline', nutrition: 'nutrition-outline', sleep: 'moon-outline',
};
export const BARRIER_IDS = ['time', 'tired', 'forgot', 'motivation', 'weather', 'access', 'pain_sick', 'stress', 'craving', 'other'] as const;
export type Tr = (key: string, vars?: Record<string, string | number>) => string;

/** One question with a handful of answers, as tappable chips. */
export function Choice({ label, options, value, onChange }: { label: string; options: { v: string | number; label: string }[]; value: string | number | null | undefined; onChange: (v: any) => void }) {
  return (
    <View style={{ marginTop: 14 }}>
      <T v="label" color={C.textSecondary}>{label}</T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {options.map((o) => <Chip key={String(o.v)} label={o.label} selected={value === o.v} onPress={() => onChange(o.v)} />)}
      </View>
    </View>
  );
}

/** A setting the person can switch, with one line saying what it does. */
export function SwitchRow({ label, sub, value, onChange }: { label: string; sub?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T v="bodyStrong">{label}</T>
        {sub ? <T v="caption" color={C.textSecondary}>{sub}</T> : null}
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ true: C.primary, false: C.border }} />
    </View>
  );
}

export const EVIDENCE_TONE: Record<string, 'success' | 'info' | 'warning' | 'neutral'> = { strong: 'success', moderate: 'info', mixed: 'warning', emerging: 'neutral' };
