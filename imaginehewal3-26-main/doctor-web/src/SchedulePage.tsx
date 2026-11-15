import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Appointment, bookAppointment, getSchedule, patchAppointment, Schedule } from './api';
import ConsultButton from './ConsultButton';
import { realtime } from './realtime';
import type { Overview } from './types';
import { Skeleton } from './ui';
import { clock } from './TodayPage';
import { localInput } from './AppointmentsPage';

const ymd = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const mondayOf = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
const mins = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const label = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

/** A week at a glance. Shaded cells are outside your working hours. Click a free slot to book, click an appointment to act on it. */
export default function SchedulePage({ overview }: { overview: Overview | null }) {
  const [week, setWeek] = useState(() => mondayOf(new Date()));
  const [s, setS] = useState<Schedule | null>(null);
  const [err, setErr] = useState('');
  const [book, setBook] = useState<Date | null>(null);
  const [open, setOpen] = useState<Appointment | null>(null);

  const load = useCallback(() => { getSchedule(ymd(week), 7).then(r => { setS(r); setErr(''); }).catch(e => setErr((e as Error).message)); }, [week]);
  useEffect(() => { setS(null); load(); }, [load]);
  useEffect(() => { const o = realtime.on('appointment.update', () => load()); return () => { o(); }; }, [load]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => { const d = new Date(week); d.setDate(d.getDate() + i); return d; }), [week]);
  const rows = useMemo(() => {
    if (!s) return [];
    const step = s.hours.slot_min;
    let lo = mins(s.hours.start), hi = mins(s.hours.end);
    for (const a of s.appointments) { const d = new Date(a.starts_at); const m = d.getHours() * 60 + d.getMinutes(); lo = Math.min(lo, Math.floor(m / step) * step); hi = Math.max(hi, m + 1); }
    const out: number[] = [];
    for (let m = Math.floor(lo / step) * step; m < hi; m += step) out.push(m);
    return out;
  }, [s]);

  const at = (day: Date, m: number) => { const d = new Date(day); d.setHours(Math.floor(m / 60), m % 60, 0, 0); return d; };
  const inHours = (day: Date, m: number) => !!s && s.hours.days.includes((day.getDay() + 6) % 7) && m >= mins(s.hours.start) && m < mins(s.hours.end);
  const inCell = (day: Date, m: number) => (s?.appointments || []).filter(a => {
    if (a.status === 'declined' || a.status === 'cancelled') return false;
    const d = new Date(a.starts_at); const x = d.getHours() * 60 + d.getMinutes();
    return d.toDateString() === day.toDateString() && x >= m && x < m + s!.hours.slot_min;
  });
  const range = `${days[0].toLocaleDateString([], { day: 'numeric', month: 'short' })} to ${days[6].toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' })}`;
  const today = new Date().toDateString();

  return (
    <>
      <header className="page-head">
        <div><h1>Schedule</h1><p>{range}. Shaded time is outside your working hours; change them in your <a href="#/profile">profile</a>.</p></div>
        <div className="row-btns">
          <button className="btn ghost" aria-label="Previous week" onClick={() => setWeek(w => { const d = new Date(w); d.setDate(d.getDate() - 7); return d; })}><ChevronLeft size={17} /></button>
          <button className="btn ghost" onClick={() => setWeek(mondayOf(new Date()))}>This week</button>
          <button className="btn ghost" aria-label="Next week" onClick={() => setWeek(w => { const d = new Date(w); d.setDate(d.getDate() + 7); return d; })}><ChevronRight size={17} /></button>
        </div>
      </header>
      {err && <div className="alert-box" role="alert">{err}</div>}
      {!s ? <div className="card"><Skeleton h={320} /></div> : (
        <div className="card sched-card">
          <div className="sched" style={{ gridTemplateColumns: '56px repeat(7, minmax(110px, 1fr))' }} role="grid" aria-label="Week schedule">
            <div className="sched-corner" />
            {days.map(d => <div key={d.toISOString()} className={`sched-day ${d.toDateString() === today ? 'today' : ''}`} role="columnheader"><small>{d.toLocaleDateString([], { weekday: 'short' })}</small><b>{d.getDate()}</b></div>)}
            {rows.map(m => (
              <React.Fragment key={m}>
                <div className="sched-time">{label(m)}</div>
                {days.map(d => {
                  const here = inCell(d, m);
                  const free = here.length === 0;
                  const ok = inHours(d, m);
                  const past = at(d, m).getTime() < Date.now();
                  return (
                    <div key={d.toISOString() + m} role="gridcell" className={`sched-cell ${ok ? '' : 'off'} ${past ? 'past' : ''}`}>
                      {here.map(a => <button key={a.id} type="button" className={`sched-appt ${a.status}`} onClick={() => setOpen(a)}><b>{clock(a.starts_at)}</b> {a.patient || 'Patient'}</button>)}
                      {free && !past && <button type="button" className="sched-add" aria-label={`Book ${d.toLocaleDateString([], { weekday: 'long' })} ${label(m)}`} onClick={() => setBook(at(d, m))}>+</button>}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
      {book && <BookModal when={book} overview={overview} slot={s?.hours.slot_min || 30} onClose={() => setBook(null)} onDone={() => { setBook(null); load(); }} />}
      {open && <ApptModal a={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); load(); }} />}
    </>
  );
}

function BookModal({ when, overview, slot, onClose, onDone }: { when: Date; overview: Overview | null; slot: number; onClose: () => void; onDone: () => void }) {
  const [pid, setPid] = useState<number>(0);
  const [start, setStart] = useState(localInput(when));
  const [mode, setMode] = useState('in_person');
  const [reason, setReason] = useState('');
  const [dur, setDur] = useState(slot);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); if (!pid) { setErr('Choose a patient'); return; }
    setBusy(true); setErr('');
    try { await bookAppointment(pid, { starts_at: new Date(start).toISOString(), duration_min: dur, mode, reason: reason.trim() || undefined }); onDone(); }
    catch (x) { setErr((x as Error).message); setBusy(false); }
  };
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Book an appointment">
      <form className="modal-card" onSubmit={submit}>
        <div className="card-head"><h2>Book an appointment</h2><button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button></div>
        <label htmlFor="bk-p">Patient</label>
        <div className="field"><select id="bk-p" value={pid} onChange={e => setPid(Number(e.target.value))} required><option value={0}>Choose a patient</option>{(overview?.patients || []).map(p => <option key={p.patient_id} value={p.patient_id}>{p.name}</option>)}</select></div>
        <div className="two">
          <div><label htmlFor="bk-t">Date and time</label><div className="field"><input id="bk-t" type="datetime-local" value={start} min={localInput(new Date())} onChange={e => setStart(e.target.value)} required /></div></div>
          <div><label htmlFor="bk-d">Length</label><div className="field"><select id="bk-d" value={dur} onChange={e => setDur(Number(e.target.value))}>{[15, 20, 30, 45, 60].map(n => <option key={n} value={n}>{n} min</option>)}</select></div></div>
        </div>
        <label htmlFor="bk-m">How</label>
        <div className="field"><select id="bk-m" value={mode} onChange={e => setMode(e.target.value)}><option value="in_person">In person</option><option value="video">Video</option><option value="phone">Phone</option></select></div>
        <label htmlFor="bk-r">Reason (optional)</label>
        <div className="field"><input id="bk-r" value={reason} maxLength={200} onChange={e => setReason(e.target.value)} /></div>
        {err && <div className="alert-box" role="alert">{err}</div>}
        <div className="row-end"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Booking' : 'Book and tell the patient'}</button></div>
      </form>
    </div>
  );
}

function ApptModal({ a, onClose, onDone }: { a: Appointment; onClose: () => void; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = async (status: 'confirmed' | 'declined' | 'cancelled' | 'completed') => {
    setBusy(true); setErr('');
    try { await patchAppointment(a.id, { status }); onDone(); } catch (x) { setErr((x as Error).message); setBusy(false); }
  };
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Appointment">
      <div className="modal-card">
        <div className="card-head"><h2>{a.patient || 'Patient'}</h2><button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button></div>
        <p>{new Date(a.starts_at).toLocaleString([], { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}, {a.duration_min} min</p>
        <p className="muted">{a.reason || 'No reason given'}</p>
        <span className={`status-pill ${a.status}`}>{a.status === 'requested' ? 'waiting for you' : a.status}</span>
        {err && <div className="alert-box" role="alert">{err}</div>}
        <div className="row-btns" style={{ marginTop: 14 }}>
          {a.status === 'requested' && <><button className="btn primary" disabled={busy} onClick={() => set('confirmed')}>Confirm</button><button className="btn ghost" disabled={busy} onClick={() => set('declined')}>Decline</button></>}
          {a.status === 'confirmed' && <><ConsultButton patientId={a.patient_id} appointmentId={a.id} label="Consult" /><button className="btn ghost" disabled={busy} onClick={() => set('cancelled')}>Cancel appointment</button></>}
          <a className="btn ghost" href={`#/patient/${a.patient_id}`}>Open chart</a>
        </div>
      </div>
    </div>
  );
}
