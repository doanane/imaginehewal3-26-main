import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { HeartHandshake, Lock } from 'lucide-react';
import { getPatientBehavior } from './api';
import { Empty, Skeleton } from './ui';

interface Outcomes { weekly_adherence: { week_ending: string; adherence: number }[]; weeks_tracked: number; weeks_persisted: number; lapses: number; recovered_lapses: number;
  avg_days_to_recover: number | null; behaviour_change_pct_vs_baseline: number | null; sustained: boolean | null; recovery_rate: number | null; streak: { current: number; best: number; total_active_days: number } }
interface PlanRow { behavior: string; unit: string; started: string; baseline: number; goal: number; level: number; state: 'ok' | 'declining' | 'lapse'; outcomes: Outcomes }
interface Result { shared: boolean; message?: string; plans?: PlanRow[]; note?: string }

const STATE = { ok: { label: 'Engaged', cls: 'good' }, declining: { label: 'Slipping', cls: 'warn' }, lapse: { label: 'Quiet for days', cls: 'bad' } } as const;

/** A patient's habit progress, only if THEY chose to share it. A gap is shown as part of change, with how long people take to return. */
export default function HabitsTab({ id }: { id: number }) {
  const [data, setData] = useState<Result | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { setData(null); getPatientBehavior(id).then(setData).catch(e => setErr((e as Error).message)); }, [id]);

  if (err) return <div className="alert-box" role="alert">{err}</div>;
  if (!data) return <div className="card"><Skeleton h={200} /></div>;
  if (!data.shared) return <section className="card"><Empty icon={<Lock size={26} />} title="Not shared with you">{data.message}</Empty></section>;
  if (!data.plans?.length) return <section className="card"><Empty icon={<HeartHandshake size={26} />} title="No habit plans yet">This patient has not started a plan.</Empty></section>;

  return (
    <div className="stack">
      {data.plans.map(p => {
        const o = p.outcomes, st = STATE[p.state];
        return (
          <section className="card habit" key={p.behavior}>
            <div className="card-head"><h2><HeartHandshake size={18} />{p.behavior}</h2><span className={`pill ${st.cls}`}>{st.label}</span></div>
            <div className="habit-bars" role="img" aria-label="Weekly adherence">
              {o.weekly_adherence.map((w, i) => (
                <div key={w.week_ending} className="hb"><motion.i initial={{ height: 0 }} animate={{ height: `${Math.max(6, w.adherence * 100)}%` }} transition={{ delay: i * 0.05, duration: 0.6 }} className={w.adherence >= 0.4 ? 'ok' : 'low'} /><small>{w.week_ending.slice(5)}</small></div>
              ))}
            </div>
            <ul className="habit-facts">
              <li><b>{o.weeks_persisted}/{o.weeks_tracked}</b><span>weeks kept up</span></li>
              <li><b>{o.sustained === null ? 'Too early' : o.sustained ? 'Yes' : 'Not yet'}</b><span>sustained over 8 weeks</span></li>
              <li><b>{o.lapses}</b><span>gaps{o.lapses ? `, ${o.recovered_lapses} returned` : ''}</span></li>
              <li><b>{o.avg_days_to_recover ?? 'n/a'}</b><span>days to return, on average</span></li>
              <li><b>{o.behaviour_change_pct_vs_baseline == null ? 'n/a' : `${o.behaviour_change_pct_vs_baseline > 0 ? '+' : ''}${o.behaviour_change_pct_vs_baseline}%`}</b><span>vs where they started</span></li>
              <li><b>{o.streak.total_active_days}</b><span>active days in total</span></li>
            </ul>
            <p className="muted small">Started {p.started}. Baseline {p.baseline} to goal {p.goal} {p.unit}, now at step level {p.level} of 5.</p>
          </section>
        );
      })}
      <p className="muted small">{data.note}</p>
    </div>
  );
}
