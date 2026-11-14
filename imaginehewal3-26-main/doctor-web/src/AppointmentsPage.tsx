import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Building2, Calendar, Check, Phone, Video, X } from 'lucide-react';
import { Appointment, getAppointments, patchAppointment } from './api';
import { realtime } from './realtime';
import { Empty, Segmented, Skeleton } from './ui';

export const MODE: Record<string, { label: string; icon: React.ElementType }> = {
  in_person: { label: 'In person', icon: Building2 }, video: { label: 'Video', icon: Video }, phone: { label: 'Phone', icon: Phone },
};
export const fmt = (iso: string) => new Date(iso).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
/** value for <input type="datetime-local"> in the viewer's own time zone */
export const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

export default function AppointmentsPage() {
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming');
  const [rows, setRows] = useState<Appointment[] | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => { getAppointments(scope).then(r => { setRows(r.appointments); setErr(''); }).catch(e => setErr((e as Error).message)); }, [scope]);
  useEffect(() => { setRows(null); load(); }, [load]);
  useEffect(() => realtime.on('appointment.update', load), [load]);

  const requests = (rows || []).filter(a => a.status === 'requested');
  const rest = (rows || []).filter(a => a.status !== 'requested' || scope === 'past');

  return (
    <>
      <header className="page-head">
        <div><h1>Appointments</h1><p>Requests from your patients and everything you have booked.</p></div>
        <Segmented label="appointment-scope" value={scope} onChange={setScope} options={[{ v: 'upcoming', label: 'Upcoming' }, { v: 'past', label: 'Past' }]} />
      </header>
      {err && <div className="alert-box" role="alert">{err}</div>}
      {!rows ? <div className="card"><Skeleton h={160} /></div> : (
        <>
          {scope === 'upcoming' && requests.length > 0 && (
            <section className="card">
              <div className="card-head"><h2><Calendar size={18} />Waiting for your answer</h2><small>{requests.length}</small></div>
              <ul className="appts">{requests.map(a => <Row key={a.id} a={a} onChange={load} actions />)}</ul>
            </section>
          )}
          <section className="card">
            <div className="card-head"><h2><Calendar size={18} />{scope === 'upcoming' ? 'Confirmed' : 'Earlier'}</h2></div>
            {rest.length === 0 ? <Empty icon={<Calendar size={26} />} title={scope === 'upcoming' ? 'Nothing booked' : 'No past appointments'}>{scope === 'upcoming' ? 'When a patient asks for a time it appears above. You can also book one from a patient’s Care plan tab.' : undefined}</Empty>
              : <ul className="appts">{rest.map(a => <Row key={a.id} a={a} onChange={load} />)}</ul>}
          </section>
        </>
      )}
    </>
  );
}

export function Row({ a, onChange, actions, showPatient = true }: { a: Appointment; onChange: () => void; actions?: boolean; showPatient?: boolean }) {
  const [busy, setBusy] = useState(false);
  const [declining, setDeclining] = useState(false);
  const [why, setWhy] = useState('');
  const [err, setErr] = useState('');
  const M = MODE[a.mode] || MODE.in_person;
  const act = async (b: Parameters<typeof patchAppointment>[1]) => {
    setBusy(true); setErr('');
    try { await patchAppointment(a.id, b); setDeclining(false); onChange(); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  const canCancel = a.status === 'confirmed' && new Date(a.starts_at) > new Date();
  const canComplete = a.status === 'confirmed' && new Date(a.starts_at) <= new Date();
  return (
    <motion.li layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`appt ${a.status}`}>
      <div className="appt-when"><b>{fmt(a.starts_at)}</b><small>{a.duration_min} min</small></div>
      <div className="appt-main">
        <b>{showPatient && a.patient ? <a href={`#/patient/${a.patient_id}`}>{a.patient}</a> : (a.reason || 'Appointment')}</b>
        <small><M.icon size={13} /> {M.label}{showPatient && a.reason ? `, ${a.reason}` : ''}</small>
        {a.doctor_message && <small>You wrote: {a.doctor_message}</small>}
        {err && <small className="err">{err}</small>}
      </div>
      <span className={`status-pill ${a.status}`}>{a.status}</span>
      <div className="appt-actions">
        {actions && a.status === 'requested' && !declining && <>
          <button className="btn primary small" disabled={busy} onClick={() => act({ status: 'confirmed' })}><Check size={15} />Confirm</button>
          <button className="btn ghost small" disabled={busy} onClick={() => setDeclining(true)}><X size={15} />Decline</button>
        </>}
        {canCancel && <button className="btn ghost small" disabled={busy} onClick={() => act({ status: 'cancelled' })}>Cancel</button>}
        {canComplete && <button className="btn ghost small" disabled={busy} onClick={() => act({ status: 'completed' })}>Mark done</button>}
      </div>
      <AnimatePresence>
        {declining && (
          <motion.div className="appt-decline" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
            <label htmlFor={`why${a.id}`}>Tell the patient why (they see this)</label>
            <div className="field"><input id={`why${a.id}`} value={why} maxLength={300} onChange={e => setWhy(e.target.value)} placeholder="For example: please pick a morning slot" /></div>
            <div className="row-end"><button className="btn ghost small" onClick={() => setDeclining(false)}>Back</button><button className="btn primary small" disabled={busy} onClick={() => act({ status: 'declined', doctor_message: why })}>Decline request</button></div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
