import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { GOLD, RatingSummary, ReviewCard } from '../../../components/explore/parts';
import { Banner, Button, Card, EmptyState, Screen, ScreenHeader, Skeleton, T, TextField } from '../../../components/ui';
import { theme } from '../../../constants/theme';
import api, { CommunityMe, ReviewsResult } from '../../../services/api';
import { Ionicons, Pressable, RefreshControl, View } from '../../../components/themed';

const C = theme.COLORS;
const WORDS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent'];

export default function Reviews() {
  const router = useRouter();
  const [data, setData] = useState<ReviewsResult | null>(null);
  const [me, setMe] = useState<CommunityMe | null>(null);
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [r, m] = await Promise.all([api.getCommunityReviews(50), api.getCommunityMe()]);
      setData(r); setMe(m); setErr(null);
    } catch (e: any) { setErr(e.message || 'Could not load reviews.'); }
    setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const startEdit = () => { if (data?.mine) { setRating(data.mine.rating); setTitle(data.mine.title); setBody(data.mine.body); } setEditing(true); };
  const submit = async () => {
    setErr(null);
    if (!rating) { setErr('Choose a star rating.'); return; }
    if (title.trim().length < 2) { setErr('Add a short title.'); return; }
    if (body.trim().length < 10) { setErr('Write at least 10 characters about your experience.'); return; }
    setBusy(true);
    try {
      await api.createCommunityReview({ title: title.trim(), body: body.trim(), rating });
      api.invalidateApiCache(); setEditing(false); await load();
    } catch (e: any) {
      let msg = e.message || 'Could not save your review.';
      try { const j = JSON.parse(msg); if (typeof j.detail === 'string') msg = j.detail; } catch { /* plain message */ }
      setErr(msg);
    } finally { setBusy(false); }
  };
  const remove = () => Alert.alert('Delete your review?', 'It will be removed for everyone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { try { await api.deleteMyReview(); api.invalidateApiCache(); setEditing(false); setRating(0); setTitle(''); setBody(''); await load(); } catch (e: any) { setErr(e.message); } } },
  ]);

  const composer = (
    <Card>
      <T v="heading">{data?.mine ? 'Edit your review' : 'Write a review'}</T>
      <T v="caption" color={C.textSecondary} style={{ marginTop: 2 }}>Tell others what has helped and what could be better. One review per person, shown with your community name.</T>
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 14, alignItems: 'center' }} accessibilityRole="radiogroup">
        {[1, 2, 3, 4, 5].map((i) => (
          <Pressable key={i} onPress={() => setRating(i)} hitSlop={6} accessibilityRole="radio" accessibilityState={{ selected: rating === i }} accessibilityLabel={`${i} ${i === 1 ? 'star' : 'stars'}`}>
            <Ionicons name={rating >= i ? 'star' : 'star-outline'} size={34} color={GOLD} />
          </Pressable>
        ))}
        {rating ? <T v="label" color={C.textSecondary} style={{ marginLeft: 8 }}>{WORDS[rating]}</T> : null}
      </View>
      <View style={{ marginTop: 12 }}><TextField label="Title" value={title} onChangeText={setTitle} maxLength={80} placeholder="Sum it up" /></View>
      <View style={{ marginTop: 4 }}><TextField label="Your review" value={body} onChangeText={setBody} maxLength={800} multiline placeholder="What do you use it for, and how has it helped?" style={{ minHeight: 100, textAlignVertical: 'top' }} /></View>
      <T v="caption" color={C.textTertiary} style={{ marginTop: 6 }}>No links, please. Reviews are public to other members.</T>
      <View style={{ marginTop: 14, gap: 10 }}>
        <Button title={data?.mine ? 'Save changes' : 'Post review'} onPress={submit} loading={busy} />
        {editing ? <Button title="Cancel" variant="secondary" onPress={() => setEditing(false)} /> : null}
      </View>
    </Card>
  );

  return (
    <ProtectedRoute>
      <Screen header={<ScreenHeader title="Reviews" subtitle="What members say about HEWAL3" onBack={() => router.back()} />}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.primary} onRefresh={() => { setRefreshing(true); api.invalidateApiCache(); load(); }} />}>
        {err ? <Banner tone="danger" text={err} /> : null}
        {!data ? <Skeleton height={140} /> : (
          <View style={{ gap: 14 }}>
            {data.count ? <RatingSummary data={data} /> : null}
            {me && !me.joined ? (
              <Banner tone="info" title="Join the community to review" text="Reviews use your community name, never your email." action="Join" onAction={() => router.push('/(patient)/community/new' as any)} />
            ) : editing || !data.mine ? composer : (
              <View style={{ gap: 10 }}>
                <T v="label" color={C.textSecondary}>Your review</T>
                <ReviewCard r={data.mine} />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}><Button title="Edit" variant="secondary" icon="create-outline" onPress={startEdit} /></View>
                  <View style={{ flex: 1 }}><Button title="Delete" variant="secondary" icon="trash-outline" onPress={remove} /></View>
                </View>
              </View>
            )}
            {data.items.filter((r) => !r.mine).length ? <T v="label" color={C.textSecondary} style={{ marginTop: 6 }}>All reviews</T> : null}
            {data.items.filter((r) => !r.mine).map((r) => <ReviewCard key={r.id} r={r} />)}
            {!data.count && !(me && me.joined) ? <EmptyState icon="star-outline" title="No reviews yet" text="Be the first to share what HEWAL3 has done for you." /> : null}
          </View>
        )}
        <View style={{ height: 40 }} />
      </Screen>
    </ProtectedRoute>
  );
}
