import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Carousel, ImageCard } from '../../../components/explore/cards';
import { PostImages } from '../../../components/PostImages';
import { Avatar, Badge, Banner, Card, Chip, EmptyState, IconButton, Screen, ScreenHeader, Skeleton, T } from '../../../components/ui';
import { theme } from '../../../constants/theme';
import { useMessaging } from '../../../contexts/MessagingContext';
import api, { ChallengeList, CommunityPost, InterestGroup, assetUrl } from '../../../services/api';
import realtime from '../../../services/realtime';
import { ActivityIndicator, FlatList, Image, Ionicons, Pressable, RefreshControl, View } from '../../../components/themed';

const C = theme.COLORS;
const TABS: { k: string; label: string }[] = [{ k: '', label: 'All' }, { k: 'discussion', label: 'Discussions' }, { k: 'tip', label: 'Tips' }, { k: 'marketplace', label: 'Marketplace' }];
const CAT_LABEL: Record<string, string> = { discussion: 'Discussion', tip: 'Tip', marketplace: 'For sale' };
export const ago = (iso: string | null) => {
  if (!iso) return '';
  const s = Math.max(1, (Date.now() - new Date(iso.endsWith('Z') ? iso : iso + 'Z').getTime()) / 1000);
  return s < 60 ? 'now' : s < 3600 ? `${Math.floor(s / 60)}m` : s < 86400 ? `${Math.floor(s / 3600)}h` : `${Math.floor(s / 86400)}d`;
};

export function PostCard({ p, onOpen, onLike }: { p: CommunityPost; onOpen: () => void; onLike: () => void }) {
  return (
    <Pressable onPress={onOpen} accessibilityRole="button" accessibilityLabel={`Post by ${p.author}: ${p.title || p.body.slice(0, 60)}`}>
      <Card style={{ marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Avatar name={p.author} size={38} />
          <View style={{ flex: 1 }}><T v="bodyStrong">{p.mine ? `${p.author} (you)` : p.author}</T><T v="caption" color={C.textSecondary}>{ago(p.created_at)}</T></View>
          <Badge label={CAT_LABEL[p.category]} tone={p.category === 'marketplace' ? 'warning' : p.category === 'tip' ? 'success' : 'info'} />
        </View>
        {p.title ? <T v="heading" style={{ marginTop: 10 }}>{p.title}</T> : null}
        <T v="body" numberOfLines={5} style={{ marginTop: p.title ? 4 : 10 }}>{p.body}</T>
        {p.category === 'marketplace' && p.price != null ? <T v="title" color={C.primary} style={{ marginTop: 8 }}>{p.currency} {p.price.toLocaleString()}{p.product_category ? <T v="caption" color={C.textSecondary}>  {p.product_category}</T> : null}</T> : null}
        {p.image_urls?.length ? <PostImages urls={p.image_urls} height={190} compact /> : null}
        <View style={{ flexDirection: 'row', gap: 22, marginTop: 12 }}>
          <Pressable onPress={onLike} hitSlop={10} accessibilityRole="button" accessibilityLabel={p.liked ? 'Unlike' : 'Like'} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Ionicons name={p.liked ? 'heart' : 'heart-outline'} size={21} color={p.liked ? C.danger : C.textSecondary} /><T v="label" color={C.textSecondary}>{p.likes}</T>
          </Pressable>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}><Ionicons name="chatbubble-outline" size={20} color={C.textSecondary} /><T v="label" color={C.textSecondary}>{p.comments}</T></View>
        </View>
      </Card>
    </Pressable>
  );
}

type Hub = { challenges: ChallengeList | null; groups: InterestGroup[] | null };
const EMPTY_HUB: Hub = { challenges: null, groups: null };

function SectionHead({ title, onAll }: { title: string; onAll: () => void }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 26, marginBottom: 12 }}>
      <T v="title" style={{ fontSize: 22 }}>{title}</T>
      <Pressable onPress={onAll} hitSlop={10} accessibilityRole="button" accessibilityLabel={`View all ${title.toLowerCase()}`}><T v="label" color={C.primary}>View all</T></Pressable>
    </View>
  );
}

function Shortcut({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 999, backgroundColor: C.primarySoft }}>
      <Ionicons name={icon as any} size={17} color={C.primary} /><T v="label" color={C.primary} numberOfLines={1}>{label}</T>
    </Pressable>
  );
}

/** Explore: a row of shortcuts, then this week's challenges and the interest communities as picture cards you swipe through. */
function ExploreView({ hub, loading, go }: { hub: Hub; loading: boolean; go: (path: string, params?: Record<string, string>) => void }) {
  const chs = hub.challenges ? [...hub.challenges.items.filter((c) => c.joined), ...hub.challenges.items.filter((c) => !c.joined)] : [];
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Shortcut icon="library-outline" label="Library" onPress={() => go('/(patient)/library')} />
        <Shortcut icon="speedometer-outline" label="Score" onPress={() => go('/(patient)/wellbeing-score')} />
        <Shortcut icon="star-outline" label="Reviews" onPress={() => go('/(patient)/community/reviews')} />
      </View>

      <SectionHead title="Challenges" onAll={() => go('/(patient)/challenges')} />
      {chs.length ? (
        <Carousel items={chs} keyOf={(c) => c.key}
          render={(c) => <ImageCard uri={c.image} icon={c.icon} title={c.title} subtitle={c.tagline} badge={c.done ? 'Completed' : c.joined ? 'Joined' : undefined}
            label={`${c.title}. ${c.tagline}`} onPress={() => go('/(patient)/challenge', { key: c.key })} />} />
      ) : loading ? <Skeleton height={220} /> : <T v="caption" color={C.textSecondary}>Challenges could not be loaded. Pull down to try again.</T>}

      <SectionHead title="Communities" onAll={() => go('/(patient)/groups')} />
      {hub.groups ? (
        <Carousel items={[...hub.groups.filter((g) => g.joined), ...hub.groups.filter((g) => !g.joined)]} keyOf={(g) => g.key}
          render={(g) => <ImageCard uri={g.image} icon={g.icon} title={g.title} subtitle={g.joined ? 'Joined' : g.members ? `${g.members} members` : g.about}
            label={`${g.title}. ${g.joined ? 'Joined' : 'Not joined'}`} onPress={() => go('/(patient)/group', { key: g.key })} />} />
      ) : loading ? <Skeleton height={220} /> : <T v="caption" color={C.textSecondary}>Communities could not be loaded. Pull down to try again.</T>}
      <View style={{ height: 130 }} />
    </View>
  );
}

export default function Community() {
  const router = useRouter();
  const { unreadCount } = useMessaging();
  const [view, setView] = useState<'explore' | 'posts'>('posts');
  const [hub, setHub] = useState<Hub>(EMPTY_HUB);
  const [hubLoading, setHubLoading] = useState(true);
  const [tab, setTab] = useState('');
  const [items, setItems] = useState<CommunityPost[]>([]);
  const [next, setNext] = useState<number | null>(null);
  const [disclaimer, setDisclaimer] = useState('');
  const [loading, setLoading] = useState(true);
  const [more, setMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [fresh, setFresh] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const tabRef = useRef(tab); tabRef.current = tab;

  const loadHub = useCallback(async () => {
    // each part loads on its own, so one slow or failed part never blanks the other
    const [challenges, groups] = await Promise.allSettled([api.getChallenges(), api.getGroups()]);
    setHub({ challenges: challenges.status === 'fulfilled' ? challenges.value : null, groups: groups.status === 'fulfilled' ? groups.value.items : null });
    setHubLoading(false); setRefreshing(false);
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await api.getFeed(tabRef.current || undefined);
      setItems(r.items); setNext(r.next_before_id); setDisclaimer(r.disclaimer); setErr(null); setFresh(0);
    } catch (e: any) { setErr(e.message || 'Could not load the community.'); }
    setLoading(false); setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { if (view === 'explore') loadHub(); else load(); }, [view, loadHub, load, tab]));
  useEffect(() => { setLoading(true); }, [tab]);

  useEffect(() => realtime.on('community.new', () => setFresh((n) => n + 1)), []);

  const loadMore = async () => {
    if (!next || more) return;
    setMore(true);
    try { const r = await api.getFeed(tab || undefined, next); setItems((x) => [...x, ...r.items]); setNext(r.next_before_id); } catch { /* keep what we have */ }
    setMore(false);
  };
  const like = async (p: CommunityPost) => {
    setItems((x) => x.map((i) => (i.id === p.id ? { ...i, liked: !i.liked, likes: i.likes + (i.liked ? -1 : 1) } : i)));      // optimistic
    try { const r = await api.toggleLike(p.id); setItems((x) => x.map((i) => (i.id === p.id ? { ...i, liked: r.liked, likes: r.likes } : i))); }
    catch { load(); }
  };
  const go = (path: string, params?: Record<string, string>) => router.push((params ? { pathname: path, params } : path) as any);
  const refresh = () => { setRefreshing(true); api.invalidateApiCache(); if (view === 'explore') loadHub(); else load(); };

  const header = (
    <View>
      {view === 'posts' ? (
        <View>
          <View style={{ flexDirection: 'row', gap: 8, paddingBottom: 10, flexWrap: 'wrap' }}>{TABS.map((t) => <Chip key={t.k} label={t.label} selected={tab === t.k} onPress={() => setTab(t.k)} />)}</View>
          {fresh > 0 ? (
            <Pressable onPress={load} accessibilityRole="button" style={{ alignSelf: 'center', backgroundColor: C.primary, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, marginBottom: 8 }}>
              <T v="label" color="#fff">{fresh} new {fresh === 1 ? 'post' : 'posts'}. Tap to show</T>
            </Pressable>
          ) : null}
          {err ? <Banner tone="danger" text={err} /> : null}
          {disclaimer ? <T v="caption" color={C.textTertiary} style={{ marginBottom: 10 }}>{disclaimer}</T> : null}
        </View>
      ) : <ExploreView hub={hub} loading={hubLoading} go={go} />}
    </View>
  );

  return (
    <Screen scroll={false}
      header={<ScreenHeader title={view === 'explore' ? 'Explore' : 'Community'}
        right={<View style={{ flexDirection: 'row', gap: 4 }}>
          <View><IconButton icon="medkit-outline" label="Care team" onPress={() => router.push('/(patient)/messages' as any)} />{unreadCount ? <View style={{ position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: C.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3 }}><T v="caption" color="#fff" style={{ fontSize: 10, lineHeight: 13 }}>{unreadCount > 9 ? '9+' : unreadCount}</T></View> : null}</View>
          <IconButton icon={view === 'explore' ? 'chatbubbles-outline' : 'compass-outline'} label={view === 'explore' ? 'Show posts' : 'Back to explore'} onPress={() => setView(view === 'explore' ? 'posts' : 'explore')} />
          <IconButton icon="add-circle-outline" label="New post" onPress={() => router.push('/(patient)/community/new' as any)} />
        </View>} />}>
      <FlatList data={view === 'posts' && !loading ? items : []} keyExtractor={(p) => String(p.id)} contentContainerStyle={{ paddingBottom: view === 'posts' ? 130 : 0 }} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.primary} onRefresh={refresh} />}
        onEndReached={view === 'posts' ? loadMore : undefined} onEndReachedThreshold={0.4}
        ListHeaderComponent={header}
        ListEmptyComponent={view === 'posts' ? (loading ? <ActivityIndicator color={C.primary} style={{ marginTop: 40 }} />
          : <EmptyState icon="chatbubbles-outline" title="Nothing here yet" text="Start a conversation, share a tip, or list a health or fitness item." action="Write a post" onAction={() => router.push('/(patient)/community/new' as any)} />) : undefined}
        ListFooterComponent={more ? <ActivityIndicator color={C.primary} style={{ margin: 16 }} /> : undefined}
        renderItem={({ item }) => <PostCard p={item} onLike={() => like(item)} onOpen={() => router.push({ pathname: '/(patient)/community/post' as any, params: { id: String(item.id) } })} />} />
    </Screen>
  );
}
