import React, { useEffect, useState } from 'react';
import { createDocument, Consultation, DocKind } from './api';
import { X } from 'lucide-react';

export const KIND_LABEL: Record<DocKind, string> = { referral: 'Referral letter', sick_note: 'Sick note', letter: 'Letter' };
const iso = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);

/** A small form for the three documents a doctor writes most: a referral, a sick note and a general letter. Filled from the consultation when there is one. */
export default function DocComposer({ patientId, patientName, kind, consultation, onClose, onCreated }: {
  patientId: number; patientName: string; kind: DocKind; consultation?: Consultation | null; onClose: () => void; onCreated: (id: number) => void;
}) {
  const dx = consultation?.diagnoses?.map(d => d.label).join('; ') || '';
  const [f, setF] = useState<Record<string, string | boolean>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  useEffect(() => {
    const today = new Date();
    if (kind === 'referral') setF({ to: '', specialty: '', urgency: 'routine', reason: [dx, consultation?.assessment].filter(Boolean).join('. '), history: consultation?.subjective || '', medicines: '' });
    else if (kind === 'sick_note') setF({ from_date: iso(today), to_date: iso(new Date(today.getTime() + 2 * 864e5)), show_diagnosis: false, diagnosis: dx, note: '' });
    else setF({ to: '', text: '' });
  }, [kind]);   // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: string, v: string | boolean) => setF(x => ({ ...x, [k]: v }));
  const Field = ({ k, label, area, type = 'text', ph }: { k: string; label: string; area?: boolean; type?: string; ph?: string }) => (
    <><label htmlFor={`dc-${k}`}>{label}</label>{area
      ? <textarea id={`dc-${k}`} rows={3} value={String(f[k] ?? '')} onChange={e => set(k, e.target.value)} placeholder={ph} />
      : <div className="field"><input id={`dc-${k}`} type={type} value={String(f[k] ?? '')} onChange={e => set(k, e.target.value)} placeholder={ph} /></div>}</>
  );
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const d = await createDocument(patientId, { kind, consultation_id: consultation?.id ?? null, body: f }); onCreated(d.id); }
    catch (x) { setErr((x as Error).message); setBusy(false); }
  };
  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label={KIND_LABEL[kind]}>
      <form className="modal-card" onSubmit={submit}>
        <div className="card-head"><h2>{KIND_LABEL[kind]} for {patientName}</h2><button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} /></button></div>
        {kind === 'referral' && <>
          <Field k="to" label="Refer to (name, department, hospital)" ph="For example Dr Mensah, Cardiology, Korle Bu" />
          <Field k="specialty" label="Specialty (optional)" />
          <label htmlFor="dc-urg">How urgent</label>
          <div className="field"><select id="dc-urg" value={String(f.urgency || 'routine')} onChange={e => set('urgency', e.target.value)}><option value="routine">Routine</option><option value="urgent">Urgent</option><option value="emergency">Emergency</option></select></div>
          <Field k="reason" label="Reason for referral" area />
          <Field k="history" label="Relevant history (optional)" area />
          <Field k="medicines" label="Current medicines (optional)" area />
        </>}
        {kind === 'sick_note' && <>
          <div className="two"><div><Field k="from_date" label="First day of rest" type="date" /></div><div><Field k="to_date" label="Last day of rest" type="date" /></div></div>
          <label className="check"><input type="checkbox" checked={!!f.show_diagnosis} onChange={e => set('show_diagnosis', e.target.checked)} />Show the diagnosis on the note (leave off to protect the patient's privacy)</label>
          {f.show_diagnosis ? <Field k="diagnosis" label="Diagnosis shown" /> : null}
          <Field k="note" label="Note (optional)" area ph="For example: light duties on return" />
        </>}
        {kind === 'letter' && <><Field k="to" label="To (optional)" ph="To whom it may concern" /><Field k="text" label="Letter" area /></>}
        {err && <div className="alert-box" role="alert">{err}</div>}
        <p className="muted small">It is saved with a reference number. Anyone holding the printed copy can check it is genuine, and you can withdraw it later.</p>
        <div className="row-end"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Saving' : 'Create and open to print'}</button></div>
      </form>
    </div>
  );
}
