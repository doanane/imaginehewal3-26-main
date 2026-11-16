import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { VitalChart } from '../../../components/health/VitalChart';
import { Banner, Card, IconButton, Screen, ScreenHeader, Skeleton, T } from '../../../components/ui';
import { theme } from '../../../constants/theme';
import { Series, fetchVital } from '../../../services/vitalSeries';
import { Kind, KINDS, RANGES, Range, bucketLabel, headline, windowFor, windowLabel } from '../../../services/vitalMath';
import { Pressable, View } from '../../../components/themed';

const C = theme.COLORS;
const RANGE_NAME: Record<Range, string> = { H: 'Hour', D: 'Day', W: 'Week', M: 'Month', '6M': '6 months', Y: 'Year' };

/** One vital in detail, like Apple Health: pick Hour, Day, Week, Month, 6 months or Year, page back through time, and touch the chart to read any point. */
export default function VitalDetail() {
  const router = useRouter();
  const { k } = useLocalSearchParams<{ k: string }>();
  const kind = (k && k in KINDS ? k : 'hr') as Kind;
  const info = KINDS[kind];
  const [range, setRange] = useState<Range>(info.ranges.includes('D') ? 'D' : 'W');
  const [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [data, setData] = useState<Series | null>(null);
  const win = useMemo(() => windowFor(range, offset), [range, offset]);

  useEffect(() => {
    let live = true;
    setData(null); setSelected(null);
    fetchVital(kind, win).then((s) => { if (live) setData(s); });
    return () => { live = false; };
  }, [kind, win]);

  const buckets = data?.buckets ?? [];
  const head = headline(kind, win, buckets, selected);
  const empty = !!data && data.available && !buckets.some((b) => b.count > 0);
  const when = selected != null && buckets[selected] ? bucketLabel(win, buckets[selected]) : windowLabel(win);

  return (
    <ProtectedRoute>
      <Screen header={<ScreenHeader title={info.title} onBack={() => router.back()}
        right={info.add ? <Pressable onPress={() => router.push(info.add as any)} hitSlop={10} accessibilityRole="button" accessibilityLabel={`Add ${info.title} data`} style={{ paddingHorizontal: 8 }}><T v="bodyStrong" color={C.primary}>Add data</T></Pressable> : undefined} />}>

        <View style={{ flexDirection: 'row', backgroundColor: C.borderLight, borderRadius: 10, padding: 3 }} accessibilityRole="tablist">
          {RANGES.filter((r) => info.ranges.includes(r)).map((r) => {
            const on = r === range;
            return (
              <Pressable key={r} onPress={() => { setRange(r); setOffset(0); }} accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={RANGE_NAME[r]}
                style={{ flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 8, backgroundColor: on ? C.card : 'transparent' }}>
                <T v="label" color={on ? C.textPrimary : C.textSecondary} style={{ fontSize: 14 }}>{r}</T>
              </Pressable>
            );
          })}
        </View>

        <View style={{ marginTop: 18, flexDirection: 'row', alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <T v="overline" color={C.textSecondary}>{head.label}</T>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <T v="display" style={{ fontSize: 38, lineHeight: 46 }}>{head.value}</T>
              {head.unit ? <T v="heading" color={C.textSecondary} style={{ marginLeft: 6 }}>{head.unit}</T> : null}
            </View>
            <T v="caption" color={C.textSecondary}>{when}</T>
          </View>
          <View style={{ flexDirection: 'row', gap: 2 }}>
            <IconButton icon="chevron-back" label={`Earlier ${RANGE_NAME[range].toLowerCase()}`} onPress={() => setOffset((o) => o + 1)} />
            <View style={{ opacity: offset === 0 ? 0.3 : 1 }}><IconButton icon="chevron-forward" label={`Later ${RANGE_NAME[range].toLowerCase()}`} onPress={() => offset > 0 && setOffset((o) => o - 1)} /></View>
          </View>
        </View>

        <View style={{ marginTop: 12 }}>
          {!data ? <Skeleton height={270} /> : !data.available ? (
            <Banner tone="info" title="Apple Health is not available here" text="Detailed charts come from Apple Health on an iPhone build of HEWAL3, not in Expo Go or on the web." />
          ) : (
            <View>
              <VitalChart kind={kind} win={win} buckets={buckets} selected={selected} onSelect={setSelected} />
              {empty ? <T v="caption" color={C.textSecondary} style={{ marginTop: 8 }}>No {info.title.toLowerCase()} data in this period. Use the arrows to look at another one.</T> : null}
            </View>
          )}
        </View>

        {data?.latest ? (
          <Card style={{ marginTop: 16, flexDirection: 'row', alignItems: 'center' } as any}>
            <T v="body" style={{ flex: 1 }}>Latest: {new Date(data.latest.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</T>
            <T v="bodyStrong">{data.latest.text}</T>
          </Card>
        ) : null}

        <T v="title" style={{ marginTop: 26, fontSize: 22 }}>About {info.title}</T>
        <Card style={{ marginTop: 10, gap: 12 }}>
          {info.about.map((p, i) => <T key={i} v="body" style={{ lineHeight: 24 }}>{p}</T>)}
          <T v="caption" color={C.textTertiary}>General information, not medical advice. Your own readings come from Apple Health.</T>
        </Card>
        <View style={{ height: 40 }} />
      </Screen>
    </ProtectedRoute>
  );
}
