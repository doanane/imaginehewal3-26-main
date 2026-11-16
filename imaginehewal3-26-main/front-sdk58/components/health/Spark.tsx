import React, { useMemo } from 'react';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, { Defs, LinearGradient } from 'react-native-svg';
import { theme } from '../../constants/theme';
import { Circle, Path, Stop } from '../themed';

const C = theme.COLORS;

/** A tiny trend line with a soft fill. It only shows the shape of the last days; the numbers are written next to it. */
export function Spark({ values, width = 84, height = 34, color = C.primary }: { values: number[]; width?: number; height?: number; color?: string }) {
  const geo = useMemo(() => {
    if (values.length < 2) return null;
    const min = Math.min(...values), max = Math.max(...values), span = max - min || 1, pad = 4;
    const pts = values.map((v, i) => ({ x: pad + (i / (values.length - 1)) * (width - pad * 2), y: pad + (1 - (v - min) / span) * (height - pad * 2) }));
    const line = pts.map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    return { line, area: `${line} L ${pts[pts.length - 1].x} ${height} L ${pts[0].x} ${height} Z`, last: pts[pts.length - 1] };
  }, [values, width, height]);
  if (!geo) return null;
  const id = `sp${Math.round(width)}${Math.round(height)}${color.replace('#', '')}`;
  return (
    <Animated.View entering={FadeIn.duration(600)}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity="0.28" />
            <Stop offset="1" stopColor={color} stopOpacity="0" />
          </LinearGradient>
        </Defs>
        <Path d={geo.area} fill={`url(#${id})`} />
        <Path d={geo.line} stroke={color} strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={geo.last.x} cy={geo.last.y} r={3} fill={color} />
      </Svg>
    </Animated.View>
  );
}
