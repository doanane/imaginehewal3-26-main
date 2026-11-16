import React, { useMemo, useState } from 'react';
import { LayoutChangeEvent } from 'react-native';
import Svg from 'react-native-svg';
import { theme } from '../constants/theme';
import { T } from './ui';
import { Circle, Line, Rect, View } from './themed';

const C = theme.COLORS;

const mix = (a: string, b: string, t: number) => {
  const p = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  const ch = (i: number) => Math.round(p(a, i) + (p(b, i) - p(a, i)) * t).toString(16).padStart(2, '0');
  return `#${ch(0)}${ch(1)}${ch(2)}`;
};

/**
 * Draws a route from GPS points [lat, lng, seconds], north up, fitted to the box. No map tiles are needed, so it works
 * offline. The line goes from green (your fastest stretches) to orange (your slowest). The start is green, the end is red.
 */
export default function RouteMap({ route, height = 220, placeholder = 'Waiting for GPS...' }: { route: number[][] | null; height?: number; placeholder?: string }) {
  const [w, setW] = useState(0);
  const geo = useMemo(() => {
    if (!route || route.length < 2 || w <= 0) return null;
    const lat0 = route.reduce((a, p) => a + p[0], 0) / route.length, lng0 = route.reduce((a, p) => a + p[1], 0) / route.length;
    const kx = Math.cos((lat0 * Math.PI) / 180) * 111320, ky = 110540;
    const xy = route.map((p) => ({ x: (p[1] - lng0) * kx, y: -(p[0] - lat0) * ky, t: p[2] }));
    const xs = xy.map((p) => p.x), ys = xy.map((p) => p.y);
    const spanX = Math.max(60, Math.max(...xs) - Math.min(...xs)), spanY = Math.max(60, Math.max(...ys) - Math.min(...ys));
    const pad = 22, s = Math.min((w - pad * 2) / spanX, (height - pad * 2) / spanY);
    const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
    const pts = xy.map((p) => ({ x: w / 2 + (p.x - cx) * s, y: height / 2 + (p.y - cy) * s, t: p.t, mx: p.x, my: p.y }));
    const stride = Math.max(1, Math.floor(pts.length / 220));
    const segs: { a: typeof pts[0]; b: typeof pts[0]; v: number }[] = [];
    for (let i = stride; i < pts.length; i += stride) {
      const a = pts[i - stride], b = pts[i], dt = Math.max(0.5, b.t - a.t);
      segs.push({ a, b, v: Math.hypot(b.mx - a.mx, b.my - a.my) / dt });
    }
    const vs = segs.map((x) => x.v), lo = Math.min(...vs), hi = Math.max(...vs, lo + 0.1);
    return { pts, segs, lo, hi };
  }, [route, w, height]);

  return (
    <View onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)} style={{ height, borderRadius: 16, overflow: 'hidden', backgroundColor: '#EEF4F4' }}
      accessibilityRole="image" accessibilityLabel="Map of your route">
      {geo ? (
        <Svg width={w} height={height}>
          <Rect x={0} y={0} width={w} height={height} fill="#EEF4F4" />
          {[0.25, 0.5, 0.75].map((f) => <Line key={`h${f}`} x1={0} x2={w} y1={height * f} y2={height * f} stroke="#DCE7E7" strokeWidth={1} />)}
          {[0.25, 0.5, 0.75].map((f) => <Line key={`v${f}`} y1={0} y2={height} x1={w * f} x2={w * f} stroke="#DCE7E7" strokeWidth={1} />)}
          {geo.segs.map((sg, i) => (
            <Line key={i} x1={sg.a.x} y1={sg.a.y} x2={sg.b.x} y2={sg.b.y} strokeWidth={6} strokeLinecap="round"
              stroke={mix('#D9701A', '#17724A', (sg.v - geo.lo) / (geo.hi - geo.lo))} />
          ))}
          <Circle cx={geo.pts[0].x} cy={geo.pts[0].y} r={7} fill="#17724A" stroke="#fff" strokeWidth={3} />
          <Circle cx={geo.pts[geo.pts.length - 1].x} cy={geo.pts[geo.pts.length - 1].y} r={8} fill={C.danger} stroke="#fff" strokeWidth={3} />
        </Svg>
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><T v="caption" color={C.textSecondary}>{placeholder}</T></View>
      )}
    </View>
  );
}
