import React, { useEffect, useMemo, useRef, useState } from 'react';
import { LayoutChangeEvent } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient } from 'react-native-svg';
import { theme } from '../../constants/theme';
import { T } from '../ui';
import { Circle, Line, Path, Rect, Stop, View } from '../themed';

const C = theme.COLORS;
export type Point = { t: number; v: number };

/** Monotone cubic curve: smooth, and never overshoots the data the way a plain spline can. */
function smoothPath(p: { x: number; y: number }[]): string {
  const n = p.length;
  if (n < 2) return '';
  const dx: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1].x - p[i].x || 1e-6; m[i] = (p[i + 1].y - p[i].y) / dx[i]; }
  const t: number[] = new Array(n);
  t[0] = m[0]; t[n - 1] = m[n - 2];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
    if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
  }
  let d = `M ${p[0].x} ${p[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C ${p[i].x + h} ${p[i].y + t[i] * h}, ${p[i + 1].x - h} ${p[i + 1].y - t[i + 1] * h}, ${p[i + 1].x} ${p[i + 1].y}`;
  }
  return d;
}

function downsample(data: Point[], max = 90): Point[] {
  if (data.length <= max) return data;
  const size = data.length / max, out: Point[] = [];
  for (let i = 0; i < max; i++) {
    const chunk = data.slice(Math.floor(i * size), Math.floor((i + 1) * size) || undefined);
    if (chunk.length) out.push({ t: chunk[Math.floor(chunk.length / 2)].t, v: chunk.reduce((a, b) => a + b.v, 0) / chunk.length });
  }
  return out;
}

/** Smooth area chart that draws itself in, with an optional shaded "normal" band. Touch and drag to read any point. */
export default function LineChart({ data, height = 160, color = C.danger, unit = '', band, formatTime, replayKey }: {
  data: Point[]; height?: number; color?: string; unit?: string; band?: [number, number]; formatTime: (t: number) => string; replayKey?: string;
}) {
  const [w, setW] = useState(0);
  const [idx, setIdx] = useState<number | null>(null);
  const clear = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reveal = useSharedValue(0);
  const pts = useMemo(() => downsample(data), [data]);

  useEffect(() => {
    reveal.value = 0;
    reveal.value = withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) });
  }, [replayKey, pts.length > 1, w > 0]);
  const clip = useAnimatedStyle(() => ({ width: w * reveal.value, overflow: 'hidden' }));

  const geo = useMemo(() => {
    if (w <= 0 || pts.length < 2) return null;
    const vals = pts.map((p) => p.v), lo0 = Math.min(...vals, band ? band[0] : Infinity), hi0 = Math.max(...vals, band ? band[1] : -Infinity);
    const padV = Math.max(4, (hi0 - lo0) * 0.12), lo = lo0 - padV, hi = hi0 + padV;
    const t0 = pts[0].t, t1 = pts[pts.length - 1].t, span = Math.max(1, t1 - t0);
    const top = 14, bottom = height - 8;
    const X = (t: number) => ((t - t0) / span) * (w - 16) + 8;
    const Y = (v: number) => bottom - ((v - lo) / (hi - lo)) * (bottom - top);
    const xy = pts.map((p) => ({ x: X(p.t), y: Y(p.v) }));
    const line = smoothPath(xy);
    return { xy, line, area: `${line} L ${xy[xy.length - 1].x} ${height} L ${xy[0].x} ${height} Z`, Y, lo: Math.round(lo0), hi: Math.round(hi0) };
  }, [pts, w, height, band]);

  const touch = (x: number) => {
    if (!geo) return;
    let best = 0, bd = Infinity;
    geo.xy.forEach((p, i) => { const d = Math.abs(p.x - x); if (d < bd) { bd = d; best = i; } });
    setIdx(best);
    if (clear.current) clearTimeout(clear.current);
  };
  const release = () => { if (clear.current) clearTimeout(clear.current); clear.current = setTimeout(() => setIdx(null), 2200); };
  const onLayout = (e: LayoutChangeEvent) => setW(Math.round(e.nativeEvent.layout.width));

  if (pts.length < 2) {
    return <View style={{ height, alignItems: 'center', justifyContent: 'center' }}><T v="caption" color={C.textSecondary}>Not enough readings yet to draw a chart.</T></View>;
  }
  const active = idx != null && geo ? { p: pts[idx], xy: geo.xy[idx] } : null;
  const gid = `g${color.replace('#', '')}`;

  return (
    <View onLayout={onLayout} style={{ height: height + 22 }} accessibilityRole="image" accessibilityLabel={`Line chart, ${pts.length} readings, from ${geo?.lo} to ${geo?.hi} ${unit}`}>
      {geo && w > 0 ? (
        <>
          <Animated.View style={[{ height }, clip]}>
            <Svg width={w} height={height}>
              <Defs>
                <LinearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={color} stopOpacity="0.32" />
                  <Stop offset="1" stopColor={color} stopOpacity="0" />
                </LinearGradient>
              </Defs>
              {band ? <Rect x={0} y={geo.Y(band[1])} width={w} height={Math.max(0, geo.Y(band[0]) - geo.Y(band[1]))} fill={C.success} opacity={0.09} /> : null}
              <Path d={geo.area} fill={`url(#${gid})`} />
              <Path d={geo.line} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
              <Circle cx={geo.xy[geo.xy.length - 1].x} cy={geo.xy[geo.xy.length - 1].y} r={5} fill={color} stroke="#fff" strokeWidth={2} />
              {active ? <Line x1={active.xy.x} x2={active.xy.x} y1={0} y2={height} stroke={C.textSecondary} strokeWidth={1} strokeDasharray="4 4" /> : null}
              {active ? <Circle cx={active.xy.x} cy={active.xy.y} r={6} fill="#fff" stroke={color} strokeWidth={3} /> : null}
            </Svg>
          </Animated.View>
          {active ? (
            <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: Math.min(Math.max(active.xy.x - 52, 0), w - 104), width: 104, backgroundColor: C.textPrimary, borderRadius: 10, paddingVertical: 6, alignItems: 'center' }}>
              <T v="bodyStrong" color="#fff">{Math.round(active.p.v)} {unit}</T>
              <T v="caption" color="rgba(255,255,255,0.8)" style={{ fontSize: 12, lineHeight: 16 }}>{formatTime(active.p.t)}</T>
            </View>
          ) : null}
          <View onTouchStart={(e) => touch(e.nativeEvent.locationX)} onTouchMove={(e) => touch(e.nativeEvent.locationX)} onTouchEnd={release} onTouchCancel={release}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, height }} />
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
            <T v="caption" color={C.textTertiary} style={{ fontSize: 12 }}>{formatTime(pts[0].t)}</T>
            <T v="caption" color={C.textTertiary} style={{ fontSize: 12 }}>{formatTime(pts[pts.length - 1].t)}</T>
          </View>
        </>
      ) : null}
    </View>
  );
}
