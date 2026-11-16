import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Linking } from 'react-native';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { PostImages } from '../../../components/PostImages';
import { Avatar, Badge, Banner, Button, Card, IconButton, Screen, ScreenHeader, T, TextField } from '../../../components/ui';
import { theme } from '../../../constants/theme';
import api, { CommunityPost, assetUrl } from '../../../services/api';
import { Image, Ionicons, Pressable, View } from '../../../components/themed';

const C = theme.COLORS;
const REASONS: [string, string][] = [['spam', 'Spam'], ['unsafe_advice', 'Unsafe health advice'], ['selling_medicine', 'Selling medicine or restricted items'], ['harassment', 'Harassment or abuse'], ['other', 'Something else']];
const when = (iso: string | null) => (iso ? new Date(iso.endsWith('Z') ? iso : iso + 'Z').toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

export default function PostDetail() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [p, setP] = useState<CommunityPost | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => { try { setP(await api.getPost(Number(id))); } catch (e: any) { setErr(e.message || 'This post is not available.'); } }, [id]);
  useEffect(() => { load(); }, [load]);

  const send = async () => {
    if (!text.trim()) return;
    setBusy(true); setErr(null);
    try { await api.commentOnPost(Number(id), text.trim()); setText(''); await load(); } catch (e: any) { setErr(e.message || 'Could not comment.'); } finally { setBusy(false); }
  };
  const like = async () => {
    if (!p) return;
    setP({ ...p, liked: !p.liked, likes: p.likes + (p.liked ? -1 : 1) });
    try { const r = await api.toggleLike(p.id); setP((x) => (x ? { ...x, liked: r.liked, likes: r.likes } : x)); } catch { load(); }
  };
  const del = () => Alert.alert('Delete your post?', 'Comments on it will be removed too.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { try { await api.deletePost(Number(id)); router.back(); } catch (e: any) { setErr(e.message); } } }]);
  const delComment = (cid: number) => Alert.alert('Delete comment?', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: async () => { await api.deleteComment(cid).catch(() => {}); load(); } }]);
  const report = () => Alert.alert('Report this post', 'Why are you reporting it?', [
    ...REASONS.map(([k, l]) => ({ text: l, onPress: async () => { try { const r = await api.reportPost(Number(id), k); Alert.alert('Thank you', r.hidden ? 'This post has been hidden while it is reviewed.' : 'We will review it.'); if (r.hidden) router.back(); } catch (e: any) { Alert.alert('Could not report', e.message); } } })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);

  return (
    <ProtectedRoute>
      <Screen keyboard header={<ScreenHeader title="Post" onBack={() => router.back()}
        right={p ? (p.mine ? <IconButton icon="trash-outline" label="Delete post" color={C.danger} onPress={del} /> : <IconButton icon="flag-outline" label="Report post" onPress={report} />) : undefined} />}
        contentStyle={{ paddingBottom: 60 }}>
        {err ? <Banner tone="danger" text={err} /> : null}
        {p ? (
          <>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Avatar name={p.author} size={40} />
                <View style={{ flex: 1 }}><T v="bodyStrong">{p.mine ? `${p.author} (you)` : p.author}</T><T v="caption" color={C.textSecondary}>{when(p.created_at)}</T></View>
                <Badge label={p.category === 'marketplace' ? 'For sale' : p.category === 'tip' ? 'Tip' : 'Discussion'} tone={p.category === 'marketplace' ? 'warning' : p.category === 'tip' ? 'success' : 'info'} />
              </View>
              {p.title ? <T v="heading" style={{ marginTop: 12 }}>{p.title}</T> : null}
              <T v="body" style={{ marginTop: 8 }}>{p.body}</T>
              {p.category === 'marketplace' ? (
                <View style={{ marginTop: 12 }}>
                  {p.price != null ? <T v="title" color={C.primary}>{p.currency} {p.price.toLocaleString()}</T> : null}
                  {p.product_category ? <T v="caption" color={C.textSecondary}>{p.product_category}</T> : null}
                  {p.contact_phone ? <Button title={`Call ${p.contact_phone}`} icon="call-outline" variant="secondary" style={{ marginTop: 10 }} onPress={() => Linking.openURL(`tel:${p.contact_phone}`)} /> : null}
                  <T v="caption" color={C.textTertiary} style={{ marginTop: 8 }}>Meet in a public place and check the item before you pay. HEWAL3 does not handle payments.</T>
                </View>
              ) : null}
              {p.image_urls?.length ? <PostImages urls={p.image_urls} height={260} /> : null}
              <Pressable onPress={like} accessibilityRole="button" accessibilityLabel={p.liked ? 'Unlike' : 'Like'} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14 }}>
                <Ionicons name={p.liked ? 'heart' : 'heart-outline'} size={22} color={p.liked ? C.danger : C.textSecondary} /><T v="label" color={C.textSecondary}>{p.likes} {p.likes === 1 ? 'like' : 'likes'}</T>
              </Pressable>
            </Card>
            {p.category !== 'marketplace' ? <T v="caption" color={C.textTertiary} style={{ marginTop: 10 }}>Advice here is from other members, not from clinicians. Talk to your clinician before changing treatment.</T> : null}

            <T v="heading" style={{ marginTop: 20, marginBottom: 8 }}>Comments ({p.comment_list?.length ?? 0})</T>
            {(p.comment_list ?? []).map((c) => (
              <View key={c.id} style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <Avatar name={c.author} size={32} />
                <View style={{ flex: 1, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: C.borderLight, padding: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><T v="label">{c.mine ? `${c.author} (you)` : c.author}</T><T v="caption" color={C.textTertiary}>{when(c.created_at)}</T></View>
                  <T v="body" style={{ marginTop: 2 }}>{c.body}</T>
                  {c.mine ? <T v="caption" color={C.danger} onPress={() => delComment(c.id)} accessibilityRole="button" style={{ marginTop: 6 }}>Delete</T> : null}
                </View>
              </View>
            ))}
            <TextField label="Add a comment" value={text} onChangeText={setText} multiline maxLength={600} style={{ minHeight: 70, textAlignVertical: 'top' }} />
            <Button title="Comment" icon="send" onPress={send} loading={busy} disabled={!text.trim()} style={{ marginTop: 10 }} />
          </>
        ) : !err ? <T v="body" color={C.textSecondary}>Loading...</T> : null}
      </Screen>
    </ProtectedRoute>
  );
}
