import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ChevronRight, ClipboardCheck, HeartPulse, PhoneOff, Pill, Siren, Users } from 'lucide-react';
import { getCohort } from './api';
import { Gauge } from './Charts';
import type { Overview } from './types';
import { Badge, CountUp, Empty, Segmented, Skeleton, Tilt } from './ui';
import { ago, usePolling } from './util';

const list = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] as number[] } } };

export default function OverviewPage({ overview, error }: { overview: Overview | null; error: string | null }) {
  const [days, setDays] = useState(14);
  const { data: cohort } = usePolling(() => getCohort(days), 30000, [days]);
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  if (!overview) return error ? <div className="alert-box" role="alert">{error}</div> : <div className="grid-kpi">{[0, 1, 2, 3].map(i => <div key={i} className="card"><Skeleton h={14} w="50%" /><div style={{ height: 14 }} /><Skeleton h={34} w="40%" /></div>)}</div>;
  const s = overview.stats;
  const surname = overview.doctor.full_name.replace(/\s*\(.*?\)/g, '').replace(/^Dr\.?\s*/i, '').trim().split(/\s+/).pop() || '';

  return (
    <>
      <header className="page-head">
        <div><h1>{greet}, Dr {surname}</h1><p>{s.total === 0 ? 'No patients have chosen you yet.' : `${s.total} patient${s.total === 1 ? '' : 's'} under your care${s.critical ? `, ${s.critical} need${s.critical === 1 ? 's' : ''} attention now` : ', none critical right now'}.`}</p></div>
        <Segmented label="window" value={days} onChange={setDays} options={[{ v: 7, label: '7 days' }, { v: 14, label: '14 days' }, { v: 30, label: '30 days' }, { v: 90, label: '90 days' }]} />
      </header>

      <motion.div className="grid-kpi" variants={list} initial="hidden" animate="show">
        <motion.div variants={item}><Tilt><a className="kpi" href="#/patients"><span className="kpi-ic"><Users size={20} /></span><span className="kpi-l">Patients</span><b><CountUp value={s.total} /></b><small>{s.healthy + s.stable} in range, {s.monitor} to monitor</small></a></Tilt></motion.div>
        <motion.div variants={item}><Tilt><a className={`kpi ${s.critical ? 'bad' : ''}`} href="#/patients"><span className="kpi-ic"><HeartPulse size={20} /></span><span className="kpi-l">Critical readings</span><b><CountUp value={s.critical} /></b><small>{s.critical ? 'Review first' : 'Nothing out of range'}</small></a></Tilt></motion.div>
        <motion.div variants={item}><Tilt><a className={`kpi ${s.active_alerts ? 'bad' : ''}`} href="#/alerts"><span className="kpi-ic"><Siren size={20} /></span><span className="kpi-l">Active emergencies</span><b><CountUp value={s.active_alerts} /></b><small>{s.active_alerts ? 'A patient pressed SOS' : 'None open'}</small></a></Tilt></motion.div>
        <motion.div variants={item}><Tilt><div className="kpi"><span className="kpi-ic"><PhoneOff size={20} /></span><span className="kpi-l">No data in 48 hours</span><b><CountUp value={cohort?.silent_48h.length ?? 0} /></b><small>Phone or watch not reporting</small></div></Tilt></motion.div>
      </motion.div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head"><h2><ClipboardCheck size={18} />Review first</h2><small>Ordered by status, open emergencies and missed medication</small></div>
          {!cohort ? <Skeleton h={120} /> : cohort.review_queue.length === 0 ? (
            <Empty icon={<ClipboardCheck size={26} />} title="Nothing needs review">Every patient has recent readings inside their usual range.</Empty>
          ) : (
            <motion.ul className="queue" variants={list} initial="hidden" animate="show">
              {cohort.review_queue.map(q => (
                <motion.li key={q.patient_id} variants={item}>
                  <a href={`#/patient/${q.patient_id}`}>
                    <div><b>{q.name}</b> <Badge group={q.group} /><small>{q.why.length ? q.why.join(', ') : 'Flagged'}</small></div>
                    <ChevronRight size={18} />
                  </a>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </section>

        <section className="card">
          <div className="card-head"><h2><HeartPulse size={18} />Panel control, last {days} days</h2><small>Across patients with readings</small></div>
          {!cohort ? <Skeleton h={160} /> : (
            <div className="gauges">
              <Gauge value={cohort.bp_control.pct} label="BP controlled" sub={cohort.bp_control.measured ? `${cohort.bp_control.controlled} of ${cohort.bp_control.measured} patients average below 140/90 mmHg` : 'No blood pressure readings yet'} />
              <Gauge value={cohort.adherence.mean} label="Medication taken" sub={cohort.adherence.measured ? `${cohort.adherence.below_70} of ${cohort.adherence.measured} patients below 70%` : 'Not enough doses have been due yet to judge, this is not 0%'} />
            </div>
          )}
        </section>
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head"><h2><PhoneOff size={18} />Not reporting</h2><small>No reading for 48 hours or more</small></div>
          {!cohort ? <Skeleton h={80} /> : cohort.silent_48h.length === 0 ? <p className="muted">Every patient has reported in the last 48 hours.</p> : (
            <ul className="plain">{cohort.silent_48h.map(p => <li key={p.patient_id}><a href={`#/patient/${p.patient_id}`}><b>{p.name}</b><small>{p.last ? `Last reading ${ago(p.last)}` : 'Never reported'}</small></a></li>)}</ul>
          )}
        </section>
        <section className="card">
          <div className="card-head"><h2><Pill size={18} />Conditions on your list</h2><small>{cohort?.mean_age ? `Average age ${cohort.mean_age}` : ''}</small></div>
          {!cohort ? <Skeleton h={80} /> : cohort.conditions.length === 0 ? <p className="muted">No conditions recorded in patient profiles.</p> : (
            <ul className="hbars">{cohort.conditions.map(c => (
              <li key={c.name}><span>{c.name}</span>
                <div><motion.i initial={{ width: 0 }} animate={{ width: `${(c.count / cohort.conditions[0].count) * 100}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} /></div><b>{c.count}</b></li>
            ))}</ul>
          )}
        </section>
      </div>

      {overview.alerts.length > 0 && (
        <section className="card danger">
          <div className="card-head"><h2><AlertTriangle size={18} />Open emergencies</h2><a href="#/alerts">See all</a></div>
          <ul className="plain">{overview.alerts.slice(0, 3).map(a => <li key={a.id}><a href={`#/patient/${a.patient_id}`}><b>{a.patient || 'Patient'}</b><small>{a.reason || 'SOS'} {a.at ? ago(a.at) : ''}</small></a></li>)}</ul>
        </section>
      )}
    </>
  );
}
