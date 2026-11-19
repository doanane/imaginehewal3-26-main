import React, { useState } from 'react';
import { Download, KeyRound } from 'lucide-react';
import { redeemShare } from './api';

type Res = { resourceType: string; id?: string; [k: string]: any };
type Bundle = { entry: { resource: Res }[]; timestamp?: string };

const of = (b: Bundle, t: string) => b.entry.map(e => e.resource).filter(r => r.resourceType === t);
const day = (s?: string) => (s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** Open a record another clinic shared with you. The patient gave you a code; it works for a limited time, they see that you used it, and they can cancel it. */
export default function SharedRecord() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [b, setB] = useState<Bundle | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const go = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(''); setB(null);
    try { setB(await redeemShare(code.trim()) as Bundle); setCode(''); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  const save = () => {
    if (!b) return;
    const url = URL.createObjectURL(new Blob([JSON.stringify(b, null, 2)], { type: 'application/fhir+json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'shared-record-fhir.json'; a.click(); URL.revokeObjectURL(url);
  };
  const name = b ? of(b, 'Patient')[0]?.name?.[0]?.text : '';

  return (
    <section className="card">
      <div className="card-head"><h2><KeyRound size={18} />Open a shared record</h2><button className="btn ghost small" onClick={() => setOpen(o => !o)} aria-expanded={open}>{open ? 'Close' : 'Enter a code'}</button></div>
      {!open ? <p className="muted small">A patient from another clinic can give you a code. It shows you the record they chose to share.</p> : (
        <>
          <form onSubmit={go} className="rx-form">
            <label htmlFor="xc">Code from the patient</label>
            <div className="field"><input id="xc" required minLength={6} maxLength={20} autoComplete="off" value={code} onChange={e => setCode(e.target.value)} placeholder="10 characters" /></div>
            <div className="row-end"><small role={err ? 'alert' : undefined}>{err || 'The patient sees that you opened it.'}</small><button className="btn primary" disabled={busy}>{busy ? 'Opening' : 'Open record'}</button></div>
          </form>
          {b && (
            <div className="shared-out">
              <div className="card-head"><h3>{name || 'Shared record'}</h3><button className="btn ghost small" onClick={save}><Download size={15} />Download (FHIR)</button></div>
              <ul className="plain">
                {of(b, 'AllergyIntolerance').map(r => <li key={r.id}><div><b>Allergy: {r.code?.text}</b><small>{[r.reaction?.[0]?.description, r.criticality === 'high' ? 'severe' : ''].filter(Boolean).join(', ')}</small></div></li>)}
                {of(b, 'Observation').map(r => <li key={r.id}><div><b>{r.code?.text}: {r.valueString}{r.interpretation ? `, ${r.interpretation[0].text}` : ''}</b><small>{[r.referenceRange?.[0]?.text && `Normal ${r.referenceRange[0].text}`, day(r.effectiveDateTime)].filter(Boolean).join(', ')}</small></div></li>)}
                {of(b, 'DiagnosticReport').map(r => <li key={r.id}><div><b>{r.code?.text}</b><small>{[r.conclusion, day(r.effectiveDateTime)].filter(Boolean).join(', ')}</small>{r.presentedForm?.[0]?.url && <small><a href={r.presentedForm[0].url} target="_blank" rel="noopener noreferrer">Open the image</a></small>}</div></li>)}
                {of(b, 'Immunization').map(r => <li key={r.id}><div><b>Vaccine: {r.vaccineCode?.text}</b><small>{day(r.occurrenceDateTime)}</small></div></li>)}
                {of(b, 'Encounter').map(r => <li key={r.id}><div><b>Visit ({r.class?.code})</b><small>{[day(r.period?.start), r.period?.end && `to ${day(r.period.end)}`].filter(Boolean).join(' ')}</small></div></li>)}
              </ul>
              {b.entry.length <= 1 && <p className="muted">This record is empty.</p>}
            </div>
          )}
        </>
      )}
    </section>
  );
}
