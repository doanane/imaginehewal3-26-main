import React, { useEffect } from 'react';
import { Building2, CalendarClock, CalendarDays, ClipboardCheck, MessageSquare, Phone, Siren, Video } from 'lucide-react';
import { getCohort, getPatient, getToday, TodayAppt } from './api';
import ConsultButton from './ConsultButton';
import Rail from './Rail';
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
  const focusId: number | null = nextAppt?.patient_id ?? t?.appointments[0]?.patient_id ?? cohort.data?.review_queue[0]?.patient_id ?? null;

  return (
    <div className="rail-layout">
    <div className="rail-main">
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
        <div className="stack">
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

        <div className="stack">
          {focusId != null && <FocusPatient id={focusId} appt={nextAppt || t?.appointments.find(x => x.patient_id === focusId) || null} isNext={!!nextAppt} />}

        </div>
      </div>
    </div>
    <Rail />
    </div>
  );
}

function SchedRow({ a, next }: { a: TodayAppt; next: boolean }) {
  const M = MODE[a.mode] || MODE.in_person;
  return (
    <li className={`sched-row ${a.status} ${next ? 'next' : ''} ${a.is_now ? 'now' : ''}`}>
      <span className="sr-time"><b>{clock(a.starts_at)}</b><small>{a.duration_min} min</small></span>
      <a className="sr-who" href={`#/patient/${a.patient_id}`}><span className={`avatar ${a.group || ''}`}>{initials(a.patient)}</span><span><b>{a.patient || 'Patient'}</b><small>{a.reason || 'Not given'}</small></span></a>
      <span className="sr-side">
        <span className="how"><M.icon size={14} />{M.label}</span>
        <span className={`status-pill ${next ? 'next' : a.status}`}>{next ? 'Up next' : a.status === 'requested' ? 'Waiting' : a.status}</span>
      </span>
      <span className="sr-act">
        {a.status === 'requested' ? <a className="btn ghost small" href="#/appointments">Answer</a>
          : a.status === 'completed' && !a.consultation ? <ConsultButton patientId={a.patient_id} appointmentId={a.id} small primary={false} label="Add note" />
            : <ConsultButton patientId={a.patient_id} appointmentId={a.id} existing={a.consultation} small />}
      </span>
    </li>
  );
}

/** One patient in focus: the next visit, or the first person to review. Real readings only: the blood pressure line is drawn from stored readings, never filled in. */
function FocusPatient({ id, appt, isNext }: { id: number; appt: TodayAppt | null; isNext: boolean }) {
  const d = usePolling(() => getPatient(id), 60000, [id]);
  const p = d.data;
  if (!p) return <section className="card"><Skeleton h={260} /></section>;
  const pts = p.vitals_series.filter(v => v.systolic != null && v.diastolic != null).slice(-30);
  const last = pts[pts.length - 1];
  const meds = p.medications.slice(0, 4);
  const when = appt ? `${clock(appt.starts_at)}${appt.reason ? `, ${appt.reason}` : ''}` : 'Not booked today';
  const M = appt ? (MODE[appt.mode] || MODE.in_person) : null;
  return (
    <section className="card focus">
      <div className="focus-top">
        <span className={`avatar lg ${p.patient.group || ''}`}>{initials(p.patient.name)}</span>
        <div><b>{p.patient.name}</b><small>{[p.patient.age ? `${p.patient.age} yrs` : null, p.patient.gender].filter(Boolean).join(', ')}</small></div>
        <Badge group={p.patient.group} />
      </div>
      <p className="focus-when"><span>{isNext ? 'Next visit' : appt ? 'Today' : 'Review first'}</span>{when}{M && <em><M.icon size={14} />{M.label}</em>}</p>

      <div className="focus-bp">
        <div className="focus-bp-head"><span>Blood pressure, recent readings</span>{last && <b>{last.systolic}/{last.diastolic}<i> mmHg</i></b>}</div>
        {pts.length >= 2 ? <BpLine pts={pts as { systolic: number; diastolic: number }[]} /> : <p className="muted">{pts.length === 1 ? 'Only one reading so far.' : 'No blood pressure readings yet.'}</p>}
      </div>

      <div className="focus-meds">
        <span className="focus-label">Medicines today</span>
        {meds.length === 0 ? <p className="muted">None recorded.</p> : (
          <ul>{meds.map(m => { const due = m.doses.length, took = m.doses.filter(x => x.taken).length; return <li key={m.name}><b>{m.name}</b>{m.dose && <small>{m.dose}</small>}<em className={due && took === due ? 'ok' : ''}>{due ? `${took} of ${due} taken` : 'No dose today'}</em></li>; })}</ul>
        )}
      </div>

      <div className="next-actions">
        {appt ? <ConsultButton patientId={appt.patient_id} appointmentId={appt.id} existing={appt.consultation} label="Begin consultation" /> : null}
        <a className="btn ghost" href={`#/patient/${id}`}>Open chart</a>
      </div>
    </section>
  );
}

/** Two honest lines, systolic and diastolic, scaled to the readings shown. */
function BpLine({ pts }: { pts: { systolic: number; diastolic: number }[] }) {
  const W = 520, H = 120, P = 8;
  const all = pts.flatMap(p => [p.systolic, p.diastolic]);
  const lo = Math.min(...all) - 8, hi = Math.max(...all) + 8;
  const x = (i: number) => P + (i * (W - 2 * P)) / (pts.length - 1);
  const y = (v: number) => H - P - ((v - lo) / (hi - lo)) * (H - 2 * P);
  const line = (k: 'systolic' | 'diastolic') => pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[k]).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  return (
    <svg className="bp-svg" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={`Blood pressure over the last ${pts.length} readings, now ${last.systolic} over ${last.diastolic}`}>
      <line x1={P} x2={W - P} y1={y(130)} y2={y(130)} className="bp-ref" />
      <path d={line('diastolic')} className="bp-dia" /><path d={line('systolic')} className="bp-sys" />
      <path d={`M${x(pts.length - 1)},${y(last.systolic)}h0`} className="bp-dot" /><path d={`M${x(pts.length - 1)},${y(last.diastolic)}h0`} className="bp-dot dia" />
    </svg>
  );
}
