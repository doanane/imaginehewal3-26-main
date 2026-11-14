import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import type { MetricBlock } from './types';
import { shortDay } from './util';

const W = 720, H = 260, L = 44, R = 14, T = 14, B = 30;

/** Daily mean line with the day's min to max band, the reference range, the fitted trend line and flagged outlier days.
 *  Hover or touch shows the exact figures for that day. Days with no readings are gaps, never filled in. */
export function TrendChart({ block, days, color = 'var(--c-brand)' }: { block: MetricBlock; days: number; color?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const geo = useMemo(() => {
    const d = block.daily;
    const t0 = new Date(`${d[0].day}T12:00:00`).getTime();
    const dayMs = 86400000;
    const span = Math.max(days - 1, Math.round((new Date(`${d[d.length - 1].day}T12:00:00`).getTime() - t0) / dayMs), 1);
    const [rl, rh] = block.reference;
    let lo = Math.min(...d.map(p => p.min)), hi = Math.max(...d.map(p => p.max));
    if (rl !== null) lo = Math.min(lo, rl); if (rh !== null) hi = Math.max(hi, rh);
    const pad = (hi - lo || 4) * 0.12; lo -= pad; hi += pad;
    const x = (i: number) => L + (i / span) * (W - L - R);
    const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
    const idx = d.map(p => Math.round((new Date(`${p.day}T12:00:00`).getTime() - t0) / dayMs));
    return { d, idx, span, lo, hi, x, y, rl, rh };
  }, [block, days]);
  const { d, idx, x, y, lo, hi, rl, rh } = geo;

  let line = '';
  d.forEach((p, i) => {
    const gap = i > 0 && idx[i] - idx[i - 1] > 1;
    line += `${i === 0 || gap ? 'M' : 'L'}${x(idx[i]).toFixed(1)} ${y(p.mean).toFixed(1)} `;
  });
  const bandTop = d.map((p, i) => `${i ? 'L' : 'M'}${x(idx[i]).toFixed(1)} ${y(p.max).toFixed(1)}`).join(' ');
  const bandBottom = [...d].reverse().map((p, i) => `L${x(idx[d.length - 1 - i]).toFixed(1)} ${y(p.min).toFixed(1)}`).join(' ');
  const trend = block.trend.line && block.trend.direction !== 'unknown' ? block.trend.line : null;
  const ticks = [0, 1, 2, 3].map(i => lo + ((hi - lo) * i) / 3);
  const outlierDays = new Set(block.outliers.map(o => o.at.slice(0, 10)));

  const move = (clientX: number) => {
    const r = ref.current!.getBoundingClientRect();
    const px = ((clientX - r.left) / r.width) * W;
    let best = 0, dist = Infinity;
    d.forEach((_, i) => { const dd = Math.abs(x(idx[i]) - px); if (dd < dist) { dist = dd; best = i; } });
    setHover(best);
  };
  const first = d[0].day, last = d[d.length - 1].day;
  const hv = hover !== null ? d[hover] : null;

  return (
    <div className="chart-box">
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} className="chart" role="img"
        aria-label={`${block.label}, daily average with range, over ${days} days. Latest ${block.latest.value} ${block.unit}.`}
        onPointerMove={e => move(e.clientX)} onPointerLeave={() => setHover(null)}>
        {rl !== null && rh !== null && <rect x={L} width={W - L - R} y={y(rh)} height={Math.max(0, y(rl) - y(rh))} className="ref-band" />}
        {ticks.map((v, i) => (
          <g key={i}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" /><text x={L - 8} y={y(v) + 4} textAnchor="end" className="axis">{Math.round(v)}</text></g>
        ))}
        <text x={L} y={H - 8} className="axis">{shortDay(first)}</text>
        <text x={W - R} y={H - 8} textAnchor="end" className="axis">{shortDay(last)}</text>
        <motion.path d={`${bandTop} ${bandBottom} Z`} className="range-area" fill={color} initial={{ opacity: 0 }} animate={{ opacity: 0.12 }} transition={{ duration: 0.8 }} />
        {trend && (
          <motion.line x1={x(0)} x2={x(geo.span)} y1={y(trend[0])} y2={y(trend[0] + trend[1] * geo.span)} className="trend-line"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, delay: 0.5 }} />
        )}
        <motion.path d={line} fill="none" stroke={color} strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.1, ease: 'easeOut' }} />
        {d.map((p, i) => (
          <motion.circle key={p.day} cx={x(idx[i])} cy={y(p.mean)} r={outlierDays.has(p.day) ? 5 : 3.2} fill={outlierDays.has(p.day) ? 'var(--c-bad)' : color}
            stroke="var(--c-card)" strokeWidth="1.5" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3 + i * 0.025, type: 'spring', stiffness: 400, damping: 20 }}
            style={{ transformOrigin: `${x(idx[i])}px ${y(p.mean)}px` }} />
        ))}
        {hv && hover !== null && (
          <g pointerEvents="none">
            <line x1={x(idx[hover])} x2={x(idx[hover])} y1={T} y2={H - B} className="cross" />
            <circle cx={x(idx[hover])} cy={y(hv.mean)} r="6" fill="none" stroke={color} strokeWidth="2" />
          </g>
        )}
      </svg>
      {hv && (
        <div className="tip" role="status" style={{ left: `${(x(idx[hover!]) / W) * 100}%` }}>
          <b>{shortDay(hv.day)}</b>
          <span>Mean {hv.mean} {block.unit}</span>
          <span>Range {hv.min} to {hv.max}</span>
          <span>{hv.n} reading{hv.n === 1 ? '' : 's'}</span>
        </div>
      )}
      <div className="legend">
        <span><i className="ln" style={{ background: color }} />Daily mean</span>
        <span><i className="area" style={{ background: color }} />Daily min to max</span>
        {trend && <span><i className="dash" />Fitted trend</span>}
        {rl !== null && <span><i className="refkey" />Reference {rl} to {rh}</span>}
        {outlierDays.size > 0 && <span><i className="dot-bad" />Unusual reading</span>}
      </div>
    </div>
  );
}

export function Gauge({ value, label, sub }: { value: number | null; label: string; sub: string }) {
  const R0 = 54, C = 2 * Math.PI * R0;
  const pct = value === null ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="gauge">
      <svg viewBox="0 0 140 140" role="img" aria-label={`${label}: ${value === null ? 'no data' : value + ' percent'}`}>
        <circle cx="70" cy="70" r={R0} className="g-track" />
        <motion.circle cx="70" cy="70" r={R0} className="g-fill" strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C * (1 - pct / 100) }}
          transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }} transform="rotate(-90 70 70)" />
        <text x="70" y="68" textAnchor="middle" className="g-num">{value === null ? 'n/a' : `${value}%`}</text>
        <text x="70" y="88" textAnchor="middle" className="g-sub">{label}</text>
      </svg>
      <p>{sub}</p>
    </div>
  );
}

export function Bars({ data, unit = '' }: { data: { label: string; value: number; tone?: string }[]; unit?: string }) {
  if (!data.length) return null;
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div className="bars" role="img" aria-label="Bar chart">
      {data.map((d, i) => (
        <div key={d.label + i} className="bar-col" title={`${d.label}: ${d.value.toLocaleString()}${unit}`}>
          <span className="bar-val">{d.value.toLocaleString()}</span>
          <motion.div className={`bar ${d.tone || ''}`} initial={{ height: 0 }} animate={{ height: `${Math.max(3, (d.value / max) * 100)}%` }} transition={{ delay: i * 0.04, duration: 0.7, ease: [0.22, 1, 0.36, 1] }} />
          <span className="bar-lab">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

/** One cell per day, colour by share of doses taken. */
export function AdherenceGrid({ days }: { days: { day: string; taken: number; expected: number }[] }) {
  return (
    <div className="agrid" role="img" aria-label="Medication taken per day">
      {days.map((d, i) => {
        const p = d.expected ? d.taken / d.expected : 0;
        const tone = p >= 1 ? 'full' : p >= 0.5 ? 'part' : p > 0 ? 'low' : 'none';
        return (
          <motion.div key={d.day} className={`acell ${tone}`} title={`${shortDay(d.day)}: ${d.taken} of ${d.expected} doses`}
            initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.015 }}>
            <span>{new Date(`${d.day}T12:00:00`).getDate()}</span>
          </motion.div>
        );
      })}
    </div>
  );
}
