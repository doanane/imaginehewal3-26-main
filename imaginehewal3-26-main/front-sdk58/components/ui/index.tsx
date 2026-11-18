/**
 * HEWAL3 UI kit. One small set of parts so every screen looks and behaves the same.
 * Spacing scale 4/8/16/24/32. Radius 12 (controls) and 16 (cards). Min touch target 44.
 */
import React, { useState } from 'react';
import {
  Modal,
  Platform,
  RefreshControlProps,
  StyleProp,
  StyleSheet,
  TextInputProps,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { theme } from '../../constants/theme';
import { LANGUAGES } from '../../i18n';
import { useHomeAccessibility } from '../homeAccessibilityContext';
import { profileImageSource } from '../../services/imageUrl';
import { ActivityIndicator, Image, Ionicons, KeyboardAvoidingView, Pressable, ScrollView, Text, TextInput, View } from '../themed';

const C = theme.COLORS;
export type IconName = React.ComponentProps<typeof Ionicons>['name'];

/* ------------------------------------------------------------------ Typography */
type Variant = 'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'caption' | 'label' | 'overline';
const TYPE: Record<Variant, TextStyle> = {
  display: { fontSize: 30, lineHeight: 38, fontWeight: '700', letterSpacing: -0.4 },
  title: { fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: -0.2 },
  heading: { fontSize: 17, lineHeight: 24, fontWeight: '600' },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
  bodyStrong: { fontSize: 16, lineHeight: 24, fontWeight: '600' },
  caption: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' },
  overline: { fontSize: 12, lineHeight: 16, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
};
export function T({ v = 'body', color = C.textPrimary, style, children, ...rest }:
  { v?: Variant; color?: string; style?: StyleProp<TextStyle>; children: React.ReactNode } & React.ComponentProps<typeof Text>) {
  // Text size, bold text, colour modes and language are applied by the themed Text itself, for every screen alike.
  return <Text {...rest} style={[TYPE[v], { color }, style]}>{children}</Text>;
}

/* ------------------------------------------------------------------ Layout */
export function Screen({ children, scroll = true, keyboard = false, header, footer, refreshControl, contentStyle, bg = C.background }: {
  children: React.ReactNode; scroll?: boolean; keyboard?: boolean; header?: React.ReactNode; footer?: React.ReactNode;
  refreshControl?: React.ReactElement<RefreshControlProps>; contentStyle?: StyleProp<ViewStyle>; bg?: string;
}) {
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView
      refreshControl={refreshControl}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={[{ padding: 16, paddingBottom: 32 }, contentStyle]}
    >{children}</ScrollView>
  ) : <View style={[{ flex: 1 }, contentStyle]}>{children}</View>;
  const inner = (<>{header}{body}{footer}</>);
  return keyboard ? (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: bg }}
      behavior="padding"
      keyboardVerticalOffset={insets.top}
    >{inner}</KeyboardAvoidingView>
  ) : <View style={{ flex: 1, backgroundColor: bg }}>{inner}</View>;
}

/** Light / dark switch, shown at the top of every screen. It changes the whole app at once and is remembered for the account. */
export function ThemeToggle() {
  const { dark, toggleDark, contrast } = useHomeAccessibility();
  const isDark = contrast === 'dark';
  return <IconButton icon={isDark ? 'sunny-outline' : 'moon-outline'} label={isDark ? 'Switch to light mode' : 'Switch to dark mode'} onPress={toggleDark} color={dark && !isDark ? C.textSecondary : C.textPrimary} />;
}

export function ScreenHeader({ title, subtitle, onBack, right }: {
  title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode;
}) {
  return (
    <View style={s.header}>
      {onBack ? <IconButton icon="chevron-back" label="Back" onPress={onBack} /> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T v="title" numberOfLines={1}>{title}</T>
        {subtitle ? <T v="caption" color={C.textSecondary} numberOfLines={1}>{subtitle}</T> : null}
      </View>
      {right}
      <ThemeToggle />
    </View>
  );
}

/**
 * Language switch: a globe in the header (or, with `pill`, a globe and the language's name). It opens a list of every language the app offers.
 * The choice is saved on the phone and the account and applies at once. Text that has not been translated yet stays in English.
 */
export function LanguageSwitch({ pill }: { pill?: boolean }) {
  const a = useHomeAccessibility();
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const current = LANGUAGES.find((l) => l.code === a.language) ?? LANGUAGES[0];
  const choose = (code: string) => { a.update('language', code); setOpen(false); };
  return (
    <>
      {pill ? (
        <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel={`Language: ${current.label}. Change language`} hitSlop={8}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 4 }}>
          <Ionicons name="globe-outline" size={22} color={C.textSecondary} />
          <Text style={{ color: C.textSecondary, fontSize: 16 }}>{current.label}</Text>
        </Pressable>
      ) : <IconButton icon="globe-outline" label={`Language: ${current.label}. Change language`} onPress={() => setOpen(true)} />}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)} statusBarTranslucent>
        <Pressable style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' }} onPress={() => setOpen(false)} accessibilityLabel="Close language list">
          <Pressable onPress={() => undefined} style={{ backgroundColor: C.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10, paddingBottom: insets.bottom + 16 }}>
            <View style={{ alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: C.border, marginBottom: 12 }} />
            <Text style={{ color: C.textPrimary, fontSize: 20, fontWeight: '700', paddingHorizontal: 20 }}>Language</Text>
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingVertical: 6 }}>
              {LANGUAGES.map((l) => {
                const on = l.code === current.code;
                return (
                  <Pressable key={l.code} onPress={() => choose(l.code)} accessibilityRole="radio" accessibilityState={{ selected: on }} accessibilityLabel={`${l.label}${l.translated ? '' : ', partly translated'}`}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: C.textPrimary, fontSize: 17, fontWeight: on ? '700' : '400' }}>{l.label}</Text>
                      {l.translated ? null : <Text style={{ color: C.textTertiary, fontSize: 13 }}>Partly translated. The rest stays in English.</Text>}
                    </View>
                    {on ? <Ionicons name="checkmark-circle" size={24} color={C.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Text style={{ color: C.textTertiary, fontSize: 13, paddingHorizontal: 20, marginTop: 6 }}>Screens that are not translated yet stay in English. Health advice is never machine translated.</Text>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

export function Card({ children, style, onPress, tone = 'default' }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; tone?: 'default' | 'soft' | 'danger';
}) {
  const bg = tone === 'soft' ? C.primarySoft : tone === 'danger' ? C.dangerLight : C.card;
  const bd = tone === 'soft' ? 'transparent' : tone === 'danger' ? '#F2C4BF' : C.borderLight;
  const base: ViewStyle = { backgroundColor: bg, borderColor: bd, borderWidth: 1, borderRadius: 16, padding: 16 };
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [base, pressed && { opacity: 0.85 }, style]}>{children}</Pressable>
  ) : <View style={[base, style]}>{children}</View>;
}

export function Section({ title, action, onAction, children }: {
  title: string; action?: string; onAction?: () => void; children: React.ReactNode;
}) {
  return (
    <View style={{ marginTop: 24 }}>
      <View style={s.sectionHead}>
        <T v="heading">{title}</T>
        {action ? <Pressable onPress={onAction} hitSlop={8}><T v="label" color={C.primary}>{action}</T></Pressable> : null}
      </View>
      {children}
    </View>
  );
}

/* ------------------------------------------------------------------ Controls */
export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, style, textColor }: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; icon?: IconName;
  loading?: boolean; disabled?: boolean; style?: StyleProp<ViewStyle>; textColor?: string;
}) {
  const palette = {
    primary: { bg: C.primary, fg: '#fff', bd: C.primary }, secondary: { bg: '#fff', fg: C.primary, bd: C.border },
    ghost: { bg: 'transparent', fg: C.primary, bd: 'transparent' }, danger: { bg: C.danger, fg: '#fff', bd: C.danger },
  }[variant];
  if (textColor) palette.fg = textColor;
  const off = disabled || loading;
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      onPress={off ? undefined : onPress} accessibilityRole="button" accessibilityState={{ disabled: !!off, busy: !!loading }}
      onPressIn={() => { if (!off) scale.value = withSpring(0.975, { damping: 16, stiffness: 280 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 16, stiffness: 240 }); }}
      style={({ pressed }) => [s.btn, { backgroundColor: palette.bg, borderColor: palette.bd, opacity: off ? 0.5 : pressed ? 0.88 : 1 }, style]}
    >
      <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }, animatedStyle]}>
        {loading ? <ActivityIndicator color={palette.fg} /> : (
          <>{icon ? <Ionicons name={icon} size={18} color={palette.fg} style={{ marginRight: 8 }} /> : null}
            <Text style={{ color: palette.fg, fontSize: 16, fontWeight: '600' }}>{title}</Text></>
        )}
      </Animated.View>
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, color = C.textPrimary, filled }: {
  icon: IconName; label: string; onPress: () => void; color?: string; filled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6}
      style={({ pressed }) => [s.iconBtn, filled && { backgroundColor: C.primary }, pressed && { opacity: 0.7 }]}>
      <Ionicons name={icon} size={22} color={filled ? '#fff' : color} />
    </Pressable>
  );
}

export function TextField({ label, error, helper, secure, style, inputRef, ...props }: TextInputProps & {
  label?: string; error?: string; helper?: string; secure?: boolean; style?: StyleProp<ViewStyle>; inputRef?: React.Ref<any>;
}) {
  const [hidden, setHidden] = useState(!!secure);
  const [focus, setFocus] = useState(false);
  return (
    <View style={[{ marginBottom: 16 }, style]}>
      {label ? <T v="label" color={C.textSecondary} style={{ marginBottom: 6 }}>{label}</T> : null}
      <View style={[s.field, { borderColor: error ? C.danger : focus ? C.primary : C.border, borderWidth: focus ? 2 : 1 }]}>
        <TextInput
          {...props}
          ref={inputRef}
          secureTextEntry={hidden}
          onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
          placeholderTextColor={C.textMuted}
          accessibilityLabel={label || props.placeholder}
          style={[s.input, props.multiline && { minHeight: 96, textAlignVertical: 'top', paddingTop: 12 }]}
        />
        {secure ? (
          <Pressable onPress={() => setHidden((h) => !h)} hitSlop={8} accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
            <Ionicons name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} color={C.textSecondary} />
          </Pressable>
        ) : null}
      </View>
      {error ? <T v="caption" color={C.danger} style={{ marginTop: 4 }}>{error}</T>
        : helper ? <T v="caption" color={C.textSecondary} style={{ marginTop: 4 }}>{helper}</T> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress, icon }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!selected }}
      style={[s.chip, selected && { backgroundColor: C.primary, borderColor: C.primary }]}>
      {icon ? <Ionicons name={icon} size={16} color={selected ? '#fff' : C.primary} style={{ marginRight: 6 }} /> : null}
      <Text style={{ color: selected ? '#fff' : C.textPrimary, fontSize: 14, fontWeight: '500' }}>{label}</Text>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ Data display */
export function Badge({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'success' | 'warning' | 'danger' | 'info' }) {
  const m = { neutral: [C.borderLight, C.textSecondary], success: [C.successLight, C.success], warning: [C.warningLight, C.warning],
    danger: [C.dangerLight, C.danger], info: [C.infoLight, C.info] }[tone];
  return <View style={{ backgroundColor: m[0], borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' }}>
    <Text style={{ color: m[1], fontSize: 12, fontWeight: '600' }}>{label}</Text></View>;
}

export function Stat({ icon, label, value, unit, tone = 'primary' }: {
  icon: IconName; label: string; value: string | number; unit?: string; tone?: 'primary' | 'success' | 'warning' | 'danger' | 'info';
}) {
  const col = { primary: C.primary, success: C.success, warning: C.warning, danger: C.danger, info: C.info }[tone];
  return (
    <Card style={{ flex: 1, minWidth: 140 }}>
      <View style={[s.statIcon, { backgroundColor: C.background }]}><Ionicons name={icon} size={18} color={col} /></View>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', marginTop: 12 }}>
        <T v="title">{value}</T>{unit ? <T v="caption" color={C.textSecondary} style={{ marginLeft: 4 }}>{unit}</T> : null}
      </View>
      <T v="caption" color={C.textSecondary}>{label}</T>
    </Card>
  );
}

export function ProgressBar({ value, color = C.primary }: { value: number; color?: string }) {
  const pct = Math.max(0, Math.min(1, value));
  return <View style={s.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: Math.round(pct * 100) }}>
    <View style={{ width: `${pct * 100}%`, height: '100%', backgroundColor: color, borderRadius: 4 }} /></View>;
}

export function Avatar({ name, size = 44, online, photo }: { name: string; size?: number; online?: boolean; photo?: string | null }) {
  const initials = (name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?';
  const src = profileImageSource(photo);
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
        {src ? <Image source={src as any} style={{ width: size, height: size }} accessibilityLabel={`${name}'s picture`} />
          : <Text style={{ color: C.primary, fontWeight: '700', fontSize: size * 0.36 }}>{initials}</Text>}</View>
      {online !== undefined ? <View style={[s.dot, { backgroundColor: online ? C.success : C.offline }]} /> : null}
    </View>
  );
}

export function ListRow({ icon, title, subtitle, right, onPress, danger }: {
  icon?: IconName; title: string; subtitle?: string; right?: React.ReactNode; onPress?: () => void; danger?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => [s.row, pressed && { backgroundColor: C.background }]}>
      {icon ? <View style={s.rowIcon}><Ionicons name={icon} size={20} color={danger ? C.danger : C.primary} /></View> : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T v="bodyStrong" color={danger ? C.danger : C.textPrimary} numberOfLines={1}>{title}</T>
        {subtitle ? <T v="caption" color={C.textSecondary} numberOfLines={2}>{subtitle}</T> : null}
      </View>
      {right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={C.textMuted} /> : null)}
    </Pressable>
  );
}

export function Banner({ tone = 'info', title, text, action, onAction, icon }: {
  tone?: 'info' | 'warning' | 'danger' | 'success'; title?: string; text: string; action?: string; onAction?: () => void; icon?: IconName;
}) {
  const m = { info: [C.infoLight, C.info, 'information-circle-outline'], warning: [C.warningLight, C.warning, 'alert-circle-outline'],
    danger: [C.dangerLight, C.danger, 'warning-outline'], success: [C.successLight, C.success, 'checkmark-circle-outline'] }[tone] as [string, string, IconName];
  return (
    <View style={{ backgroundColor: m[0], borderRadius: 12, padding: 14, flexDirection: 'row', gap: 12 }} accessibilityRole="alert">
      <Ionicons name={icon || m[2]} size={22} color={m[1]} />
      <View style={{ flex: 1 }}>
        {title ? <T v="bodyStrong" color={m[1]}>{title}</T> : null}
        <T v="caption" color={C.textPrimary}>{text}</T>
        {action ? <Pressable onPress={onAction} hitSlop={8} style={{ marginTop: 8 }}><T v="label" color={m[1]}>{action}</T></Pressable> : null}
      </View>
    </View>
  );
}

export function EmptyState({ icon, title, text, action, onAction }: { icon: IconName; title: string; text: string; action?: string; onAction?: () => void }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 24 }}>
      <View style={[s.emptyIcon]}><Ionicons name={icon} size={28} color={C.primary} /></View>
      <T v="heading" style={{ marginTop: 16, textAlign: 'center' }}>{title}</T>
      <T v="caption" color={C.textSecondary} style={{ marginTop: 4, textAlign: 'center' }}>{text}</T>
      {action ? <Button title={action} onPress={onAction!} style={{ marginTop: 16, alignSelf: 'stretch' }} /> : null}
    </View>
  );
}

export function Skeleton({ height = 16, width = '100%', style }: { height?: number; width?: number | string; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height, width: width as any, borderRadius: 8, backgroundColor: C.borderLight }, style]} />;
}

const s = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, backgroundColor: C.background },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  btn: { minHeight: 52, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  iconBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  field: { minHeight: 52, borderRadius: 12, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 16, color: C.textPrimary, paddingVertical: 12 },
  chip: { minHeight: 36, flexDirection: 'row', alignItems: 'center', borderRadius: 18, borderWidth: 1, borderColor: C.border, backgroundColor: '#fff', paddingHorizontal: 14 },
  statIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  track: { height: 8, borderRadius: 4, backgroundColor: C.borderLight, overflow: 'hidden' },
  dot: { position: 'absolute', right: 0, bottom: 0, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 10, paddingHorizontal: 4 },
  rowIcon: { width: 40, height: 40, borderRadius: 12, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
