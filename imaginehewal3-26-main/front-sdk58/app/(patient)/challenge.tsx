import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ProtectedRoute from '../../components/ProtectedRoute';
import { DailyBars, Photo, Tabs } from '../../components/explore/cards';
import { Avatar, Banner, Button, Card, EmptyState, Screen, Skeleton, T } from '../../components/ui';
import { ProgressRing, Reveal } from '../../components/ui/motion';
import { theme } from '../../constants/theme';
import api, { ChallengeBoard, ChallengeCard } from '../../services/api';
import { Ionicons, LinearGradient, Pressable, RefreshControl, View } from '../../components/themed';

const C = theme.COLORS;
type Tab = 'about' | 'progress' | 'board';
const TABS: { k: Tab; label: string }[] = [{ k: 'about', label: 'About' }, { k: 'progress', label: 'Progress' }, { k: 'board', label: 'Leaderboard' }];
const range = (iso?: string) => {
  if (!iso) return '';
  const a = new Date(`${iso}T12:00:00`), b = new Date(a.getTime() + 6 * 86400000);
  const f = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  return `${f(a)} to ${f(b)}`;
};

export default function Challenge() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { key } = useLocalSearchParams<{ key: string }>();
  const [c, setC] = useState<ChallengeCard | null>(null);
  const [board, setBoard] = useState<ChallengeBoard | null>(null);
  const [tab, setTab] = useState<Tab>('about');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try { const r = await api.getChallenge(String(key)); setC(r.challenge); setBoard(r.board); setErr(null); } catch (e: any) { setErr(e.message || 'Could not load this challenge.'); }
    setRefreshing(false);
  }, [key]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async () => {
    if (!c) return;
    setBusy(true);
    try { if (c.joined) await api.leaveChallenge(c.key); else await api.joinChallenge(c.key); api.invalidateApiCache(); await load(); if (!c.joined) setTab('progress'); }
    catch (e: any) { setErr(e.message || 'Could not update.'); }
    setBusy(false);
  };

  const todayIdx = (new Date().getDay() + 6) % 7;
  const pct = c?.percent ?? 0;
  const col = c?.done ? C.success : C.primary;
  const fmt = (v: number) => (Math.round(v * 10) / 10).toLocaleString();
  const today = c?.daily ? c.daily[todayIdx] : null;

  return (
    <ProtectedRoute>
      <Screen contentStyle={{ padding: 0, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.primary} progressViewOffset={insets.top} onRefresh={() => { setRefreshing(true); api.invalidateApiCache(); load(); }} />}>
        <View>
          <Photo uri={c?.image} icon={c?.icon} height={230 + insets.top * 0.4} radius={0}>
            <LinearGradient colors={['rgba(0,0,0,0.45)', 'rgba(0,0,0,0)']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 110 }} />
          </Photo>
          <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" hitSlop={10}
            style={{ position: 'absolute', left: 14, top: insets.top + 8, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="chevron-back" size={24} color="#fff" />
          </Pressable>
        </View>

        <View style={{ padding: 16 }}>
          {err ? <Banner tone="danger" text={err} /> : null}
          {!c ? <Skeleton height={160} /> : (
            <View>
              <T v="title" style={{ fontSize: 26, lineHeight: 32 }}>{c.title}</T>
              <T v="caption" color={C.textSecondary} style={{ marginTop: 4 }}>{range(c.week_start)}  |  {c.days_left} {c.days_left === 1 ? 'day' : 'days'} left</T>
              <T v="body" style={{ marginTop: 10 }}>{c.tagline}.</T>

              <View style={{ marginTop: 16 }}><Tabs tabs={TABS} value={tab} onChange={setTab} /></View>

              {tab === 'about' ? (
                <Reveal>
                  <T v="body" style={{ marginTop: 16, lineHeight: 26 }}>{c.about}</T>
                  <T v="caption" color={C.textSecondary} style={{ marginTop: 12 }}>A new week starts every Monday and you can join again then. Challenges are for motivation, not medical targets, so go at a pace that is right for your health.</T>
                  <View style={{ marginTop: 18 }}><Button title={c.joined ? 'Leave challenge' : 'Join challenge'} variant={c.joined ? 'secondary' : 'primary'} onPress={toggle} loading={busy} /></View>
                </Reveal>
              ) : null}

              {tab === 'progress' ? (
                <Reveal>
                  {!c.joined ? (
                    <View style={{ marginTop: 16 }}>
                      <EmptyState icon="flag-outline" title="Join to start counting" text="Your progress is worked out from your own Apple Health, workouts, meals and logs from the day you join this week." action="Join challenge" onAction={toggle} />
                    </View>
                  ) : (
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 18 }}>
                        <ProgressRing value={pct} size={112} stroke={11} color={col} track={`${col}26`}>
                          <T v="title" style={{ fontSize: 24, lineHeight: 28 }}>{pct}%</T>
                        </ProgressRing>
                        <View style={{ flex: 1 }}>
                          {today != null ? <><T v="label" color={C.textSecondary}>Today</T><T v="title" style={{ fontSize: 24 }}>{fmt(today)} <T v="caption" color={C.textSecondary}>{c.unit}</T></T></> : null}
                          <T v="label" color={C.textSecondary} style={{ marginTop: today != null ? 8 : 0 }}>This week</T>
                          <T v="bodyStrong">{fmt(c.value ?? 0)} of {c.target.toLocaleString()} {c.unit}</T>
                          {c.done ? <T v="caption" color={C.success} style={{ fontWeight: '700', marginTop: 2 }}>Challenge complete</T> : null}
                        </View>
                      </View>
                      {c.daily ? (
                        <View style={{ marginTop: 24 }}>
                          <T v="heading">Daily progress</T>
                          <T v="caption" color={C.textSecondary} style={{ marginBottom: 6 }}>{range(c.week_start)}</T>
                          <DailyBars values={c.daily} unit={c.unit} color={col} today={todayIdx} />
                        </View>
                      ) : null}
                      <T v="caption" color={C.textTertiary} style={{ marginTop: 16 }}>Worked out from your own data. It updates when the app syncs.</T>
                    </View>
                  )}
                </Reveal>
              ) : null}

              {tab === 'board' ? (
                <Reveal>
                  <T v="caption" color={C.textSecondary} style={{ marginTop: 14, marginBottom: 10 }}>
                    Only people who chose to appear on leaderboards are listed, under their community name. {board?.members ?? 0} joined this challenge.
                  </T>
                  {board && board.rows.length ? board.rows.map((r) => (
                    <Card key={`${r.rank}-${r.name}`} style={{ marginBottom: 8, paddingVertical: 12, borderColor: r.is_me ? C.primary : C.borderLight }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <T v="heading" style={{ width: 28 }} color={r.rank <= 3 ? '#E0A62B' : C.textSecondary}>{r.rank}</T>
                        <Avatar name={r.name} size={36} />
                        <T v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{r.is_me ? `${r.name} (you)` : r.name}</T>
                        <T v="label" color={C.textSecondary}>{r.value.toLocaleString()} {board.unit}</T>
                      </View>
                    </Card>
                  )) : <EmptyState icon="podium-outline" title="Nobody on the board yet" text="Choose to appear on leaderboards to compete with others in this challenge." />}
                  {board && !board.me_opted_in ? <View style={{ marginTop: 10 }}><Button title="Choose to appear on leaderboards" variant="secondary" onPress={() => router.push('/(patient)/leaderboard' as any)} /></View> : null}
                </Reveal>
              ) : null}
            </View>
          )}
        </View>
      </Screen>
    </ProtectedRoute>
  );
}
