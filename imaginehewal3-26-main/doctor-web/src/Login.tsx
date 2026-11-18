import React, { useState } from 'react';
import { ThemeToggle } from './theme';
import { AlertCircle, Eye, EyeOff, Lock, UserRound } from 'lucide-react';
import { guestLogin, login, saveSession, Session } from './api';
import Logo from './Logo';

const POINTS = [
  { title: 'Live from the patient app', text: 'Readings reach this page within seconds of the phone or watch recording them.' },
  { title: 'Only your own patients', text: 'A patient appears here only after choosing you as their doctor, and can remove you at any time.' },
  { title: 'Statistics you can check', text: 'Trends, ranges and adherence are calculated from stored readings, with the method shown.' },
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
        <div className="hero-copy">
          <div className="brand-row"><Logo width={180} /></div>
          <h1>Your patients, measured and in one place.</h1>
          <dl className="hero-points">
            {POINTS.map(p => (<div key={p.title}><dt>{p.title}</dt><dd>{p.text}</dd></div>))}
          </dl>
        </div>
      </section>

      <section className="login-form-side">
        <div className="login-card">
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
            <button className="btn primary wide" type="submit" disabled={busy}>{busy ? 'Signing in' : 'Sign in'}</button>
          </form>
          <button type="button" className="btn ghost wide" onClick={guest} disabled={busy}><Eye size={16} />Continue as Reviewer / Guest</button>
          <p className="fine">The demo uses sample data only. Patient information on this site is confidential.</p>
        </div>
      </section>
    </div>
  );
}
