import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Alert } from 'react-native';
import { usePull } from '../../components/CareParts';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Avatar, Badge, Banner, Button, Card, EmptyState, Screen, ScreenHeader, Skeleton, T } from '../../components/ui';
import { Reveal } from '../../components/ui/motion';
import { theme } from '../../constants/theme';
import { useT } from '../../i18n';
import api, { HabitCheer } from '../../services/api';
import { RefreshControl, View } from '../../components/themed';

const C = theme.COLORS;
const CHEERS: HabitCheer[] = ['proud', 'keep_going', 'thinking_of_you'];

/** People who chose this caregiver to encourage them with a habit. Only what each person allowed is shown: never readings, and the only
 *  thing a supporter can send is one of three kind preset messages, once a day. */
export default function Supporting() {
  const router = useRouter();
  const { t } = useT();
  const [people, setPeople] = useState<any[] | null>(null);
  const [sent, setSent] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { setPeople((await api.getBehaviorSupporting()).people); setError(null); }
    catch (e: any) { setError(e?.message || 'Could not load.'); setPeople((p) => p ?? []); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  const onRefresh = usePull(load, setRefreshing);

  const cheer = async (id: number, kind: HabitCheer) => {
    try { await api.sendBehaviorCheer(id, kind); setSent((s) => ({ ...s, [id]: true })); }
    catch (e: any) { Alert.alert('', e?.message || ''); if (e?.status === 429) setSent((s) => ({ ...s, [id]: true })); }
  };

  return (
    <ProtectedRoute>
      <Screen header={<ScreenHeader title={t('habits.you_support')} subtitle={t('habits.supporter')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/(caregiver)/dashboard' as any))} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />} contentStyle={{ gap: 12, paddingBottom: 48 }}>
        {error ? <Banner tone="warning" text={error} action="OK" onAction={load} /> : null}
        {people === null ? <Skeleton height={120} /> : people.length === 0 ? (
          <EmptyState icon="heart-outline" title={t('habits.you_support')} text="When someone you care for chooses you as their supporter, they appear here. You will see only what they choose to share." />
        ) : people.map((p, i) => (
          <Reveal key={`${p.owner_id}-${p.behavior}`} index={i}>
            <Card>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Avatar name={p.name} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <T v="bodyStrong" numberOfLines={1}>{p.name}</T>
                  <T v="caption" color={C.textSecondary}>{p.behavior}</T>
                </View>
                {p.could_use_encouragement ? <Badge label={t('habits.could_use')} tone="warning" /> : null}
              </View>
              {p.active_days_last_7 != null ? <T v="caption" color={C.textSecondary} style={{ marginTop: 10 }}>{t('habits.days_active', { n: p.active_days_last_7 })}</T> : null}
              <View style={{ gap: 8, marginTop: 12 }}>
                {sent[p.owner_id] ? <T v="bodyStrong" color={C.success}>{t('habits.cheer_sent')}</T> : CHEERS.map((k) => (
                  <Button key={k} title={t(`habits.cheer.${k}`)} variant={k === 'proud' ? 'primary' : 'secondary'} icon="heart-outline" onPress={() => cheer(p.owner_id, k)} />
                ))}
              </View>
            </Card>
          </Reveal>
        ))}
      </Screen>
    </ProtectedRoute>
  );
}
