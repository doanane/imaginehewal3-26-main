import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Clock, Search, Send, UserPlus, X } from 'lucide-react';
import { findPatient, getLinkRequests, sendLinkRequest, withdrawLinkRequest } from './api';
import { when } from './util';

type Found = { found: boolean; message?: string; state?: 'available' | 'pending' | 'yours'; patient?: { user_id: number; name: string; patient_id: string | null } };
type Req = { id: number; patient: string; patient_id: string | null; status: string; message: string | null; sent_at: string | null; answered_at: string | null };
const STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Waiting for the patient', cls: 'warn' }, accepted: { label: 'Accepted', cls: 'good' }, declined: { label: 'Declined', cls: 'bad' },
  cancelled: { label: 'Withdrawn', cls: '' }, expired: { label: 'Expired', cls: '' },
};

/** Ask a patient to let you follow their health. The patient decides in their app; nothing is shared until they accept. */
export default function AddPatient() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [res, setRes] = useState<Found | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [done, setDone] = useState('');
  const [reqs, setReqs] = useState<Req[]>([]);
  const load = useCallback(() => { getLinkRequests().then(r => setReqs(r.requests)).catch(() => {}); }, []);
  useEffect(() => { if (open) load(); }, [open, load]);

  const find = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setDone(''); setRes(null);
    if (q.trim().length < 4) { setErr('Enter the full patient ID or the email the patient signed up with.'); return; }
    setBusy(true);
    try { setRes(await findPatient(q.trim())); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  const send = async () => {
    if (!res?.patient) return;
    setBusy(true); setErr('');
    try {
      await sendLinkRequest(res.patient.user_id, note.trim());
      setDone(`Request sent to ${res.patient.name}. They will see it in the app under Profile, My doctor.`); setRes(null); setQ(''); setNote(''); load();
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  const withdraw = async (id: number) => { try { await withdrawLinkRequest(id); load(); } catch (x) { setErr((x as Error).message); } };

  return (
    <section className="card addp">
      <div className="card-head">
        <h2><UserPlus size={18} />Add a patient</h2>
        <button type="button" className="btn ghost small" aria-expanded={open} onClick={() => setOpen(o => !o)}>{open ? 'Close' : 'Ask a patient to link with you'}</button>
      </div>
      {!open ? <p className="muted small">Patients can also pick you in the app with your ID. Or you can send a request here, and the patient accepts on their phone.</p> : (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <form onSubmit={find} className="addp-form">
            <label className="search"><Search size={18} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Patient ID or email, exactly as the patient has it" aria-label="Patient ID or email" /></label>
            <button className="btn primary small" disabled={busy}>Find</button>
          </form>
          <p className="muted small">You find a patient only by their exact ID or email, and you see a name and nothing else. Health information is shared only after the patient accepts.</p>
          {err && <div className="alert-box" role="alert">{err}</div>}
          {done && <div className="alert-box ok" role="status"><Check size={16} />{done}</div>}
          {res && !res.found && <div className="alert-box soft" role="status">{res.message}</div>}
          {res?.found && res.patient && (
            <div className="addp-card">
              <div><b>{res.patient.name}</b><small className="muted">ID {res.patient.patient_id}</small></div>
              {res.state === 'yours' ? <span className="pill good">Already your patient</span> : res.state === 'pending' ? <span className="pill warn">Request already sent</span> : (
                <>
                  <div className="field"><label htmlFor="lnote">A short note for the patient (optional)</label><input id="lnote" value={note} maxLength={200} onChange={e => setNote(e.target.value)} placeholder="For example: we met at the clinic on Monday" /></div>
                  <button type="button" className="btn primary small" onClick={send} disabled={busy}><Send size={15} />Send request</button>
                </>
              )}
            </div>
          )}
          {reqs.length > 0 && (
            <table className="tbl addp-tbl"><thead><tr><th>Patient</th><th>Status</th><th>Sent</th><th /></tr></thead><tbody>
              {reqs.map(r => { const s = STATUS[r.status] || { label: r.status, cls: '' }; return (
                <tr key={r.id}><td>{r.patient}{r.patient_id && <small className="muted"> {r.patient_id}</small>}</td><td><span className={`pill ${s.cls}`}>{r.status === 'pending' && <Clock size={12} />} {s.label}</span></td><td className="muted">{when(r.sent_at)}</td>
                  <td>{r.status === 'pending' && <button type="button" className="btn ghost small" onClick={() => withdraw(r.id)}><X size={14} />Withdraw</button>}</td></tr>); })}
            </tbody></table>
          )}
        </motion.div>
      )}
    </section>
  );
}
