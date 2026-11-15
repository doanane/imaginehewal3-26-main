import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { BadgeCheck, Building2, CalendarClock, KeyRound, Mail, Save, Stethoscope, Users } from 'lucide-react';
import { changePassword, getAvailability, getMe, Hours, Profile, setAvailability, updateMe } from './api';
import { Skeleton } from './ui';
import { initials } from './util';

type Note = { ok: boolean; text: string } | null;

export default function ProfilePage({ onSaved }: { onSaved: (p: Profile) => void }) {
  const [p, setP] = useState<Profile | null>(null);
  const [err, setErr] = useState('');
  const [f, setF] = useState({ full_name: '', specialization: '', hospital: '', email: '' });
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);
  const [pw, setPw] = useState({ cur: '', next: '', again: '' });
  const [pwNote, setPwNote] = useState<Note>(null);
  const [pwBusy, setPwBusy] = useState(false);

  useEffect(() => {
    getMe().then(m => { setP(m); setF({ full_name: m.full_name || '', specialization: m.specialization || '', hospital: m.hospital || '', email: m.email || '' }); }).catch(e => setErr((e as Error).message));
  }, []);

  if (!p) return err ? <div className="alert-box" role="alert">{err}</div> : <div className="card"><Skeleton h={260} /></div>;

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setNote(null);
    try { const m = await updateMe(f); setP(m); onSaved(m); setNote({ ok: true, text: 'Saved. Patients see the new details straight away.' }); }
    catch (x) { setNote({ ok: false, text: (x as Error).message }); } finally { setBusy(false); }
  };
  const savePw = async (e: React.FormEvent) => {
    e.preventDefault(); setPwNote(null);
    if (pw.next !== pw.again) { setPwNote({ ok: false, text: 'The two new passwords do not match.' }); return; }
    setPwBusy(true);
    try { await changePassword(pw.cur, pw.next); setPw({ cur: '', next: '', again: '' }); setPwNote({ ok: true, text: 'Password changed. Use it next time you sign in.' }); }
    catch (x) { setPwNote({ ok: false, text: (x as Error).message }); } finally { setPwBusy(false); }
  };
  const since = p.member_since ? new Date(p.member_since).toLocaleDateString([], { month: 'long', year: 'numeric' }) : null;

  return (
    <>
      <header className="page-head"><div><h1>My profile</h1><p>How patients see you, and how you sign in.</p></div></header>
      <motion.section className="card profile-hero" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <span className="avatar xl">{initials(p.full_name)}</span>
        <div className="profile-hero-id">
          <h2>{p.full_name}</h2>
          <p>{[p.specialization, p.hospital].filter(Boolean).join(', ') || 'No specialty added yet'}</p>
          <div className="chips-static">
            <span className="tagchip"><BadgeCheck size={14} />ID {p.doctor_id}</span>
            <span className="tagchip"><Users size={14} />{p.patients} patient{p.patients === 1 ? '' : 's'}</span>
            {since && <span className="tagchip">Member since {since}</span>}
          </div>
        </div>
      </motion.section>

      <div className="grid-2">
        <section className="card">
          <div className="card-head"><h2><Stethoscope size={18} />Details</h2></div>
          <form onSubmit={save}>
            <label htmlFor="pn">Full name</label>
            <div className="field"><input id="pn" value={f.full_name} maxLength={100} onChange={e => setF({ ...f, full_name: e.target.value })} required /></div>
            <label htmlFor="ps">Specialty</label>
            <div className="field"><Stethoscope size={18} /><input id="ps" value={f.specialization} maxLength={100} onChange={e => setF({ ...f, specialization: e.target.value })} placeholder="For example Cardiology" /></div>
            <label htmlFor="ph">Hospital or clinic</label>
            <div className="field"><Building2 size={18} /><input id="ph" value={f.hospital} maxLength={120} onChange={e => setF({ ...f, hospital: e.target.value })} /></div>
            <label htmlFor="pe">Email</label>
            <div className="field"><Mail size={18} /><input id="pe" type="email" value={f.email} maxLength={254} onChange={e => setF({ ...f, email: e.target.value })} /></div>
            <div className="row-end"><small>Doctor ID cannot be changed.</small><button className="btn primary" disabled={busy}><Save size={16} />{busy ? 'Saving' : 'Save changes'}</button></div>
            {note && <div className={`alert-box ${note.ok ? 'ok' : ''}`} role="status">{note.text}</div>}
          </form>
        </section>

        <HoursCard />
        <section className="card">
          <div className="card-head"><h2><KeyRound size={18} />Password</h2></div>
          <form onSubmit={savePw}>
            <label htmlFor="pc">Current password</label>
            <div className="field"><input id="pc" type="password" autoComplete="current-password" value={pw.cur} onChange={e => setPw({ ...pw, cur: e.target.value })} required /></div>
            <label htmlFor="pnw">New password</label>
            <div className="field"><input id="pnw" type="password" autoComplete="new-password" minLength={8} value={pw.next} onChange={e => setPw({ ...pw, next: e.target.value })} required /></div>
            <label htmlFor="pa">Repeat new password</label>
            <div className="field"><input id="pa" type="password" autoComplete="new-password" minLength={8} value={pw.again} onChange={e => setPw({ ...pw, again: e.target.value })} required /></div>
            <div className="row-end"><small>At least 8 characters with a letter and a number.</small><button className="btn primary" disabled={pwBusy}>{pwBusy ? 'Changing' : 'Change password'}</button></div>
            {pwNote && <div className={`alert-box ${pwNote.ok ? 'ok' : ''}`} role="status">{pwNote.text}</div>}
          </form>
        </section>
      </div>
    </>
  );
}

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
function HoursCard() {
  const [h, setH] = useState<Hours | null>(null);
  const [note, setNote] = useState<Note>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { getAvailability().then(setH).catch(e => setNote({ ok: false, text: (e as Error).message })); }, []);
  if (!h) return <section className="card"><Skeleton h={160} /></section>;
  const toggle = (d: number) => setH({ ...h, days: h.days.includes(d) ? h.days.filter(x => x !== d) : [...h.days, d].sort() });
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setNote(null);
    try { setH(await setAvailability(h)); setNote({ ok: true, text: 'Saved. Your schedule shades everything outside these hours.' }); }
    catch (x) { setNote({ ok: false, text: (x as Error).message }); } finally { setBusy(false); }
  };
  return (
    <section className="card">
      <div className="card-head"><h2><CalendarClock size={18} />Working hours</h2></div>
      <form onSubmit={save}>
        <div className="chips" role="group" aria-label="Working days">{DAYS.map((n, i) => <button key={n} type="button" className="chip-btn" aria-pressed={h.days.includes(i)} onClick={() => toggle(i)}>{n}</button>)}</div>
        <div className="two">
          <div><label htmlFor="hs">From</label><div className="field"><input id="hs" type="time" value={h.start} onChange={e => setH({ ...h, start: e.target.value })} required /></div></div>
          <div><label htmlFor="he">To</label><div className="field"><input id="he" type="time" value={h.end} onChange={e => setH({ ...h, end: e.target.value })} required /></div></div>
        </div>
        <label htmlFor="hl">Appointment length</label>
        <div className="field"><select id="hl" value={h.slot_min} onChange={e => setH({ ...h, slot_min: Number(e.target.value) })}>{[15, 20, 30, 45, 60].map(n => <option key={n} value={n}>{n} minutes</option>)}</select></div>
        <div className="row-end"><small>Used for the schedule grid.</small><button className="btn primary" disabled={busy || h.days.length === 0}>{busy ? 'Saving' : 'Save hours'}</button></div>
        {note && <div className={`alert-box ${note.ok ? 'ok' : ''}`} role="status">{note.text}</div>}
      </form>
    </section>
  );
}
