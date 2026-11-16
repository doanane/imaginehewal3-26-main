import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import ProgressTab from '../../components/behavior/ProgressTab';
import SupportTab from '../../components/behavior/SupportTab';
import TodayTab from '../../components/behavior/TodayTab';
import YouTab from '../../components/behavior/YouTab';
import { usePull, useRealtimeReload } from '../../components/CareParts';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Banner, Chip, Screen, ScreenHeader, Skeleton } from '../../components/ui';
import { theme } from '../../constants/theme';
import { useT } from '../../i18n';
import api from '../../services/api';
import { RefreshControl, View } from '../../components/themed';

const C = theme.COLORS;
type Tab = 'today' | 'progress' | 'support' | 'you';
const TABS: Tab[] = ['today', 'progress', 'support', 'you'];

/** My habits: the adaptive loop. One small step a day that fits the person's life, learns from their own history, welcomes them back after
 *  a gap, and shows every reason, limit and control. The daily step comes from the server in the person's language. */
export default function Habits() {
  const router = useRouter();
  const { t } = useT();
  const [tab, setTab] = useState<Tab>('today');
  const [today, setToday] = useState<any>(null);
  const [outcomes, setOutcomes] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [approaches, setApproaches] = useState<any>(null);
  const [recs, setRecs] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [td, o, s, a, r] = await Promise.all([api.getBehaviorToday(), api.getBehaviorOutcomes(), api.getBehaviorSettings(), api.getBehaviorApproaches(), api.getBehaviorRecommendations().catch(() => ({ recommendations: [] }))]);
      setToday(td); setOutcomes(o); setSettings(s); setApproaches(a); setRecs(r.recommendations); setError(null);
    } catch (e: any) { setError(e?.message || 'Could not load your habits.'); setToday((x: any) => x ?? { items: [] }); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useRealtimeReload(load, ['notification.new']);                       // a supporter's kind word, or a message after a gap, shows up at once
  const onRefresh = usePull(load, setRefreshing);

  return (
    <ProtectedRoute>
      <Screen header={<ScreenHeader title={t('habits.title')} subtitle={t('habits.subtitle')} onBack={() => (router.canGoBack() ? router.back() : router.replace('/(patient)/(tabs)/today' as any))} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />} contentStyle={{ paddingBottom: 60 }} keyboard>
        {error ? <View style={{ marginBottom: 12 }}><Banner tone="warning" text={error} action="Try again" onAction={load} /></View> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {TABS.map((k) => <Chip key={k} label={t(`habits.tab.${k}`)} selected={tab === k} onPress={() => setTab(k)} />)}
        </View>
        {!today ? <><Skeleton height={140} /><View style={{ height: 12 }} /><Skeleton height={140} /></> : (
          <>
            {tab === 'today' ? <TodayTab today={today} recommendations={recs} approaches={approaches} settings={settings} onChange={load} t={t} /> : null}
            {tab === 'progress' ? <ProgressTab outcomes={outcomes} onChange={load} t={t} /> : null}
            {tab === 'support' ? <SupportTab plans={outcomes} t={t} /> : null}
            {tab === 'you' ? <YouTab settings={settings} approaches={approaches} onChange={load} t={t} /> : null}
          </>
        )}
      </Screen>
    </ProtectedRoute>
  );
}
