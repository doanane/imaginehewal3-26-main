import React, { useEffect, useState } from 'react';
import { Activity, CheckCircle2, ShieldAlert, XCircle } from 'lucide-react';
import { DocCheck, verifyDocument } from './api';
import { ThemeToggle } from './theme';
import Logo from './Logo';

/** Public page (no sign in): anyone holding a printed document can check its reference. It never shows the patient or the contents. */
export default function VerifyPage({ initial }: { initial: string }) {
  const [ref, setRef] = useState(initial);
  const [r, setR] = useState<DocCheck | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const check = async (v: string) => {
    if (v.trim().length < 6) return;
    setBusy(true); setErr(''); setR(null);
    try { setR(await verifyDocument(v)); } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  useEffect(() => { if (initial) check(initial); }, [initial]);   // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="verify">
      <div className="login-theme"><ThemeToggle /></div>
      <div className="verify-card">
        <div className="brand-row"><Logo width={180} /></div>
        <h1>Check a document</h1>
        <p className="muted">Enter the reference printed at the bottom of a referral, sick note or letter issued from HEWAL3.</p>
        <form onSubmit={e => { e.preventDefault(); check(ref); }}>
          <label htmlFor="vr">Reference</label>
          <div className="field"><input id="vr" value={ref} onChange={e => setRef(e.target.value.toUpperCase())} placeholder="HW-26-ABC123" autoCapitalize="characters" required /></div>
          <button className="btn primary" disabled={busy}>{busy ? 'Checking' : 'Check'}</button>
        </form>
        {err && <div className="alert-box" role="alert">{err}</div>}
        {r && (r.valid
          ? <div className="verify-res ok" role="status"><CheckCircle2 size={22} /><div><b>Genuine</b><p>{r.kind}, issued on {r.issued_on} by {r.doctor}{r.specialization ? `, ${r.specialization}` : ''}{r.hospital ? `, ${r.hospital}` : ''}.</p><small>This page does not show who the document was for or what it says. Compare the printed copy with the issuer if you doubt it.</small></div></div>
          : r.revoked
            ? <div className="verify-res bad" role="status"><ShieldAlert size={22} /><div><b>Withdrawn</b><p>The doctor has withdrawn this document. It is no longer valid.</p></div></div>
            : <div className="verify-res bad" role="status"><XCircle size={22} /><div><b>Not found</b><p>No document has this reference. Check the characters, or treat the document as not genuine.</p></div></div>)}
        <a className="back" href="#/">Doctor sign in</a>
      </div>
    </div>
  );
}
