import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { ImageCard } from '../../components/explore/cards';
import { Banner, Card, Screen, ScreenHeader, Skeleton, T } from '../../components/ui';
import { Reveal } from '../../components/ui/motion';
import { theme } from '../../constants/theme';
import api, { ChallengeList } from '../../services/api';
import { Ionicons, RefreshControl, View } from '../../components/themed';

const C = theme.COLORS;

export default function Challenges() {
  const router = useRouter();
  const [data, setData] = useState<ChallengeList | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try { setData(await api.getChallenges()); setErr(null); } catch (e: any) { setErr(e.message || 'Could not load challenges.'); }
    setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ProtectedRoute>
      <Screen header={<ScreenHeader title="Challenges" subtitle="Weekly, from Monday to Sunday" onBack={() => router.back()} />}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.primary} onRefresh={() => { setRefreshing(true); api.invalidateApiCache(); load(); }} />}>
        {err ? <Banner tone="danger" text={err} /> : null}
        {!data ? <Skeleton height={130} /> : (
          <View style={{ gap: 22 }}>
            <Card tone="soft">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Ionicons name="trophy-outline" size={26} color={C.primary} />
                <View style={{ flex: 1 }}>
                  <T v="bodyStrong">{data.completed} {data.completed === 1 ? 'challenge' : 'challenges'} completed this week</T>
                  <T v="caption" color={C.textSecondary}>{data.days_left} {data.days_left === 1 ? 'day' : 'days'} left. Progress is measured from your own data, so nothing can be typed in.</T>
                </View>
              </View>
            </Card>
            {data.items.map((c, i) => <Reveal key={c.key} index={i}><ImageCard uri={c.image} icon={c.icon} title={c.title} subtitle={c.tagline} badge={c.done ? 'Completed' : c.joined ? 'Joined' : undefined} label={`${c.title}. ${c.tagline}`} onPress={() => router.push({ pathname: '/(patient)/challenge' as any, params: { key: c.key } })} /></Reveal>)}
          </View>
        )}
        <View style={{ height: 40 }} />
      </Screen>
    </ProtectedRoute>
  );
}
