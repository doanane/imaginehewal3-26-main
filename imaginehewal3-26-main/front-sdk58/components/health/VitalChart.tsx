import React, { useMemo, useState } from 'react';
import { GestureResponderEvent } from 'react-native';
import Svg from 'react-native-svg';
import { theme } from '../../constants/theme';
import { Bucket, Kind, KINDS, Win, axisLabels, formatValue, scaleFor } from '../../services/vitalMath';
import { T } from '../ui';
import { Circle, Line, Polyline, Rect, SvgText, View } from '../themed';

const C = theme.COLORS;
const AXIS_W = 46, H = 240, TOP = 8, BOTTOM = 8;

/**
 * The chart of one vital for one period, drawn like Apple Health: grid lines with the scale on the right, readings as dots or bars, and a label row under it.
 * Touch or drag across it to read any bucket; the figure above the chart follows your finger.
 */
export function VitalChart({ kind, win, buckets, selected, onSelect }: { kind: Kind; win: Win; buckets: Bucket[]; selected: number | null; onSelect: (i: number | null) => void }) {
  const [w, setW] = useState(0);
  const info = KINDS[kind];
  const scale = useMemo(() => scaleFor(kind, buckets), [kind, buckets]);
  const labels = useMemo(() => axisLabels(win), [win]);
  const plotW = Math.max(0, w - AXIS_W);
  const plotH = H - TOP - BOTTOM;
  const n = buckets.length;
  const bw = plotW / n;
  const y = (v: number) => TOP + plotH - ((v - scale.min) / (scale.max - scale.min)) * plotH;
  const x = (i: number) => (i + 0.5) * bw;
  const barW = Math.max(4, Math.min(info.style === 'bars' ? bw * 0.62 : 10, bw * 0.7));
  const dim = (i: number) => (selected == null || selected === i ? 1 : 0.35);
  const color = info.color;

  const pick = (e: GestureResponderEvent) => {
    if (!plotW) return;
    const i = Math.floor(e.nativeEvent.locationX / bw);
    onSelect(i >= 0 && i < n && buckets[i].count > 0 ? i : null);
  };

  const line: string[] = [];
  if (info.style === 'dots') buckets.forEach((b, i) => { if (b.count && b.avg != null) line.push(`${x(i)},${y(b.avg)}`); });

  return (
    <View onLayout={(e) => setW(Math.round(e.nativeEvent.layout.width))} accessible accessibilityLabel={`${info.title} chart`}>
      <View onStartShouldSetResponder={() => true} onResponderGrant={pick} onResponderMove={pick} onResponderRelease={() => {}} style={{ height: H }}>
        <Svg width={w} height={H}>
          {scale.ticks.map((tk) => (
            <React.Fragment key={tk}>
              <Line x1={0} x2={plotW} y1={y(tk)} y2={y(tk)} stroke={C.border} strokeWidth={1} />
              <SvgText x={plotW + 8} y={y(tk) + 4} fontSize={12} fill={C.textTertiary}>{formatValue(kind, tk).replace(/ hr.*/, '')}</SvgText>
            </React.Fragment>
          ))}
          {labels.map((l) => <Line key={l.text + l.pos} x1={l.pos * plotW} x2={l.pos * plotW} y1={TOP} y2={TOP + plotH} stroke={C.borderLight} strokeWidth={1} strokeDasharray="3 4" />)}
          {info.style === 'dots' && line.length > 1 ? <Polyline points={line.join(' ')} fill="none" stroke={color} strokeWidth={2} opacity={selected == null ? 0.55 : 0.25} /> : null}
          {buckets.map((b, i) => {
            if (!b.count) return null;
            if (info.style === 'bars') {
              const v = b.avg ?? b.sum ?? 0;
              const top = y(Math.min(v, scale.max));
              return <Rect key={i} x={x(i) - barW / 2} y={top} width={barW} height={Math.max(2, TOP + plotH - top)} rx={Math.min(5, barW / 2)} fill={color} opacity={dim(i)} />;
            }
            if (info.style === 'dots' || b.min === b.max || Math.abs(y(b.min as number) - y(b.max as number)) < 7) {
              return <Circle key={i} cx={x(i)} cy={y(b.avg ?? (b.min as number))} r={4.5} fill={color} opacity={dim(i)} />;
            }
            const top = y(b.max as number), bottom = y(b.min as number);
            return <Rect key={i} x={x(i) - barW / 2} y={top} width={barW} height={Math.max(7, bottom - top)} rx={barW / 2} fill={color} opacity={dim(i)} />;
          })}
        </Svg>
      </View>
      <View style={{ height: 22, marginTop: 4 }} pointerEvents="none">
        {labels.map((l) => (
          <View key={l.text + l.pos} style={{ position: 'absolute', left: Math.max(0, Math.min(plotW - 44, l.pos * plotW - 22)), width: 44, alignItems: 'center' }}>
            <T v="caption" color={C.textTertiary} style={{ fontSize: 12 }} numberOfLines={1}>{l.text}</T>
          </View>
        ))}
      </View>
    </View>
  );
}
