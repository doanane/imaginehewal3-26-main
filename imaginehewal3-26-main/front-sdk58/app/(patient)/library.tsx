import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { NativeScrollEvent, NativeSyntheticEvent, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Dots, FeatureCard, Photo, Tabs } from '../../components/explore/cards';
import { Banner, EmptyState, IconButton, Screen, Skeleton, T } from '../../components/ui';
import { Reveal } from '../../components/ui/motion';
import { theme } from '../../constants/theme';
import api, { Article } from '../../services/api';
import { Ionicons, Pressable, RefreshControl, ScrollView, TextInput, View } from '../../components/themed';

const C = theme.COLORS;
type Tab = 'all' | 'foryou' | 'saved';
const TABS: { k: Tab; label: string }[] = [{ k: 'all', label: 'All' }, { k: 'foryou', label: 'For you' }, { k: 'saved', label: 'Saved' }];

function Row({ a, onPress }: { a: Article; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${a.title}. ${a.category_label}. ${a.minutes} minute read${a.read ? '. Read' : ''}`}
      style={{ flexDirection: 'row', gap: 14, alignItems: 'center', paddingVertical: 12 }}>
      <View style={{ width: 84 }}><Photo uri={a.image} icon="book-outline" height={64} radius={10} /></View>
      <View style={{ flex: 1 }}>
        <T v="label" color={C.primary} style={{ fontSize: 13 }}>{a.category_label}</T>
        <T v="bodyStrong" numberOfLines={2} style={{ marginTop: 2 }}>{a.title}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <T v="caption" color={C.textSecondary}>{a.minutes} min read</T>
          {a.read ? <Ionicons name="checkmark-circle" size={15} color={C.success} /> : null}
          {a.saved ? <Ionicons name="bookmark" size={14} color={C.primary} /> : null}
        </View>
      </View>
    </Pressable>
  );
}

export default function Library() {
  const router = useRouter();
  const { width: screen } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Article[] | null>(null);
  const [cats, setCats] = useState<{ key: string; label: string }[]>([]);
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<Tab>('all');
  const [cat, setCat] = useState('');
  const [q, setQ] = useState('');
  const [slide, setSlide] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const state = useRef({ cat, q }); state.current = { cat, q };

  const load = useCallback(async () => {
    try {
      const r = await api.getLibrary(state.current.cat || undefined, state.current.q.trim());
      setItems(r.items); setCats(r.categories); setNotice(r.notice); setErr(null);
    } catch (e: any) { setErr(e.message || 'Could not load the library.'); }
    setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [cat, q, load]);          // search as you type, after a short pause

  const open = (a: Article) => router.push({ pathname: '/(patient)/article' as any, params: { key: a.key } });
  const featured = (items ?? []).filter((a) => a.featured);
  const list = (items ?? []).filter((a) => (tab === 'saved' ? a.saved : tab === 'foryou' ? a.for_you : true));
  const w = screen - 32;
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => setSlide(Math.round(e.nativeEvent.contentOffset.x / (w + 12)));

  return (
    <ProtectedRoute>
      <Screen refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.primary} onRefresh={() => { setRefreshing(true); api.invalidateApiCache(); load(); }} />}
        header={<View style={{ paddingTop: insets.top + 4, paddingHorizontal: 8 }}><IconButton icon="chevron-back" label="Back" onPress={() => router.back()} color={C.primary} /></View>}>
        <T v="display" style={{ fontSize: 34, lineHeight: 40 }}>Library</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.borderLight, borderRadius: 999, paddingHorizontal: 14, height: 44, marginTop: 14 }}>
          <Ionicons name="search-outline" size={18} color={C.textSecondary} />
          <TextInput value={q} onChangeText={setQ} placeholder="Search the library" placeholderTextColor={C.textTertiary} autoCorrect={false} returnKeyType="search"
            accessibilityLabel="Search the library" style={{ flex: 1, fontSize: 15, color: C.textPrimary }} />
          {q ? <Pressable onPress={() => setQ('')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Clear search"><Ionicons name="close-circle" size={18} color={C.textSecondary} /></Pressable> : null}
        </View>

        {err ? <View style={{ marginTop: 12 }}><Banner tone="danger" text={err} /></View> : null}

        {featured.length && !q && !cat && tab === 'all' ? (
          <View style={{ marginTop: 18 }}>
            <ScrollView horizontal pagingEnabled={false} snapToInterval={w + 12} decelerationRate="fast" showsHorizontalScrollIndicator={false} onScroll={onScroll} scrollEventThrottle={16} contentContainerStyle={{ gap: 12 }}>
              {featured.map((a) => <View key={a.key} style={{ width: w }}><FeatureCard uri={a.image} tag="Featured" title={a.title} line={`${a.minutes} min read`} width={w} onPress={() => open(a)} /></View>)}
            </ScrollView>
            <Dots count={featured.length} index={Math.max(0, Math.min(featured.length - 1, slide))} />
          </View>
        ) : null}

        <View style={{ marginTop: 18 }}><Tabs tabs={TABS} value={tab} onChange={setTab} /></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 14 }}>
          {[{ key: '', label: 'All topics' }, ...cats].map((c) => {
            const on = cat === c.key;
            return (
              <Pressable key={c.key || 'all'} onPress={() => setCat(c.key)} accessibilityRole="button" accessibilityState={{ selected: on }}
                style={{ paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: on ? C.primary : C.borderLight }}>
                <T v="label" color={on ? '#fff' : C.textPrimary}>{c.label}</T>
              </Pressable>
            );
          })}
        </ScrollView>

        {!items ? <Skeleton height={90} /> : list.length === 0 ? (
          <EmptyState icon={tab === 'saved' ? 'bookmark-outline' : 'search-outline'} title={tab === 'saved' ? 'Nothing saved yet' : tab === 'foryou' ? 'Nothing special for you right now' : 'No articles found'}
            text={tab === 'saved' ? 'Tap the bookmark on an article to keep it here.' : tab === 'foryou' ? 'As you add sleep, meals, check-ins and activity, we suggest topics where there is room to grow.' : 'Try a different word or choose another topic.'} />
        ) : list.map((a, i) => <Reveal key={a.key} index={i}><Row a={a} onPress={() => open(a)} /></Reveal>)}
        {notice ? <T v="caption" color={C.textTertiary} style={{ marginTop: 12 }}>{notice}</T> : null}
        <View style={{ height: 40 }} />
      </Screen>
    </ProtectedRoute>
  );
}
