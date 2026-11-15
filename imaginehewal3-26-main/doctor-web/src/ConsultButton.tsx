import React, { useState } from 'react';
import { FileText, Stethoscope } from 'lucide-react';
import { startConsultation } from './api';

/** Opens the consultation for a visit: creates it the first time, and goes straight to the existing one afterwards. */
export default function ConsultButton({ patientId, appointmentId, existing, small, primary = true, label }: {
  patientId: number; appointmentId?: number; existing?: { id: number; status: 'draft' | 'signed' } | null; small?: boolean; primary?: boolean; label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const go = async () => {
    if (existing) { window.location.hash = `#/consult/${existing.id}`; return; }
    setBusy(true); setErr('');
    try { const c = await startConsultation(patientId, appointmentId); window.location.hash = `#/consult/${c.id}`; }
    catch (e) { setErr((e as Error).message); setBusy(false); }
  };
  const signed = existing?.status === 'signed';
  return (
    <>
      <button type="button" className={`btn ${primary && !signed ? 'primary' : 'ghost'} ${small ? 'small' : ''}`} onClick={go} disabled={busy}>
        {signed ? <FileText size={15} /> : <Stethoscope size={15} />}
        {label || (signed ? 'View note' : existing ? 'Continue' : busy ? 'Opening' : 'Consult')}
      </button>
      {err && <small className="err" role="alert">{err}</small>}
    </>
  );
}
