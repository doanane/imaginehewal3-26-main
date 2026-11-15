import React, { lazy, Suspense, useState } from 'react';
import { ThemeToggle } from './theme';
import { motion } from 'framer-motion';
import { Activity, AlertCircle, Eye, EyeOff, Lock, ShieldCheck, Stethoscope, UserRound } from 'lucide-react';
import { guestLogin, login, saveSession, Session } from './api';
import Logo from './Logo';

const Scene3D = lazy(() => import('./Scene3D'));

const POINTS = [
  { icon: Activity, title: 'Live from the patient app', text: 'Readings reach this page within seconds of the phone or watch recording them.' },
  { icon: ShieldCheck, title: 'Only your own patients', text: 'A patient appears here only after choosing you as their doctor, and can remove you at any time.' },
  { icon: Stethoscope, title: 'Statistics you can check', text: 'Trends, ranges and adherence are calculated from stored readings, with the method shown.' },
];

export default function Login({ notice, onSignedIn }: { notice: string; onSignedIn: (s: Session) => void }) {
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [show, setShow] = useState(false);
  const [err, setErr] = useState(notice);
  const [busy, setBusy] = useState(false);

  const guest = async () => {
    setBusy(true); setErr('');
    try { const r = await guestLogin(); const s = { token: r.access_token, doctor: r.doctor }; saveSession(s); onSignedIn(s); }
    catch (x) { setErr((x as Error).message); setBusy(false); }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setErr('');
    try {
      const r = await login(id.trim(), pw);
      const s = { token: r.access_token, doctor: r.doctor };
      saveSession(s); onSignedIn(s);
    } catch (x) { setErr((x as Error).message); setPw(''); setBusy(false); }
  };

  return (
    <div className="login">
      <div className="login-theme"><ThemeToggle /></div>
      <section className="login-hero">
        <Suspense fallback={null}><Scene3D /></Suspense>
        <div className="hero-copy">
          <div className="brand-row"><Logo width={200} /></div>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
            Your patients, measured and in one place.
          </motion.h1>
          <ul>
            {POINTS.map((p, i) => (
              <motion.li key={p.title} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.25 + i * 0.12, duration: 0.6 }}>
                <span className="pt-ic"><p.icon size={18} /></span>
                <div><b>{p.title}</b><p>{p.text}</p></div>
              </motion.li>
            ))}
          </ul>
        </div>
      </section>

      <section className="login-form-side">
        <motion.div className="login-card" initial={{ opacity: 0, y: 24, rotateX: 8 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}>
          <h2>Clinician sign in</h2>
          <p className="sub">Use the doctor ID and password issued to you.</p>
          {err && <div className="alert-box" role="alert"><AlertCircle size={18} /><span>{err}</span></div>}
          <form onSubmit={submit}>
            <label htmlFor="did">Doctor ID</label>
            <div className="field"><UserRound size={18} /><input id="did" value={id} onChange={e => setId(e.target.value)} autoComplete="username" autoCapitalize="characters" placeholder="DOC00001" required autoFocus /></div>
            <label htmlFor="dpw">Password</label>
            <div className="field"><Lock size={18} />
              <input id="dpw" type={show ? 'text' : 'password'} value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" required />
              <button type="button" className="icon-btn" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
            </div>
            <motion.button className="btn primary wide" type="submit" disabled={busy} whileTap={{ scale: 0.98 }}>{busy ? 'Signing in' : 'Sign in'}</motion.button>
          </form>
          <button type="button" className="btn ghost wide" onClick={guest} disabled={busy}><Eye size={16} />Continue as Reviewer / Guest</button>
          <p className="fine">The demo uses sample data only. Patient information on this site is confidential.</p>
        </motion.div>
      </section>
    </div>
  );
}
