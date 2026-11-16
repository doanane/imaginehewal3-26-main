import React, { useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, useWindowDimensions } from 'react-native';
import { theme } from '../../constants/theme';
import { T } from '../ui';
import { PressScale } from '../ui/motion';
import { Image, Ionicons, LinearGradient, ScrollView, View } from '../themed';

const C = theme.COLORS;

/** A picture with rounded corners; when there is no picture it falls back to a soft tile with an icon, never an empty box. */
export function Photo({ uri, icon, height, radius = 16, children }: { uri?: string | null; icon?: string; height: number; radius?: number; children?: React.ReactNode }) {
  return (
    <View style={{ height, borderRadius: radius, overflow: 'hidden', backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
      {uri ? <Image source={{ uri }} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }} resizeMode="cover" accessibilityIgnoresInvertColors /> : <Ionicons name={(icon || 'leaf-outline') as any} size={40} color={C.primary} />}
      {children}
    </View>
  );
}

export function Dots({ count, index }: { count: number; index: number }) {
  if (count < 2) return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 }} accessibilityElementsHidden>
      {Array.from({ length: count }).map((_, i) => <View key={i} style={{ width: i === index ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === index ? C.primary : C.border }} />)}
    </View>
  );
}

/** Cards that scroll sideways and snap one at a time, with the next card peeking in and dots underneath. */
export function Carousel<T>({ items, render, keyOf }: { items: T[]; render: (item: T, width: number) => React.ReactNode; keyOf: (item: T) => string }) {
  const { width: screen } = useWindowDimensions();
  const w = Math.min(340, screen - 64);
  const [idx, setIdx] = useState(0);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setIdx(Math.max(0, Math.min(items.length - 1, Math.round(e.nativeEvent.contentOffset.x / (w + 14)))));
  return (
    <View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} snapToInterval={w + 14} decelerationRate="fast" onScroll={onScroll} scrollEventThrottle={16}
        contentContainerStyle={{ gap: 14, paddingRight: 24 }} style={{ marginHorizontal: -16 }} contentInset={{ left: 16 }} contentOffset={{ x: -16, y: 0 }}>
        <View style={{ width: 2 }} />
        {items.map((it) => <View key={keyOf(it)} style={{ width: w }}>{render(it, w)}</View>)}
      </ScrollView>
      <Dots count={items.length} index={idx} />
    </View>
  );
}

/** The card used for challenges and communities: a picture on top, a bold title and one grey line under it. */
export function ImageCard({ uri, icon, title, subtitle, badge, onPress, label }: { uri?: string | null; icon?: string; title: string; subtitle?: string; badge?: string; onPress: () => void; label: string }) {
  return (
    <PressScale onPress={onPress} label={label}>
      <Photo uri={uri} icon={icon} height={168} radius={16}>
        {badge ? (
          <View style={{ position: 'absolute', left: 10, top: 10, backgroundColor: C.primary, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <T v="label" color="#fff" style={{ fontSize: 12 }}>{badge}</T>
          </View>
        ) : null}
      </Photo>
      <T v="heading" numberOfLines={1} style={{ marginTop: 10 }}>{title}</T>
      {subtitle ? <T v="caption" color={C.textSecondary} numberOfLines={1}>{subtitle}</T> : null}
    </PressScale>
  );
}

/** A big picture with a dark fade and white words over it (the library's featured card). */
export function FeatureCard({ uri, tag, title, line, onPress, width }: { uri?: string | null; tag: string; title: string; line: string; onPress: () => void; width: number }) {
  return (
    <PressScale onPress={onPress} label={`${tag}. ${title}. ${line}`}>
      <Photo uri={uri} icon="book-outline" height={Math.round(width * 0.68)} radius={14}>
        <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.72)']} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, top: '25%' }} />
        <View style={{ position: 'absolute', left: 12, top: 12, backgroundColor: C.primary, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
          <T v="overline" color="#fff" style={{ fontSize: 11 }}>{tag}</T>
        </View>
        <View style={{ position: 'absolute', left: 14, right: 14, bottom: 14 }}>
          <T v="title" color="#fff" numberOfLines={2} style={{ fontSize: 22, lineHeight: 28 }}>{title}</T>
          <T v="caption" color="rgba(255,255,255,0.9)" style={{ marginTop: 4 }}>{line}</T>
        </View>
      </Photo>
    </PressScale>
  );
}

/** Seven bars, Monday to Sunday. A day that has not come yet has no bar; a day with nothing recorded shows a small stub. */
export function DailyBars({ values, color = C.primary, unit, today }: { values: (number | null)[]; color?: string; unit: string; today: number }) {
  const max = Math.max(1, ...values.map((v) => v ?? 0));
  const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <View accessible accessibilityLabel={`Daily progress, ${values.map((v, i) => `${DAYS[i]} ${v ?? 'none'}`).join(', ')} ${unit}`}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 150, paddingTop: 8 }}>
        {values.map((v, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            {v != null && v > 0 ? <T v="caption" color={C.textSecondary} style={{ fontSize: 11, marginBottom: 3 }}>{v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v * 10) / 10}</T> : null}
            <View style={{ width: 26, height: v == null ? 0 : Math.max(4, ((v || 0) / max) * 108), borderRadius: 6, backgroundColor: v ? color : C.border, opacity: i === today ? 1 : 0.85 }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 }}>
        {DAYS.map((d, i) => <T key={i} v="caption" color={i === today ? C.primary : C.textSecondary} style={{ flex: 1, textAlign: 'center', fontWeight: i === today ? '700' : '400' }}>{d}</T>)}
      </View>
    </View>
  );
}

/** Underlined tabs like About / Progress / Leaderboard. */
export function Tabs<K extends string>({ tabs, value, onChange }: { tabs: { k: K; label: string }[]; value: K; onChange: (k: K) => void }) {
  return (
    <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: C.borderLight }} accessibilityRole="tablist">
      {tabs.map((t) => {
        const on = t.k === value;
        return (
          <PressScale key={t.k} onPress={() => onChange(t.k)} label={t.label} haptic={false} containerStyle={{ flex: 1 }}>
            <View style={{ paddingVertical: 12, alignItems: 'center', borderBottomWidth: 3, borderBottomColor: on ? C.primary : 'transparent', marginBottom: -1 }}>
              <T v="bodyStrong" color={on ? C.primary : C.textSecondary} style={{ fontSize: 15 }}>{t.label}</T>
            </View>
          </PressScale>
        );
      })}
    </View>
  );
}
