import React, { useEffect, useState } from 'react';
import { Keyboard, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';
import { T } from './ui';
import { ActivityIndicator, ImageBackground, Ionicons, Pressable, TextInput, View } from './themed';

const C = theme.COLORS;

/** True while the software keyboard is open. */
export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', () => setOpen(true));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setOpen(false));
    return () => { show.remove(); hide.remove(); };
  }, []);
  return open;
}

/**
 * Message composer. Sits directly above the keyboard (the parent Screen uses keyboard avoidance),
 * grows up to 5 lines so the user always sees what they are typing, and never hides behind the keyboard.
 * Pass `safeBottom` on screens with no tab bar so it clears the home indicator when the keyboard is closed.
 */
export function Composer({ value, onChange, onSend, placeholder, sending, safeBottom, maxLength = 2000 }: {
  value: string; onChange: (v: string) => void; onSend: () => void; placeholder: string;
  sending?: boolean; safeBottom?: boolean; maxLength?: number;
}) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardOpen();
  const canSend = value.trim().length > 0 && !sending;
  return (
    <View style={[st.bar, { paddingBottom: 10 + (safeBottom && !kb ? insets.bottom : 0) }]}>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={C.textMuted}
        multiline
        maxLength={maxLength}
        style={st.input}
        accessibilityLabel={placeholder}
        returnKeyType="default"
        blurOnSubmit={false}
        textAlignVertical="center"
      />
      <Pressable onPress={canSend ? onSend : undefined} accessibilityRole="button" accessibilityLabel="Send message"
        accessibilityState={{ disabled: !canSend }}
        style={[st.send, { backgroundColor: canSend ? C.primary : C.border }]}>
        {sending ? <ActivityIndicator color="#fff" /> : <Ionicons name="arrow-up" size={22} color="#fff" />}
      </Pressable>
    </View>
  );
}

export function Bubble({ text, mine, time, tone = 'default', footer }: {
  text: string; mine?: boolean; time?: string; tone?: 'default' | 'danger'; footer?: React.ReactNode;
}) {
  const bg = mine ? C.primary : tone === 'danger' ? C.dangerLight : '#fff';
  const fg = mine ? '#fff' : C.textPrimary;
  return (
    <View style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '82%', marginVertical: 4 }}>
      <View style={[st.bubble, { backgroundColor: bg, borderColor: mine ? C.primary : tone === 'danger' ? '#F2C4BF' : C.borderLight,
        borderBottomRightRadius: mine ? 4 : 18, borderBottomLeftRadius: mine ? 18 : 4 }]}>
        <T v="body" color={fg} selectable>{text}</T>
        {footer}
      </View>
      {time ? <T v="caption" color={C.textTertiary} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', marginTop: 2, fontSize: 12 }}>{time}</T> : null}
    </View>
  );
}

const st = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 10, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.separator },
  input: { flex: 1, minHeight: 44, maxHeight: 132, borderRadius: 22, borderWidth: 1, borderColor: C.border, backgroundColor: C.background,
    paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 12 : 8, paddingBottom: Platform.OS === 'ios' ? 12 : 8, fontSize: 16, color: C.textPrimary },
  send: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  bubble: { borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 },
});


/** The soft symbol pattern from the welcome screen, behind every conversation. The tile is transparent grey, so it suits light and dark.
 *  iPhone repeats the tile; Android has no repeat mode, so the picture is stretched across the chat instead. */
export function ChatWallpaper({ children }: { children: React.ReactNode }) {
  return (
    <ImageBackground source={require('../assets/images/chat-wallpaper.png')} resizeMode={Platform.OS === 'ios' ? 'repeat' : 'cover'} style={{ flex: 1 }}>
      {children}
    </ImageBackground>
  );
}
