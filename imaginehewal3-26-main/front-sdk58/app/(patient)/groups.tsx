import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import ProtectedRoute from '../../components/ProtectedRoute';
import { ImageCard } from '../../components/explore/cards';
import { Banner, Screen, ScreenHeader, Skeleton } from '../../components/ui';
import { Reveal } from '../../components/ui/motion';
import { theme } from '../../constants/theme';
import api, { InterestGroup } from '../../services/api';
import { RefreshControl, View } from '../../components/themed';

const C = theme.COLORS;

export default function Groups() {
  const router = useRouter();
  const [items, setItems] = useState<InterestGroup[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const load = useCallback(async () => {
    try { setItems((await api.getGroups()).items); setErr(null); } catch (e: any) { setErr(e.message || 'Could not load communities.'); }
    setRefreshing(false);
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  return (
    <ProtectedRoute>
      <Screen header={<ScreenHeader title="Communities" subtitle="Find people who care about the same things" onBack={() => router.back()} />}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.primary} onRefresh={() => { setRefreshing(true); api.invalidateApiCache(); load(); }} />}>
        {err ? <Banner tone="danger" text={err} /> : null}
        {!items ? <Skeleton height={220} /> : (
          <View style={{ gap: 22 }}>
            {items.map((g, i) => (
              <Reveal key={g.key} index={i}>
                <ImageCard uri={g.image} icon={g.icon} title={g.title} subtitle={g.joined ? 'Joined' : g.members ? `${g.members} members` : g.about}
                  label={`${g.title}. ${g.joined ? 'Joined' : 'Not joined'}`} onPress={() => router.push({ pathname: '/(patient)/group' as any, params: { key: g.key } })} />
              </Reveal>
            ))}
          </View>
        )}
        <View style={{ height: 40 }} />
      </Screen>
    </ProtectedRoute>
  );
}
