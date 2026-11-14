import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, Eye, EyeOff, Pill, Plus, ScrollText, Trash2 } from 'lucide-react';
import { addNote, Appointment, bookAppointment, deleteNote, getAppointments, getNotes, getPrescriptions, Note, prescribe, Rx, stopPrescription } from './api';
import { fmt, localInput, Row } from './AppointmentsPage';
import { realtime } from './realtime';
import { Empty } from './ui';
import { when } from './util';

/** What the doctor decides for one patient: medicines, private or shared notes, and appointments. */
export default function CarePlan({ id, name }: { id: number; name: string }) {
  return (
    <div className="grid-2 careplan">
      <Prescriptions id={id} name={name} />
      <div className="stack"><Notes id={id} /><Appointments id={id} /></div>
    </div>
  );
}

function useList<T>(load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [err, setErr] = useState('');
  const run = useCallback(() => { load().then(d => { setData(d); setErr(''); }).catch(e => setErr((e as Error).message)); }, [load]);   // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setData(null); run(); }, [run]);
  return { data, err, run };
}

// ------------------------------------------------------------------ prescriptions
function Prescriptions({ id, name }: { id: number; name: string }) {
  const { data, err, run } = useList(useCallback(() => getPrescriptions(id), [id]));
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', dose: '', times: ['08:00'], instructions: '' });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [stopping, setStopping] = useState<number | null>(null);
  const [reason, setReason] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg('');
    try { await prescribe(id, { name: f.name, dose: f.dose, times: f.times, instructions: f.instructions }); setF({ name: '', dose: '', times: ['08:00'], instructions: '' }); setOpen(false); run(); }
    catch (x) { setMsg((x as Error).message); } finally { setBusy(false); }
  };
  const stop = async (rx: Rx) => {
    setBusy(true); setMsg('');
    try { await stopPrescription(rx.id, reason); setStopping(null); setReason(''); run(); } catch (x) { setMsg((x as Error).message); } finally { setBusy(false); }
  };
  const active = (data?.prescriptions || []).filter(r => r.status === 'active');
  const past = (data?.prescriptions || []).filter(r => r.status === 'stopped');

  return (
    <section className="card">
      <div className="card-head"><h2><Pill size={18} />Prescriptions</h2><button className="btn primary small" onClick={() => setOpen(o => !o)}><Plus size={15} />Prescribe</button></div>
      <p className="muted small">A new medicine appears in {name.split(' ')[0]}’s own medicine list with reminders, and their doses taken are counted in the adherence figures.</p>
      <AnimatePresence>
        {open && (
          <motion.form onSubmit={submit} className="rx-form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <label htmlFor="rxn">Medicine</label>
            <div className="field"><input id="rxn" required minLength={2} maxLength={120} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="For example Amlodipine" /></div>
            <label htmlFor="rxd">Dose</label>
            <div className="field"><input id="rxd" maxLength={60} value={f.dose} onChange={e => setF({ ...f, dose: e.target.value })} placeholder="For example 5 mg" /></div>
            <label>Times each day</label>
            <div className="times">
              {f.times.map((t, i) => (
                <span key={i} className="time-chip">
                  <input type="time" aria-label={`Dose time ${i + 1}`} value={t} required onChange={e => setF({ ...f, times: f.times.map((x, j) => (j === i ? e.target.value : x)) })} />
                  {f.times.length > 1 && <button type="button" className="icon-btn" aria-label="Remove this time" onClick={() => setF({ ...f, times: f.times.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>}
                </span>
              ))}
              {f.times.length < 6 && <button type="button" className="btn ghost small" onClick={() => setF({ ...f, times: [...f.times, '20:00'] })}><Plus size={14} />Add time</button>}
            </div>
            <label htmlFor="rxi">Instructions (optional)</label>
            <div className="field"><input id="rxi" maxLength={400} value={f.instructions} onChange={e => setF({ ...f, instructions: e.target.value })} placeholder="For example: take after food" /></div>
            <div className="row-end"><small>The patient is told straight away.</small><button className="btn primary" disabled={busy}>{busy ? 'Saving' : 'Prescribe'}</button></div>
          </motion.form>
        )}
      </AnimatePresence>
      {(msg || err) && <div className="alert-box" role="alert">{msg || err}</div>}
      {!data ? null : active.length === 0 && past.length === 0 ? <Empty icon={<Pill size={26} />} title="No prescriptions yet">Medicines you prescribe are listed here.</Empty> : (
        <>
          <ul className="rx-list">
            {active.map(r => (
              <li key={r.id}>
                <div><b>{r.name}</b>{r.dose && <span className="dose">{r.dose}</span>}<small>{r.times.join(', ')}{r.instructions ? `, ${r.instructions}` : ''}</small><small>Since {when(r.prescribed)}</small></div>
                {stopping === r.id ? (
                  <div className="rx-stop">
                    <div className="field"><input aria-label="Reason for stopping" value={reason} maxLength={200} onChange={e => setReason(e.target.value)} placeholder="Reason (the patient sees this)" /></div>
                    <button className="btn ghost small" onClick={() => setStopping(null)}>Back</button><button className="btn primary small" disabled={busy} onClick={() => stop(r)}>Stop medicine</button>
                  </div>
                ) : <button className="btn ghost small" onClick={() => { setStopping(r.id); setReason(''); }}>Stop</button>}
              </li>
            ))}
          </ul>
          {past.length > 0 && <details className="method"><summary>{past.length} stopped</summary><ul className="rx-list past">{past.map(r => <li key={r.id}><div><b>{r.name}</b>{r.dose && <span className="dose">{r.dose}</span>}<small>Stopped {when(r.stopped)}{r.stop_reason ? `: ${r.stop_reason}` : ''}</small></div></li>)}</ul></details>}
        </>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ notes
function Notes({ id }: { id: number }) {
  const { data, err, run } = useList(useCallback(() => getNotes(id), [id]));
  const [text, setText] = useState('');
  const [shared, setShared] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (!text.trim()) return;
    setBusy(true); setMsg('');
    try { await addNote(id, text.trim(), shared); setText(''); setShared(false); run(); } catch (x) { setMsg((x as Error).message); } finally { setBusy(false); }
  };
  const remove = async (n: Note) => { try { await deleteNote(n.id); run(); } catch (x) { setMsg((x as Error).message); } };
  return (
    <section className="card">
      <div className="card-head"><h2><ScrollText size={18} />Clinical notes</h2></div>
      <form onSubmit={save}>
        <textarea rows={3} maxLength={4000} value={text} onChange={e => setText(e.target.value)} aria-label="New clinical note" placeholder="Write what you observed or decided." />
        <div className="row-end">
          <label className="check"><input type="checkbox" checked={shared} onChange={e => setShared(e.target.checked)} />Show this note to the patient</label>
          <button className="btn primary small" disabled={busy || !text.trim()}>Save note</button>
        </div>
      </form>
      {(msg || err) && <div className="alert-box" role="alert">{msg || err}</div>}
      {data && data.notes.length > 0 && (
        <ul className="notes">
          {data.notes.map(n => (
            <li key={n.id}>
              <p>{n.text}</p>
              <small>{when(n.at)} · {n.shared ? <span className="vis on"><Eye size={12} />Shared with patient</span> : <span className="vis"><EyeOff size={12} />Only you</span>}</small>
              <button className="icon-btn" aria-label="Delete note" onClick={() => remove(n)}><Trash2 size={15} /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ------------------------------------------------------------------ appointments for this patient
function Appointments({ id }: { id: number }) {
  const [rows, setRows] = useState<Appointment[]>([]);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ when: localInput(new Date(Date.now() + 86400000)), mins: 30, mode: 'in_person', reason: '' });
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { getAppointments('upcoming').then(r => setRows(r.appointments.filter(a => a.patient_id === id))).catch(() => {}); }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => realtime.on('appointment.update', load), [load]);
  const book = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg('');
    try { await bookAppointment(id, { starts_at: new Date(f.when).toISOString(), duration_min: f.mins, mode: f.mode, reason: f.reason }); setOpen(false); setF({ ...f, reason: '' }); load(); }
    catch (x) { setMsg((x as Error).message); } finally { setBusy(false); }
  };
  return (
    <section className="card">
      <div className="card-head"><h2><Calendar size={18} />Appointments</h2><button className="btn primary small" onClick={() => setOpen(o => !o)}><Plus size={15} />Book</button></div>
      <AnimatePresence>
        {open && (
          <motion.form onSubmit={book} className="rx-form" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <label htmlFor="apw">Date and time</label>
            <div className="field"><input id="apw" type="datetime-local" required value={f.when} min={localInput(new Date())} onChange={e => setF({ ...f, when: e.target.value })} /></div>
            <div className="two">
              <div><label htmlFor="apl">Length</label><div className="field"><select id="apl" value={f.mins} onChange={e => setF({ ...f, mins: Number(e.target.value) })}>{[15, 20, 30, 45, 60].map(m => <option key={m} value={m}>{m} minutes</option>)}</select></div></div>
              <div><label htmlFor="apm">How</label><div className="field"><select id="apm" value={f.mode} onChange={e => setF({ ...f, mode: e.target.value })}><option value="in_person">In person</option><option value="video">Video</option><option value="phone">Phone</option></select></div></div>
            </div>
            <label htmlFor="apr">Reason (optional)</label>
            <div className="field"><input id="apr" maxLength={300} value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} /></div>
            <div className="row-end"><small>{fmt(new Date(f.when).toISOString())}</small><button className="btn primary" disabled={busy}>{busy ? 'Booking' : 'Book appointment'}</button></div>
          </motion.form>
        )}
      </AnimatePresence>
      {msg && <div className="alert-box" role="alert">{msg}</div>}
      {rows.length === 0 ? <p className="muted">Nothing booked or requested.</p> : <ul className="appts">{rows.map(a => <Row key={a.id} a={a} onChange={load} actions showPatient={false} />)}</ul>}
    </section>
  );
}
