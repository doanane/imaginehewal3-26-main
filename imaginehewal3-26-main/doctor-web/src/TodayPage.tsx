import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Building2, CalendarClock, CalendarDays, ChevronRight, ClipboardCheck, MessageSquare, Phone, Siren, Users, Video } from 'lucide-react';
import { getCohort, getToday, TodayAppt } from './api';
import ConsultButton from './ConsultButton';
import { realtime } from './realtime';
import type { Overview } from './types';
import { Badge, CountUp, Empty, Skeleton, Tilt } from './ui';
import { ago, usePolling } from './util';

const MODE: Record<string, { label: string; icon: React.ElementType }> = { in_person: { label: 'In person', icon: Building2 }, video: { label: 'Video', icon: Video }, phone: { label: 'Phone', icon: Phone } };
export const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const list = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as number[] } } };

/** The doctor's day: who is booked, who is next, who is waiting for an answer, and who needs a look first. */
export default function TodayPage({ overview, error }: { overview: Overview | null; error: string | null }) {
  const today = usePolling(getToday, 30000, []);
  const cohort = usePolling(() => getCohort(14), 60000, []);
  useEffect(() => { const o1 = realtime.on('appointment.update', () => today.reload()); const o2 = realtime.on('doctor_message.new', () => today.reload()); return () => { o1(); o2(); }; }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const t = today.data;
  const s = overview?.stats;
  const surname = (overview?.doctor.full_name || '').replace(/^Dr\.?\s*/i, '').split(/\s+/).pop() || '';
  const dateText = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });

  if (!overview) return error ? <div className="alert-box" role="alert">{error}</div> : <div className="grid-kpi">{[0, 1, 2, 3].map(i => <div key={i} className="card"><Skeleton h={14} w="50%" /><div style={{ height: 14 }} /><Skeleton h={34} w="40%" /></div>)}</div>;

  const sub = !t ? '' : t.counts.today === 0 ? 'No appointments booked for today.' : `${t.counts.today} appointment${t.counts.today === 1 ? '' : 's'} today, ${t.counts.done} done${t.next_up ? `. Next: ${t.next_up.patient || 'a patient'} at ${clock(t.next_up.starts_at)}` : ''}.`;
  const attention = (s?.critical ?? 0) + (s?.monitor ?? 0);

  return (
    <>
      <header className="page-head">
        <div><h1>{greet}, Dr {surname}</h1><p>{dateText}. {sub}</p></div>
        <a className="btn primary" href="#/schedule"><CalendarDays size={17} />Open schedule</a>
      </header>

      <motion.div className="grid-kpi" variants={list} initial="hidden" animate="show">
        <motion.div variants={item}><Tilt><a className="kpi" href="#/schedule"><span className="kpi-ic"><CalendarDays size={20} /></span><span className="kpi-l">Appointments today</span><b><CountUp value={t?.counts.today ?? 0} /></b><small>{t ? `${t.counts.done} done, ${t.counts.week} in the next 7 days` : 'Loading'}</small></a></Tilt></motion.div>
        <motion.div variants={item}><Tilt><a className={`kpi ${t && t.counts.waiting_requests ? 'warn' : ''}`} href="#/appointments"><span className="kpi-ic"><CalendarClock size={20} /></span><span className="kpi-l">Waiting for your answer</span><b><CountUp value={t?.counts.waiting_requests ?? 0} /></b><small>{t?.counts.waiting_requests ? 'Patients asked for a time' : 'No requests'}</small></a></Tilt></motion.div>
        <motion.div variants={item}><Tilt><a className={`kpi ${s && s.critical ? 'bad' : ''}`} href="#/patients"><span className="kpi-ic"><ClipboardCheck size={20} /></span><span className="kpi-l">Patients to review</span><b><CountUp value={attention} /></b><small>{s?.critical ? `${s.critical} critical` : attention ? `${s?.monitor} to monitor` : 'All in range'}</small></a></Tilt></motion.div>
        <motion.div variants={item}><Tilt><a className="kpi" href="#/messages"><span className="kpi-ic"><MessageSquare size={20} /></span><span className="kpi-l">Unread messages</span><b><CountUp value={t?.counts.unread_messages ?? 0} /></b><small>{t?.counts.open_drafts ? `${t.counts.open_drafts} unsigned note${t.counts.open_drafts === 1 ? '' : 's'}` : 'Nothing unsigned'}</small></a></Tilt></motion.div>
      </motion.div>

      {overview.alerts.length > 0 && (
        <section className="card danger">
          <div className="card-head"><h2><Siren size={18} />Open emergencies</h2><a href="#/alerts">See all</a></div>
          <ul className="plain">{overview.alerts.slice(0, 3).map(a => <li key={a.id}><a href={`#/patient/${a.patient_id}`}><b>{a.patient || 'Patient'}</b><small>{a.reason || 'SOS'} {a.at ? ago(a.at) : ''}</small></a></li>)}</ul>
        </section>
      )}

      <div className="grid-main">
        <section className="card">
          <div className="card-head"><h2><CalendarDays size={18} />Appointments today</h2><small>{t ? `${t.appointments.length} listed` : ''}</small></div>
          {!t ? <Skeleton h={160} /> : t.appointments.length === 0 ? (
            <Empty icon={<CalendarDays size={26} />} title="A clear day">No appointments today. Patients can ask for a time in their app, or you can book from the schedule.</Empty>
          ) : (
            <div className="table-wrap">
              <table className="tbl2">
                <thead><tr><th>Time</th><th>Patient</th><th>Reason</th><th>How</th><th>Status</th><th><span className="sr">Action</span></th></tr></thead>
                <tbody>
                  {t.appointments.map(a => <Row key={a.id} a={a} />)}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <div className="card-head"><h2><CalendarClock size={18} />Up next</h2><small>Your day in order</small></div>
          {!t ? <Skeleton h={160} /> : t.appointments.length === 0 ? <p className="muted">Nothing booked yet today.</p> : (
            <ol className="timeline">
              {t.appointments.map(a => {
                const next = t.next_up?.id === a.id;
                const M = MODE[a.mode] || MODE.in_person;
                return (
                  <li key={a.id} className={`${a.status} ${next ? 'next' : ''} ${a.is_now ? 'now' : ''}`}>
                    <span className="t-time">{clock(a.starts_at)}</span>
                    <span className="t-dot" aria-hidden />
                    <div className="t-body">
                      <b>{a.patient || 'Patient'}</b><small>{a.reason || 'Appointment'} <M.icon size={12} /> {M.label}, {a.duration_min} min</small>
                      {next && (
                        <div className="t-card">
                          <dl><dt>Patient</dt><dd><a href={`#/patient/${a.patient_id}`}>{a.patient}{a.age ? `, ${a.age}` : ''}</a></dd><dt>Time</dt><dd>{clock(a.starts_at)} to {clock(new Date(new Date(a.starts_at).getTime() + a.duration_min * 60000).toISOString())}</dd><dt>Purpose</dt><dd>{a.reason || 'General review'}</dd></dl>
                          <ConsultButton patientId={a.patient_id} appointmentId={a.id} existing={a.consultation} label="Begin consultation" />
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </div>

      <section className="card">
        <div className="card-head"><h2><Users size={18} />Review first</h2><small>Ordered by status, open emergencies and low medicine use. <a href="#/panel">Panel health</a></small></div>
        {!cohort.data ? <Skeleton h={100} /> : cohort.data.review_queue.length === 0 ? (
          <Empty icon={<ClipboardCheck size={26} />} title="Nothing needs review">Every patient has recent readings inside their usual range.</Empty>
        ) : (
          <motion.ul className="queue" variants={list} initial="hidden" animate="show">
            {cohort.data.review_queue.map(q => (
              <motion.li key={q.patient_id} variants={item}>
                <a href={`#/patient/${q.patient_id}`}><div><b>{q.name}</b> <Badge group={q.group} /><small>{q.why.length ? q.why.join(', ') : 'Flagged'}</small></div><ChevronRight size={18} /></a>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </section>
    </>
  );
}

function Row({ a }: { a: TodayAppt }) {
  const M = MODE[a.mode] || MODE.in_person;
  return (
    <tr className={a.is_now ? 'now' : ''}>
      <td><b>{clock(a.starts_at)}</b><small>{a.duration_min} min</small></td>
      <td><a href={`#/patient/${a.patient_id}`}><b>{a.patient || 'Patient'}</b></a><small>{[a.age ? `${a.age} yrs` : null, a.gender].filter(Boolean).join(', ')} {a.group && <Badge group={a.group} />}</small></td>
      <td>{a.reason || <span className="muted">Not given</span>}</td>
      <td><span className="how"><M.icon size={14} />{M.label}</span></td>
      <td><span className={`status-pill ${a.status}`}>{a.status === 'requested' ? 'waiting' : a.status}</span></td>
      <td className="right">
        {a.status === 'requested' ? <a className="btn ghost small" href="#/appointments">Answer</a>
          : a.status === 'completed' && !a.consultation ? <ConsultButton patientId={a.patient_id} appointmentId={a.id} small primary={false} label="Add note" />
            : <ConsultButton patientId={a.patient_id} appointmentId={a.id} existing={a.consultation} small />}
      </td>
    </tr>
  );
}
