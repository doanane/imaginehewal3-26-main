import React, { useEffect } from 'react';
import { Building2, CalendarClock, CalendarDays, ClipboardCheck, MessageSquare, Phone, Siren, Video } from 'lucide-react';
import { getCohort, getToday, TodayAppt } from './api';
import ConsultButton from './ConsultButton';
import { realtime } from './realtime';
import type { Overview } from './types';
import { Badge, CountUp, Empty, Skeleton } from './ui';
import { ago, usePolling } from './util';

const MODE: Record<string, { label: string; icon: React.ElementType }> = { in_person: { label: 'In person', icon: Building2 }, video: { label: 'Video', icon: Video }, phone: { label: 'Phone', icon: Phone } };
export const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const initials = (name?: string | null) => (name || '?').replace(/\s*\(.*?\)/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

/** The doctor's day: who is booked, who is next, who is waiting for an answer, and who needs a look first. */
export default function TodayPage({ overview, error }: { overview: Overview | null; error: string | null }) {
  const today = usePolling(getToday, 30000, []);
  const cohort = usePolling(() => getCohort(14), 60000, []);
  useEffect(() => { const o1 = realtime.on('appointment.update', () => today.reload()); const o2 = realtime.on('doctor_message.new', () => today.reload()); return () => { o1(); o2(); }; }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const t = today.data;
  const s = overview?.stats;
  const surname = (overview?.doctor.full_name || '').replace(/\s*\(.*?\)/g, '').replace(/^Dr\.?\s*/i, '').trim().split(/\s+/).pop() || '';
  const dateText = new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });

  if (!overview) return error ? <div className="alert-box" role="alert">{error}</div> : <div className="grid-kpi">{[0, 1, 2, 3].map(i => <div key={i} className="card"><Skeleton h={14} w="50%" /><div style={{ height: 14 }} /><Skeleton h={34} w="40%" /></div>)}</div>;

  const sub = !t ? '' : t.counts.today === 0 ? 'No appointments booked for today.' : `${t.counts.today} appointment${t.counts.today === 1 ? '' : 's'} today, ${t.counts.done} done${t.next_up ? `. Next: ${t.next_up.patient || 'a patient'} at ${clock(t.next_up.starts_at)}` : ''}.`;
  const attention = (s?.critical ?? 0) + (s?.monitor ?? 0);
  const next = t?.next_up || null;
  const nextAppt = next ? t?.appointments.find(a => a.id === next.id) : undefined;
  const NM = nextAppt ? (MODE[nextAppt.mode] || MODE.in_person) : null;

  return (
    <>
      <header className="page-head">
        <div><h1>{greet}, Dr {surname}</h1><p>{dateText}. {sub}</p></div>
        <a className="btn primary" href="#/schedule"><CalendarDays size={17} />Open schedule</a>
      </header>

      <div className="grid-kpi">
        <a className="kpi" href="#/schedule"><span className="kpi-ic"><CalendarDays size={20} /></span><span className="kpi-l">Appointments today</span><b><CountUp value={t?.counts.today ?? 0} /></b><small>{t ? `${t.counts.done} done, ${t.counts.week} in the next 7 days` : 'Loading'}</small></a>
        <a className={`kpi ${t && t.counts.waiting_requests ? 'warn' : ''}`} href="#/appointments"><span className="kpi-ic"><CalendarClock size={20} /></span><span className="kpi-l">Waiting for your answer</span><b><CountUp value={t?.counts.waiting_requests ?? 0} /></b><small>{t?.counts.waiting_requests ? 'Patients asked for a time' : 'No requests'}</small></a>
        <a className={`kpi ${s && s.critical ? 'bad' : ''}`} href="#/patients"><span className="kpi-ic"><ClipboardCheck size={20} /></span><span className="kpi-l">Patients to review</span><b><CountUp value={attention} /></b><small>{s?.critical ? `${s.critical} critical` : attention ? `${s?.monitor} to monitor` : 'All in range'}</small></a>
        <a className="kpi" href="#/messages"><span className="kpi-ic"><MessageSquare size={20} /></span><span className="kpi-l">Unread messages</span><b><CountUp value={t?.counts.unread_messages ?? 0} /></b><small>{t?.counts.open_drafts ? `${t.counts.open_drafts} unsigned note${t.counts.open_drafts === 1 ? '' : 's'}` : 'Nothing unsigned'}</small></a>
      </div>

      {overview.alerts.length > 0 && (
        <section className="card danger">
          <div className="card-head"><h2><Siren size={18} />Open emergencies</h2><a href="#/alerts">See all</a></div>
          <ul className="plain">{overview.alerts.slice(0, 3).map(a => <li key={a.id}><a href={`#/patient/${a.patient_id}`}><b>{a.patient || 'Patient'}</b><small>{a.reason || 'SOS'} {a.at ? ago(a.at) : ''}</small></a></li>)}</ul>
        </section>
      )}

      <div className="today-grid">
        <section className="card">
          <div className="card-head"><h2>Today's schedule</h2><small>{t ? `${t.appointments.length} listed` : ''}</small></div>
          {!t ? <Skeleton h={220} /> : t.appointments.length === 0 ? (
            <Empty icon={<CalendarDays size={26} />} title="A clear day">No appointments today. Patients can ask for a time in their app, or you can book from the schedule.</Empty>
          ) : (
            <ol className="sched-list">
              {t.appointments.map(a => <SchedRow key={a.id} a={a} next={t.next_up?.id === a.id} />)}
            </ol>
          )}
        </section>

        <div className="stack">
          {nextAppt && NM && (
            <section className="card next-card">
              <div className="next-top">
                <span className={`avatar lg ${nextAppt.group || ''}`}>{initials(nextAppt.patient)}</span>
                <div><b>{nextAppt.patient || 'Patient'}</b><small>{[nextAppt.age ? `${nextAppt.age} yrs` : null, nextAppt.gender].filter(Boolean).join(', ') || 'Next patient'}</small></div>
                <span className="status-pill next"><NM.icon size={13} />{NM.label}</span>
              </div>
              <dl className="next-facts">
                <dt>Time</dt><dd>{clock(nextAppt.starts_at)} to {clock(new Date(new Date(nextAppt.starts_at).getTime() + nextAppt.duration_min * 60000).toISOString())}</dd>
                <dt>Reason</dt><dd>{nextAppt.reason || 'General review'}</dd>
                {nextAppt.group && <><dt>Status</dt><dd><Badge group={nextAppt.group} /></dd></>}
              </dl>
              <div className="next-actions">
                <ConsultButton patientId={nextAppt.patient_id} appointmentId={nextAppt.id} existing={nextAppt.consultation} label="Begin consultation" />
                <a className="btn ghost" href={`#/patient/${nextAppt.patient_id}`}>Open chart</a>
              </div>
            </section>
          )}

          <section className="card">
            <div className="card-head"><h2>Review first</h2><a href="#/panel">Panel health</a></div>
            {!cohort.data ? <Skeleton h={100} /> : cohort.data.review_queue.length === 0 ? (
              <Empty icon={<ClipboardCheck size={26} />} title="Nothing needs review">Every patient has recent readings inside their usual range.</Empty>
            ) : (
              <ul className="queue">
                {cohort.data.review_queue.map(q => (
                  <li key={q.patient_id}>
                    <a href={`#/patient/${q.patient_id}`}><span className={`avatar ${q.group || ''}`}>{initials(q.name)}</span><div><b>{q.name}</b><small>{q.why.length ? q.why.join(', ') : 'Flagged'}</small></div><Badge group={q.group} /></a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function SchedRow({ a, next }: { a: TodayAppt; next: boolean }) {
  const M = MODE[a.mode] || MODE.in_person;
  return (
    <li className={`sched-row ${a.status} ${next ? 'next' : ''} ${a.is_now ? 'now' : ''}`}>
      <span className="sr-time"><b>{clock(a.starts_at)}</b><small>{a.duration_min} min</small></span>
      <a className="sr-who" href={`#/patient/${a.patient_id}`}><span className={`avatar ${a.group || ''}`}>{initials(a.patient)}</span><span><b>{a.patient || 'Patient'}</b><small>{a.reason || 'Not given'}</small></span></a>
      <span className="how"><M.icon size={14} />{M.label}</span>
      <span className={`status-pill ${next ? 'next' : a.status}`}>{next ? 'Up next' : a.status === 'requested' ? 'Waiting' : a.status}</span>
      <span className="sr-act">
        {a.status === 'requested' ? <a className="btn ghost small" href="#/appointments">Answer</a>
          : a.status === 'completed' && !a.consultation ? <ConsultButton patientId={a.patient_id} appointmentId={a.id} small primary={false} label="Add note" />
            : <ConsultButton patientId={a.patient_id} appointmentId={a.id} existing={a.consultation} small />}
      </span>
    </li>
  );
}
