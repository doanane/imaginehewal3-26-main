import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Photo } from '../../components/explore/cards';
import { Badge, Banner, Button, Card, IconButton, Screen, ScreenHeader, Skeleton, T } from '../../components/ui';
import { Reveal } from '../../components/ui/motion';
import { theme } from '../../constants/theme';
import api, { Article } from '../../services/api';
import { Ionicons, View } from '../../components/themed';

const C = theme.COLORS;

export default function ArticleScreen() {
  const router = useRouter();
  const { key } = useLocalSearchParams<{ key: string }>();
  const [a, setA] = useState<Article | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api.getArticle(String(key)).then((r) => { if (live) setA(r); }).catch((e) => live && setErr(e.message || 'Could not open this article.'));
    return () => { live = false; };
  }, [key]);

  const done = async () => {
    if (!a) return;
    try { await api.markArticleRead(a.key); api.invalidateApiCache(); setA({ ...a, read: true }); } catch (e: any) { setErr(e.message); }
  };
  const save = async () => {
    if (!a) return;
    try { const r = await api.toggleArticleSave(a.key); api.invalidateApiCache(); setA({ ...a, saved: r.saved }); } catch (e: any) { setErr(e.message); }
  };

  return (
    <ProtectedRoute>
      <Screen header={<ScreenHeader title="Article" onBack={() => router.back()} right={a ? <IconButton icon={a.saved ? 'bookmark' : 'bookmark-outline'} label={a.saved ? 'Remove from saved' : 'Save article'} onPress={save} /> : undefined} />}>
        {err ? <Banner tone="danger" text={err} /> : null}
        {!a ? <Skeleton height={200} /> : (
          <Reveal>
            <Photo uri={a.image} icon="book-outline" height={190} radius={16} />
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 14 }}>
              <Badge label={a.category_label} tone="info" />
              <T v="caption" color={C.textTertiary}>{a.minutes} min read</T>
            </View>
            <T v="title" style={{ marginTop: 10, fontSize: 26, lineHeight: 32 }}>{a.title}</T>
            <T v="body" color={C.textSecondary} style={{ marginTop: 6 }}>{a.summary}</T>
            <View style={{ marginTop: 16, gap: 14 }}>
              {a.body?.map((p, i) => <T key={i} v="body" style={{ lineHeight: 26 }}>{p}</T>)}
            </View>
            <Card tone="soft" style={{ marginTop: 22 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Ionicons name="information-circle-outline" size={20} color={C.primary} />
                <T v="caption" color={C.textSecondary} style={{ flex: 1 }}>{a.notice}</T>
              </View>
            </Card>
            <View style={{ marginTop: 18 }}>
              {a.read ? <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="checkmark-circle" size={20} color={C.success} /><T v="bodyStrong" color={C.success}>Marked as read</T></View>
                : <Button title="Mark as read" icon="checkmark" onPress={done} />}
            </View>
          </Reveal>
        )}
        <View style={{ height: 40 }} />
      </Screen>
    </ProtectedRoute>
  );
}
