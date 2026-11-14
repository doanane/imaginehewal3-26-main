import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Activity, Flag, HeartPulse, Repeat, ShieldCheck, TrendingUp, Users } from 'lucide-react';
import { getPanelImpact } from './api';
import { Empty, Skeleton } from './ui';

type Cell = { n: number | string; hidden?: boolean; value?: number | null; [k: string]: unknown };
const pct = (v: unknown) => (typeof v === 'number' ? `${Math.round(v * 100)}%` : 'n/a');

function Metric({ icon, title, value, sub, i }: { icon: React.ReactNode; title: string; value: string; sub?: string; i: number }) {
  return (
    <motion.div className="kpi static" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
      <span className="kpi-ic">{icon}</span><span className="kpi-l">{title}</span><b>{value}</b>{sub && <small>{sub}</small>}
    </motion.div>
  );
}

/** Did the people on this panel who chose to share actually change, and keep it? Group figures only, hidden under five people. */
export default function ImpactPage() {
  const [d, setD] = useState<any | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { getPanelImpact().then(setD).catch(e => setErr((e as Error).message)); }, []);

  return (
    <>
      <header className="page-head"><div><h1>Impact</h1><p>Whether habits last, measured over months. Only patients who chose to share with you are included.</p></div></header>
      {err && <div className="alert-box" role="alert">{err}</div>}
      {!d ? <div className="card"><Skeleton h={200} /></div> : d.hidden ? (
        <section className="card"><Empty icon={<ShieldCheck size={28} />} title="Not enough sharing patients yet">{d.note} Patients switch this on in the app under Habits, You.</Empty></section>
      ) : (
        <>
          <div className="grid-kpi">
            <Metric i={0} icon={<Users size={20} />} title="People included" value={String(d.people)} sub={`${d.plans} plans`} />
            <Metric i={1} icon={<Repeat size={20} />} title="Still active at 30 days" value={pct((d.retention.day_30 as Cell).value)} sub={`of ${(d.retention.day_30 as Cell).n} who started`} />
            <Metric i={2} icon={<TrendingUp size={20} />} title="Kept up over 8 weeks" value={pct((d.persistence as Cell).value)} sub="persistence" />
            <Metric i={3} icon={<Activity size={20} />} title="Lapses that ended in a return" value={d.recovery.hidden ? 'Under 5' : pct(d.recovery.recovered_share)} sub={d.recovery.hidden ? 'lapses, too few to show' : d.recovery.median_days_to_return != null ? `median ${d.recovery.median_days_to_return} days` : undefined} />
          </div>

          <div className="grid-2">
            <section className="card">
              <div className="card-head"><h2><HeartPulse size={18} />Health measures</h2><small>Association, not proof</small></div>
              <table className="tbl"><tbody>
                {([['systolic_blood_pressure', 'Systolic blood pressure'], ['weight', 'Weight'], ['sleep', 'Sleep']] as const).map(([k, label]) => {
                  const m = d.biomarkers[k];
                  return <tr key={k}><td>{label}</td><td>{m.hidden ? <span className="muted">fewer than 5 people</span> : <b>{m.median_change > 0 ? '+' : ''}{m.median_change} {m.unit}</b>}</td><td className="muted">{m.hidden ? '' : `n = ${m.n}`}</td></tr>;
                })}
              </tbody></table>
              <p className="muted small">{d.biomarkers.note}</p>
            </section>
            <section className="card">
              <div className="card-head"><h2><Repeat size={18} />Outreach after a gap</h2><small>Did a message bring them back within 48 hours?</small></div>
              {Object.keys(d.outreach).length === 0 ? <p className="muted">No messages sent yet.</p> : (
                <table className="tbl"><tbody>{Object.entries(d.outreach as Record<string, any>).map(([ch, v]) => (
                  <tr key={ch}><td>{ch === 'push' ? 'Notification' : ch === 'in_app' ? 'In app' : ch}</td><td>{v.hidden ? <span className="muted">fewer than 5</span> : <b>{pct(v.followed_by_check_in)}</b>}</td><td className="muted">{v.hidden ? '' : `${v.sent} sent`}</td></tr>
                ))}</tbody></table>
              )}
            </section>
          </div>

          <section className="card">
            <div className="card-head"><h2><Flag size={18} />Equity</h2><small>{d.equity_flags.length ? `Review: ${d.equity_flags.join(', ').replace(/_/g, ' ')}` : 'No gap of 15 points or more between groups'}</small></div>
            {Object.entries(d.equity as Record<string, any>).map(([dim, v]) => (
              <div key={dim} className="eq">
                <h3>{dim.replace(/_/g, ' ')} {v.review && <span className="pill warn">gap {Math.round(v.gap * 100)} points</span>}</h3>
                <ul className="eq-row">{Object.entries(v.groups as Record<string, any>).map(([g, c]) => (
                  <li key={g} className={c.hidden ? 'dim' : ''}><b>{g.replace(/_/g, ' ')}</b>{c.hidden ? <small>fewer than 5</small> : <small>{Math.round(c.adherence * 100)}% adherence, n = {c.n}</small>}</li>
                ))}</ul>
              </div>
            ))}
          </section>

          <details className="method"><summary>How each measure is defined</summary>
            <ul className="plain">{Object.entries(d.definitions as Record<string, string>).map(([k, v]) => <li key={k}><div><b>{k}</b><small>{v}</small></div></li>)}</ul>
            <p>{d.privacy}</p>
          </details>
        </>
      )}
    </>
  );
}
