/**
 * Accessibility for the whole app. <AccessibilityLayer> sits at the root, so every screen follows the settings:
 *   Vision      text size, light / dark / high contrast / yellow / sepia, colour-blind help, saturation, grayscale, page dimmer,
 *               page zoom, hide images, bold text, underlined and highlighted links      (applied by components/themed + this layer)
 *   Reading     reading guide, stop animations, language
 *   Navigation  larger tap areas
 *   Reader      hold your finger on any text to hear it
 * Settings are saved on the phone at once and on the account shortly after, and a change on another device arrives live.
 */
import { Ionicons as _Ionicons } from '@expo/vector-icons';
import { useSegments } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable as RawPressable, Platform, StyleSheet, Text as RawText, useWindowDimensions } from 'react-native';
import Animated, { ReduceMotion, ReducedMotionConfig, useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import { LANGUAGES } from '../i18n';
import { theme } from '../constants/theme';
import { HomeAccessibilityProvider, useHomeAccessibility } from './homeAccessibilityContext';
import { Ionicons, Pressable, ScrollView, Switch, View, textAt } from './themed';
import { T } from './ui';
export { HomeAccessibilityProvider, useHomeAccessibility };

const C = theme.COLORS;
const READ_AFTER_MS = 600;

function Option({ label, selected, onPress, swatch }: { label: string; selected: boolean; onPress: () => void; swatch?: { bg: string; fg: string } }) {
  if (swatch) {
    return (
      <RawPressable
        onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={label}
        style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: 10, borderWidth: selected ? 3 : 1, borderColor: selected ? C.primary : '#8A97A6', backgroundColor: swatch.bg, alignItems: 'center', justifyContent: 'center' }}
      >
        <RawText style={{ color: swatch.fg, fontSize: 13, fontWeight: '600' }}>{label}</RawText>
      </RawPressable>
    );
  }
  return (
    <Pressable
      onPress={onPress} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={label}
      style={{ minHeight: 40, paddingHorizontal: 12, borderRadius: 10, borderWidth: selected ? 2 : 1, borderColor: selected ? C.primary : C.border, backgroundColor: selected ? C.primarySoft : C.card, alignItems: 'center', justifyContent: 'center' }}
    >
      <T v="label" color={selected ? C.primaryDark : C.textSecondary}>{label}</T>
    </Pressable>
  );
}

function Step({ label, value, valueLabel, onChange, min, max }: { label: string; value: number; valueLabel: string; onChange: (v: number) => void; min: number; max: number }) {
  const btn = { width: 40, height: 40, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: C.card, alignItems: 'center' as const, justifyContent: 'center' as const };
  return (
    <View style={{ marginTop: 12 }}>
      <T v="label" color={C.textSecondary}>{label}</T>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
        <Pressable onPress={() => onChange(Math.max(min, value - 1))} accessibilityRole="button" accessibilityLabel={`Decrease ${label}`} style={[btn, value <= min && { opacity: 0.4 }]}><Ionicons name="remove" size={20} color={C.textPrimary} /></Pressable>
        <T v="bodyStrong">{valueLabel}</T>
        <Pressable onPress={() => onChange(Math.min(max, value + 1))} accessibilityRole="button" accessibilityLabel={`Increase ${label}`} style={[btn, value >= max && { opacity: 0.4 }]}><Ionicons name="add" size={20} color={C.textPrimary} /></Pressable>
      </View>
    </View>
  );
}

function Row({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 4 }}>
      <View style={{ flex: 1 }}>
        <T v="body">{label}</T>
        {hint ? <T v="caption" color={C.textSecondary}>{hint}</T> : null}
      </View>
      <Switch value={value} onValueChange={onChange} accessibilityLabel={label} trackColor={{ false: '#CBD5E1', true: C.primaryLight }} thumbColor={Platform.OS === 'android' ? (value ? C.primary : '#F8FAFC') : undefined} />
    </View>
  );
}

function Section({ icon, title, open, onPress, children }: { icon: React.ComponentProps<typeof _Ionicons>['name']; title: string; open: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <View style={{ borderWidth: 1, borderColor: C.border, borderRadius: 12, marginBottom: 10, overflow: 'hidden', backgroundColor: C.card }}>
      <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ expanded: open }} style={{ minHeight: 48, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name={icon} size={18} color={C.primary} />
        <T v="bodyStrong" style={{ flex: 1, marginLeft: 10 }}>{title}</T>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={C.textSecondary} />
      </Pressable>
      {open ? <View style={{ paddingHorizontal: 14, paddingBottom: 12, borderTopWidth: 1, borderTopColor: C.borderLight }}>{children}</View> : null}
    </View>
  );
}

type SectionKey = 'vision' | 'reading' | 'navigation' | 'reader';

export function AccessibilityPanel() {
  const a = useHomeAccessibility();
  const { height, width } = useWindowDimensions();
  const [open, setOpen] = useState<SectionKey | null>('vision');
  const toggle = (k: SectionKey) => setOpen((cur) => (cur === k ? null : k));
  const modes: [typeof a.contrast, string, { bg: string; fg: string } | undefined][] = [
    ['default', 'Light', undefined], ['dark', 'Dark', { bg: '#151F2A', fg: '#E8EEF4' }], ['high', 'High contrast', { bg: '#000000', fg: '#FFFFFF' }],
    ['yellow', 'Yellow on black', { bg: '#000000', fg: '#FFFF00' }], ['sepia', 'Sepia', { bg: '#F4E4C1', fg: '#5C3D11' }],
  ];
  return (
    <View style={{ position: 'absolute', left: 12, bottom: 150, width: Math.min(340, width - 24), maxHeight: Math.min(height * 0.62, 560), borderRadius: 18, overflow: 'hidden', backgroundColor: C.background, borderWidth: 1, borderColor: C.border, ...theme.SHADOWS.large, zIndex: 31 }}>
      <View style={{ backgroundColor: C.primary, paddingHorizontal: 16, paddingVertical: 13, flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name="accessibility-outline" size={20} color="#FFFFFF" />
        <T v="bodyStrong" color="#FFFFFF" style={{ flex: 1, marginLeft: 8 }}>Accessibility</T>
        <Pressable onPress={() => a.setPanelOpen(false)} accessibilityRole="button" accessibilityLabel="Close accessibility settings" hitSlop={10}><Ionicons name="close" size={22} color="#FFFFFF" /></Pressable>
      </View>
      <ScrollView contentContainerStyle={{ padding: 12 }} showsVerticalScrollIndicator>
        <Section icon="eye-outline" title="Vision" open={open === 'vision'} onPress={() => toggle('vision')}>
          <Step label="Text size" value={a.fontSize} min={-2} max={4} valueLabel={a.fontSize === 0 ? 'Default' : `${a.fontSize > 0 ? '+' : ''}${a.fontSize * 10}%`} onChange={(v) => a.update('fontSize', v)} />
          <T v="label" color={C.textSecondary} style={{ marginTop: 14 }}>Appearance</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {modes.map(([key, label, swatch]) => <Option key={key} label={label} swatch={swatch} selected={a.contrast === key} onPress={() => a.update('contrast', key)} />)}
          </View>
          <T v="label" color={C.textSecondary} style={{ marginTop: 14 }}>Colour-blind help</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {[['none', 'Off'], ['deuteranopia', 'Green-weak'], ['protanopia', 'Red-weak'], ['tritanopia', 'Blue-weak']].map(([key, label]) => <Option key={key} label={label} selected={a.colorBlind === key} onPress={() => a.update('colorBlind', key)} />)}
          </View>
          <Step label="Colour strength" value={a.saturation} min={0} max={2} valueLabel={['Full colour', 'Reduced', 'Low'][a.saturation] || 'Full colour'} onChange={(v) => a.update('saturation', v)} />
          <Step label="Screen dimmer" value={a.dimmer} min={0} max={3} valueLabel={a.dimmer === 0 ? 'Off' : `${a.dimmer * 15}% darker`} onChange={(v) => a.update('dimmer', v)} />
          <Step label="Page zoom" value={a.zoom} min={-2} max={2} valueLabel={`${Math.round(a.zoomScale * 100)}%`} onChange={(v) => a.update('zoom', v)} />
          <Row label="Grayscale" value={a.grayscale} onChange={(v) => a.update('grayscale', v)} />
          <Row label="Hide images" hint="Photos are replaced by plain blocks." value={a.hideImages} onChange={(v) => a.update('hideImages', v)} />
          <Row label="Bold text" value={a.boldText} onChange={(v) => a.update('boldText', v)} />
          <Row label="Underline links" value={a.underlineLinks} onChange={(v) => a.update('underlineLinks', v)} />
          <Row label="Highlight links" value={a.highlightLinks} onChange={(v) => a.update('highlightLinks', v)} />
        </Section>
        <Section icon="book-outline" title="Reading" open={open === 'reading'} onPress={() => toggle('reading')}>
          <Row label="Reading guide" hint="A bar follows your finger so you keep your place." value={a.readingGuide} onChange={(v) => a.update('readingGuide', v)} />
          <Row label="Stop animations" hint="No movement, pulsing or sliding." value={a.stopAnimations} onChange={(v) => a.update('stopAnimations', v)} />
          <T v="label" color={C.textSecondary} style={{ marginTop: 10 }}>Language</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
            {LANGUAGES.map((l) => <Option key={l.code} label={l.label} selected={a.language === l.code} onPress={() => a.update('language', l.code)} />)}
          </View>
          <T v="caption" color={C.textTertiary} style={{ marginTop: 6 }}>Words that are not translated yet stay in English.</T>
        </Section>
        <Section icon="navigate-outline" title="Navigation" open={open === 'navigation'} onPress={() => toggle('navigation')}>
          <Row label="Large tap areas" hint="Adds space around every button so it is easier to hit." value={a.keyboardNavigation} onChange={(v) => a.update('keyboardNavigation', v)} />
        </Section>
        <Section icon="volume-high-outline" title="Read aloud" open={open === 'reader'} onPress={() => toggle('reader')}>
          <Row label="Read aloud on long press" hint="Press and hold any text for a moment to hear it." value={a.screenReader} onChange={(v) => { a.update('screenReader', v); if (v) a.speak('Read aloud is on. Press and hold any text to hear it.'); }} />
          {a.screenReader ? (
            <Pressable onPress={() => a.speak('This is how HEWAL3 will read text to you.')} accessibilityRole="button" style={{ alignSelf: 'flex-start', paddingVertical: 8 }}>
              <T v="label" color={C.primary}>Test the voice</T>
            </Pressable>
          ) : null}
          <T v="caption" color={C.textTertiary} style={{ marginTop: 4 }}>VoiceOver and TalkBack keep working as usual; this adds a simple reader inside HEWAL3.</T>
        </Section>
        <Pressable onPress={a.reset} accessibilityRole="button" style={{ alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 4 }}>
          <T v="label" color={C.primary}>Reset everything to default</T>
        </Pressable>
      </ScrollView>
    </View>
  );
}

/** Wrap the whole app in this. It applies the settings that act on the screen as a whole and shows the floating button. */
export function AccessibilityLayer({ children }: { children: React.ReactNode }) {
  const a = useHomeAccessibility();
  const segments = useSegments() as string[];
  const onHome = segments[segments.length - 1] === 'today';      // the button and panel live on the Home screen only; the settings apply everywhere
  const guideY = useSharedValue(-200);
  const press = useRef<{ x: number; y: number; timer: ReturnType<typeof setTimeout> | null; moved: boolean }>({ x: 0, y: 0, timer: null, moved: false });
  const guideStyle = useAnimatedStyle(() => ({ transform: [{ translateY: guideY.value - 26 }] }));

  const cancelPress = () => { if (press.current.timer) { clearTimeout(press.current.timer); press.current.timer = null; } };
  useEffect(() => () => cancelPress(), []);
  useEffect(() => { if (!a.screenReader) cancelPress(); }, [a.screenReader]);

  const onStart = (e: any) => {
    const { pageX, pageY } = e.nativeEvent;
    if (a.readingGuide) guideY.value = pageY;
    if (!a.screenReader) return;
    cancelPress();
    press.current = { x: pageX, y: pageY, moved: false, timer: setTimeout(async () => {
      if (press.current.moved) return;
      const text = await textAt(press.current.x, press.current.y);
      if (text) a.speak(text);
    }, READ_AFTER_MS) };
  };
  const onMove = (e: any) => {
    const { pageX, pageY } = e.nativeEvent;
    if (a.readingGuide) guideY.value = pageY;
    if (Math.abs(pageX - press.current.x) > 12 || Math.abs(pageY - press.current.y) > 12) { press.current.moved = true; cancelPress(); }
  };

  const z = a.zoomScale;
  return (
    <View style={{ flex: 1, overflow: 'hidden' }} onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={cancelPress} onTouchCancel={cancelPress}>
      <ReducedMotionConfig mode={a.stopAnimations ? ReduceMotion.Always : ReduceMotion.System} />
      {z === 1 ? children : (
        // page zoom: lay the app out in a smaller (or larger) space, then scale it to fill the screen
        <View style={{ width: `${100 / z}%`, height: `${100 / z}%`, transform: [{ scale: z }], transformOrigin: 'top left' }}>{children}</View>
      )}

      {a.dimmer > 0 ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: `rgba(0,0,0,${Math.min(0.45, a.dimmer * 0.15)})`, zIndex: 10 }]} /> : null}
      {a.readingGuide ? (
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: 0, right: 0, top: 0, height: 52, zIndex: 12, backgroundColor: 'rgba(255,235,59,0.22)', borderTopWidth: 2, borderBottomWidth: 2, borderColor: 'rgba(255,193,7,0.9)' }, guideStyle]} />
      ) : null}

      {onHome && a.panelOpen ? <AccessibilityPanel /> : null}
      {onHome ? <View pointerEvents="box-none" style={{ position: 'absolute', left: 12, bottom: 92, zIndex: 30 }}>
        <Pressable
          onPress={() => a.setPanelOpen(!a.panelOpen)} accessibilityRole="button"
          accessibilityLabel={a.panelOpen ? 'Close accessibility settings' : 'Open accessibility settings'}
          style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', ...theme.SHADOWS.colored(C.primary) }}
        >
          <Ionicons name={a.panelOpen ? 'close' : 'accessibility-outline'} size={24} color="#FFFFFF" />
        </Pressable>
      </View> : null}
    </View>
  );
}

// kept so older imports of the Home-only widget still resolve; the layer at the root replaces it
export function HomeAccessibilityWidget() {
  return null;
}
