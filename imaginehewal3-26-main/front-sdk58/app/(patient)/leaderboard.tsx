import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withTiming } from 'react-native-reanimated';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Avatar, Badge, Banner, Button, Card, Chip, Screen, ScreenHeader, Section, T, TextField } from '../../components/ui';
import { theme } from '../../constants/theme';
import api, { Board, BoardCategory, BoardPeriod, BoardRow, CompetitionMe } from '../../services/api';
import realtime from '../../services/realtime';
import { Ionicons, Pressable, RefreshControl, View } from '../../components/themed';

const C = theme.COLORS;
const CATS: { k: BoardCategory; label: string; unit: string }[] = [
  { k: 'steps', label: 'Steps', unit: 'steps' }, { k: 'distance', label: 'Distance', unit: 'km' }, { k: 'minutes', label: 'Active minutes', unit: 'min' }, { k: 'points', label: 'Points', unit: 'pts' },
];
const PERIODS: { k: BoardPeriod; label: string }[] = [{ k: 'today', label: 'Today' }, { k: 'week', label: 'This week' }, { k: 'month', label: 'This month' }];
const MEDAL = ['#E0A62B', '#9AA7B2', '#B9773F'];
const fmt = (v: number, cat: BoardCategory) => (cat === 'distance' ? v.toFixed(1) : Math.round(v).toLocaleString());

function PodiumSlot({ row, place, cat, i }: { row?: BoardRow; place: 1 | 2 | 3; cat: BoardCategory; i: number }) {
  const h = useSharedValue(0);
  const target = place === 1 ? 96 : place === 2 ? 72 : 56;
  useEffect(() => { h.value = 0; h.value = withDelay(i * 120, withTiming(target, { duration: 700, easing: Easing.out(Easing.back(1.1)) })); }, [row?.participant_id, row?.value]);
  const st = useAnimatedStyle(() => ({ height: h.value }));
  if (!row) return <View style={{ flex: 1 }} />;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }} accessibilityLabel={`Place ${place}, ${row.name}, ${fmt(row.value, cat)}`}>
      <Ionicons name="trophy" size={place === 1 ? 26 : 20} color={MEDAL[place - 1]} />
      <Avatar name={row.name} size={place === 1 ? 56 : 46} />
      <T v="label" numberOfLines={1} style={{ marginTop: 4, maxWidth: 100 }} color={row.is_me ? C.primary : C.textPrimary}>{row.is_me ? 'You' : row.name}</T>
      <T v="caption" color={C.textSecondary}>{fmt(row.value, cat)}</T>
      <Animated.View style={[{ width: '70%', marginTop: 6, borderTopLeftRadius: 12, borderTopRightRadius: 12, backgroundColor: MEDAL[place - 1], alignItems: 'center', justifyContent: 'center' }, st]}>
        <T v="title" color="#fff">{place}</T>
      </Animated.View>
    </View>
  );
}

function Row({ r, cat, pinned }: { r: BoardRow; cat: BoardCategory; pinned?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 12, borderRadius: 14, backgroundColor: r.is_me ? C.primarySoft : 'transparent', borderWidth: r.is_me ? 1 : 0, borderColor: C.primary, marginBottom: 4 }}
      accessibilityLabel={`Rank ${r.rank}, ${r.is_me ? 'you' : r.name}, ${fmt(r.value, cat)}`}>
      <T v="bodyStrong" style={{ width: 34 }} color={r.rank <= 3 ? MEDAL[r.rank - 1] : C.textSecondary}>{r.rank}</T>
      <Avatar name={r.name} size={36} />
      <T v="body" numberOfLines={1} style={{ flex: 1, marginLeft: 10 }}>{r.is_me ? `${r.name} (you)` : r.name}</T>
      <T v="bodyStrong">{fmt(r.value, cat)}</T>
      {pinned ? null : null}
    </View>
  );
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const [cat, setCat] = useState<BoardCategory>('steps');
  const [period, setPeriod] = useState<BoardPeriod>('today');
  const [q, setQ] = useState('');
  const [board, setBoard] = useState<Board | null>(null);
  const [me, setMe] = useState<CompetitionMe | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(false);
  const [badges, setBadges] = useState<{ key: string; title: string; description: string; earned: boolean }[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const args = useRef({ cat, period, q });
  args.current = { cat, period, q };

  const load = useCallback(async () => {
    try {
      const { cat: c, period: p, q: s } = args.current;
      const [b, m] = await Promise.all([api.getBoard(c, p, s), api.getCompetitionMe()]);
      setBoard(b); setMe(m); setErr(null);
      if (!name) setName(m.suggested_name);
    } catch (e: any) { setErr(e.message || 'Could not load the leaderboard.'); }
    setRefreshing(false);
  }, [name]);

  useFocusEffect(useCallback(() => { load(); api.getAchievements().then((r) => setBadges(r.items)).catch(() => {}); }, [load]));
  useEffect(() => { load(); }, [cat, period]);                                      // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(load, 350); return () => clearTimeout(t); }, [q]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const off = realtime.on('leaderboard.update', () => {                             // debounce bursts so the screen does not flicker
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => { load(); setLive(true); setTimeout(() => setLive(false), 1500); }, 600);
    });
    const off2 = realtime.on('achievement.new', (e: any) => { Alert.alert('New badge', e.title); api.getAchievements().then((r) => setBadges(r.items)).catch(() => {}); });
    return () => { off(); off2(); if (timer.current) clearTimeout(timer.current); };
  }, [load]);

  const join = async () => {
    if (!agree) { setErr('Please accept the rules to join.'); return; }
    setBusy(true); setErr(null);
    try { setMe(await api.joinLeaderboard(name.trim() || undefined, true)); await load(); } catch (e: any) { setErr(e.message || 'Could not join.'); } finally { setBusy(false); }
  };
  const leave = () => Alert.alert('Leave the leaderboard?', 'Your name is removed from the rankings. Your health data is not deleted.', [
    { text: 'Cancel', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: async () => { try { setMe(await api.leaveLeaderboard()); await load(); } catch (e: any) { setErr(e.message); } } },
  ]);

  const unit = CATS.find((c) => c.k === cat)!.unit;
  const rows = board?.rows ?? [];
  const meInList = !!board?.me && rows.some((r) => r.is_me);
  const podium = board?.podium ?? [];
  const goalText = cat === 'steps' ? 'Most steps wins' : cat === 'distance' ? 'Furthest distance wins' : cat === 'minutes' ? 'Most active minutes wins' : 'Most points wins. Points = steps/100 + 10 per km + workout minutes.';

  return (
    <ProtectedRoute>
      <Screen header={<ScreenHeader title="Leaderboard" subtitle={live ? 'Updated just now' : 'Live rankings'} onBack={() => router.back()} />} contentStyle={{ paddingBottom: 48 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.primary} onRefresh={() => { setRefreshing(true); api.invalidateApiCache(); load(); }} />}>
        {err ? <Banner tone="danger" text={err} /> : null}

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{CATS.map((c) => <Chip key={c.k} label={c.label} selected={cat === c.k} onPress={() => setCat(c.k)} />)}</View>
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>{PERIODS.map((p) => <Chip key={p.k} label={p.label} selected={period === p.k} onPress={() => setPeriod(p.k)} />)}</View>

        <Card style={{ marginTop: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Ionicons name="flag-outline" size={18} color={C.primary} /><T v="label" style={{ flex: 1 }}>{goalText}</T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}><View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: live ? '#17724A' : C.borderLight }} /><T v="caption" color={C.textSecondary}>{board?.participants ?? 0} taking part</T></View>
          </View>
        </Card>

        {me && !me.on_leaderboard ? (
          <Section title="Join the leaderboard">
            <Card>
              <T v="body">Compete with others and earn badges. It is optional, and you can leave any time.</T>
              <T v="label" style={{ marginTop: 10 }}>Others will see</T>
              {me.visible_to_others.map((v) => <T key={v} v="caption" color={C.textSecondary}>• {v}</T>)}
              <T v="label" style={{ marginTop: 8 }}>Never shown</T>
              {me.never_visible.map((v) => <T key={v} v="caption" color={C.textSecondary}>• {v}</T>)}
              <View style={{ marginTop: 12 }}><TextField label="Display name" value={name} onChangeText={setName} autoCapitalize="none" maxLength={24} helper="Not your real name. 3 to 24 letters, numbers, _ or -." /></View>
              <T v="label" style={{ marginTop: 6 }}>Rules</T>
              {me.rules.map((r) => <T key={r} v="caption" color={C.textSecondary}>• {r}</T>)}
              <Pressable onPress={() => setAgree((a) => !a)} accessibilityRole="checkbox" accessibilityState={{ checked: agree }} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 }}>
                <Ionicons name={agree ? 'checkbox' : 'square-outline'} size={24} color={C.primary} /><T v="body" style={{ flex: 1 }}>I agree to the rules</T>
              </Pressable>
              <Button title="Join" onPress={join} loading={busy} />
            </Card>
          </Section>
        ) : null}

        <Section title={period === 'today' ? 'Top today' : period === 'week' ? 'Top this week' : 'Top this month'}>
          {podium.length ? (
            <Card style={{ paddingTop: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                <PodiumSlot row={podium[1]} place={2} cat={cat} i={1} /><PodiumSlot row={podium[0]} place={1} cat={cat} i={0} /><PodiumSlot row={podium[2]} place={3} cat={cat} i={2} />
              </View>
            </Card>
          ) : <Card><T v="caption" color={C.textSecondary}>No one has scored yet. Walk, run or ride to take the first place.</T></Card>}
        </Section>

        <View style={{ marginTop: 16 }}><TextField label="Find a participant" value={q} onChangeText={setQ} placeholder="Search by name" autoCapitalize="none" /></View>

        <Section title={`Ranking (${unit})`}>
          {rows.length ? <Card style={{ paddingVertical: 8 }}>{rows.map((r) => <Row key={r.participant_id} r={r} cat={cat} />)}</Card> : <Card><T v="caption" color={C.textSecondary}>{q ? 'No participant matches that name.' : 'Nobody is on the board yet.'}</T></Card>}
          {board?.me && !meInList ? <View style={{ marginTop: 10 }}><T v="caption" color={C.textSecondary} style={{ marginBottom: 6 }}>Your position</T><Row r={board.me} cat={cat} pinned /></View> : null}
        </Section>

        {badges.length ? (
          <Section title="Badges">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {badges.map((b) => (
                <View key={b.key} style={{ width: '47.5%', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: b.earned ? C.primary : C.borderLight, backgroundColor: b.earned ? C.primarySoft : '#fff', opacity: b.earned ? 1 : 0.7 }}>
                  <Ionicons name={b.earned ? 'ribbon' : 'ribbon-outline'} size={22} color={b.earned ? C.primary : C.textTertiary} />
                  <T v="label" style={{ marginTop: 4 }}>{b.title}</T><T v="caption" color={C.textSecondary}>{b.description}</T>
                  {b.earned ? <View style={{ marginTop: 6 }}><Badge label="Earned" tone="success" /></View> : null}
                </View>
              ))}
            </View>
          </Section>
        ) : null}

        {me?.on_leaderboard ? <Button title="Leave leaderboard" variant="secondary" onPress={leave} style={{ marginTop: 20 }} /> : null}
        <T v="caption" color={C.textTertiary} style={{ marginTop: 14 }}>Workouts that look faster than a person can move are not counted.</T>
      </Screen>
    </ProtectedRoute>
  );
}
