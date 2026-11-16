import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut, SlideInDown, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useKeyboardOpen } from './ChatParts';
import { IconName, T } from './ui';
import { QuickTile, useQuickTileWidth } from './ui/QuickTile';
import { PressScale, tap } from './ui/motion';
import { QUICK } from '../constants/quickActions';
import { theme } from '../constants/theme';
import { Ionicons, LinearGradient, Pressable, Text, View } from './themed';

const C = theme.COLORS;

const LEFT = ['today', 'insights'];
const RIGHT = ['community', 'assistant'];
const META: Record<string, { label: string; icon: IconName; active: IconName }> = {
  today: { label: 'Home', icon: 'home-outline', active: 'home' },
  insights: { label: 'Health', icon: 'pulse-outline', active: 'pulse' },
  community: { label: 'Community', icon: 'chatbubbles-outline', active: 'chatbubbles' },
  assistant: { label: 'Assistant', icon: 'sparkles-outline', active: 'sparkles' },
};


function TabItem({ name, focused, badge, onPress }: { name: string; focused: boolean; badge?: number; onPress: () => void }) {
  const m = META[name];
  const lift = useSharedValue(0);
  useEffect(() => { lift.value = withSpring(focused ? -3 : 0, { damping: 12, stiffness: 220 }); }, [focused]);
  const a = useAnimatedStyle(() => ({ transform: [{ translateY: lift.value }] }));
  return (
    <Pressable onPress={onPress} style={st.item} accessibilityRole="tab" accessibilityState={{ selected: focused }} accessibilityLabel={m.label}>
      <Animated.View style={[{ alignItems: 'center' }, a]}>
        <View>
          <Ionicons name={focused ? m.active : m.icon} size={24} color={focused ? C.primary : C.textTertiary} />
          {badge ? <View style={st.badge}><Text style={st.badgeText}>{badge > 9 ? '9+' : badge}</Text></View> : null}
        </View>
        <Text style={[st.label, { color: focused ? C.primary : C.textTertiary, fontWeight: focused ? '700' : '600' }]}>{m.label}</Text>
      </Animated.View>
    </Pressable>
  );
}

function QuickAdd({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tileW = useQuickTileWidth(40);

  const openQuickAction = (path: string) => {
    onClose();
    requestAnimationFrame(() => {
      router.push(path as any);
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      onDismiss={onClose}
      statusBarTranslucent
    >
      <Animated.View entering={FadeIn.duration(180)} exiting={FadeOut.duration(150)} style={st.scrim}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      </Animated.View>
      <Animated.View entering={SlideInDown.springify().damping(20)} style={[st.sheet, { paddingBottom: 20 + insets.bottom }]}>
        <View style={st.grabber} />
        <T v="title" style={{ marginBottom: 4 }}>Quick add</T>
        <T v="caption" color={C.textSecondary} style={{ marginBottom: 16 }}>Log something or get help in a tap.</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 18 }}>
          {QUICK.map((q, i) => <QuickTile key={q.label} item={q} index={i} width={tileW} size={64} onPress={() => openQuickAction(q.path)} />)}
        </View>
      </Animated.View>
    </Modal>
  );
}

export default function TabBar({ state }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const kb = useKeyboardOpen();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const current = state.routes[state.index]?.name;
  const rot = useSharedValue(0);
  useEffect(() => { rot.value = withSpring(open ? 45 : 0, { damping: 14, stiffness: 200 }); }, [open]);
  const plus = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));

  if (kb) return null;
  const go = (name: string) => {
    if (current === name) return;
    tap();
    router.navigate(`/(patient)/(tabs)/${name}` as any);
  };
  const item = (name: string) => (
    <TabItem key={name} name={name} focused={current === name} badge={undefined} onPress={() => go(name)} />
  );

  return (
    <>
      <View style={[st.bar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
        {LEFT.map(item)}
        <View style={st.fabSlot}>
          <PressScale label="Quick add" onPress={() => setOpen((o) => !o)} style={st.fabShadow}>
            <LinearGradient colors={['#0B6E6E', '#0A7C99']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.fab}>
              <Animated.View style={plus}><Ionicons name="add" size={34} color="#fff" /></Animated.View>
            </LinearGradient>
          </PressScale>
        </View>
        {RIGHT.map(item)}
      </View>
      <QuickAdd visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

const st = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'flex-end', backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10,
    shadowColor: '#10202F', shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: -4 }, elevation: 16 },
  item: { flex: 1, alignItems: 'center', paddingBottom: 2, minHeight: 48 },
  label: { fontSize: 12, marginTop: 2 },
  fabSlot: { width: 84, alignItems: 'center' },
  fabShadow: { marginTop: -34, borderRadius: 34, shadowColor: C.primary, shadowOpacity: 0.4, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 12 },
  fab: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: '#fff' },
  badge: { position: 'absolute', top: -4, right: -10, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  scrim: { ...(StyleSheet.absoluteFill as object), backgroundColor: 'rgba(16,32,47,0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: C.border, marginBottom: 16 },
});
