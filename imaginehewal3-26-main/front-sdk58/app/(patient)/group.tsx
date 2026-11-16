import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Photo } from '../../components/explore/cards';
import { Banner, Button, Card, EmptyState, IconButton, Screen, ScreenHeader, Skeleton, T } from '../../components/ui';
import { theme } from '../../constants/theme';
import api, { CommunityPost, InterestGroup } from '../../services/api';
import { PostCard } from './(tabs)/community';
import { FlatList, Ionicons, RefreshControl, View } from '../../components/themed';

const C = theme.COLORS;

export default function Group() {
  const router = useRouter();
  const { key } = useLocalSearchParams<{ key: string }>();
  const [g, setG] = useState<InterestGroup | null>(null);
  const [items, setItems] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [needsCommunity, setNeedsCommunity] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [gs, feed] = await Promise.all([api.getGroups(), api.getFeed(undefined, undefined, String(key))]);
      setG(gs.items.find((x) => x.key === key) ?? null); setItems(feed.items); setErr(null);
    } catch (e: any) { setErr(e.message || 'Could not load this group.'); }
    setLoading(false); setRefreshing(false);
  }, [key]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async () => {
    if (!g) return;
    setBusy(true); setErr(null); setNeedsCommunity(false);
    try { if (g.joined) await api.leaveGroup(g.key); else await api.joinGroup(g.key); api.invalidateApiCache(); await load(); }
    catch (e: any) {
      const m = String(e.message || '');
      if (/join the community/i.test(m)) setNeedsCommunity(true); else setErr(m || 'Could not update.');
    }
    setBusy(false);
  };
  const like = async (p: CommunityPost) => {
    setItems((x) => x.map((i) => (i.id === p.id ? { ...i, liked: !i.liked, likes: i.likes + (i.liked ? -1 : 1) } : i)));
    try { const r = await api.toggleLike(p.id); setItems((x) => x.map((i) => (i.id === p.id ? { ...i, liked: r.liked, likes: r.likes } : i))); } catch { load(); }
  };

  const head = (
    <View style={{ marginBottom: 12 }}>
      {g ? (
        <Card>
          <Photo uri={g.image} icon={g.icon} height={170} radius={14} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 }}>
            <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: C.primarySoft, alignItems: 'center', justifyContent: 'center' }}><Ionicons name={g.icon as any} size={24} color={C.primary} /></View>
            <View style={{ flex: 1 }}>
              <T v="heading">{g.title}</T>
              <T v="caption" color={C.textSecondary}>{g.members ? `${g.members} members` : 'New group'}</T>
            </View>
          </View>
          <T v="body" style={{ marginTop: 10 }}>{g.about}</T>
          <View style={{ marginTop: 14 }}><Button title={g.joined ? 'Leave group' : 'Join group'} variant={g.joined ? 'secondary' : 'primary'} onPress={toggle} loading={busy} /></View>
        </Card>
      ) : null}
      {needsCommunity ? <View style={{ marginTop: 10 }}><Banner tone="info" title="Join the community first" text="Pick a community name and accept the rules, then come back to join this group." action="Join" onAction={() => router.push('/(patient)/community/new' as any)} /></View> : null}
      {err ? <View style={{ marginTop: 10 }}><Banner tone="danger" text={err} /></View> : null}
      <T v="caption" color={C.textTertiary} style={{ marginTop: 10 }}>Advice here is from other members, not from clinicians. Talk to your clinician before changing treatment.</T>
    </View>
  );

  return (
    <ProtectedRoute>
      <Screen scroll={false} header={<ScreenHeader title={g?.title ?? 'Community'} onBack={() => router.back()}
        right={g?.joined ? <IconButton icon="add-circle-outline" label="New post in this group" onPress={() => router.push({ pathname: '/(patient)/community/new' as any, params: { group: g.key } })} /> : undefined} />}>
        {loading ? <Skeleton height={160} /> : (
          <FlatList data={items} keyExtractor={(p) => String(p.id)} contentContainerStyle={{ paddingBottom: 60 }} showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.primary} onRefresh={() => { setRefreshing(true); api.invalidateApiCache(); load(); }} />}
            ListHeaderComponent={head}
            ListEmptyComponent={<EmptyState icon="chatbubbles-outline" title="No posts yet" text={g?.joined ? 'Start the conversation with a tip, a question or a photo.' : 'Join the group to post and to see who is here.'}
              action={g?.joined ? 'Write a post' : undefined} onAction={() => g && router.push({ pathname: '/(patient)/community/new' as any, params: { group: g.key } })} />}
            renderItem={({ item }) => <PostCard p={item} onLike={() => like(item)} onOpen={() => router.push({ pathname: '/(patient)/community/post' as any, params: { id: String(item.id) } })} />} />
        )}
      </Screen>
    </ProtectedRoute>
  );
}
