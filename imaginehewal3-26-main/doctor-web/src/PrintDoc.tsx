import React, { useEffect, useState } from 'react';
import { ArrowLeft, Ban, Printer } from 'lucide-react';
import Logo from './Logo';
import { ClinicDoc, getDocument, getPatient, getPrescriptions, revokeDocument, Rx } from './api';
import type { Detail, DoctorInfo } from './types';
import { Skeleton } from './ui';

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' }) : '');
const dmy = (s: string) => new Date(`${s}T12:00:00`).toLocaleDateString([], { day: 'numeric', month: 'long', year: 'numeric' });

function Letterhead({ d }: { d: { name: string; specialization: string | null; hospital: string | null; doctor_id: string } }) {
  return (
    <header className="lh">
      <div className="lh-brand"><Logo width={150} /></div>
      <div className="lh-doc"><b>{d.name}</b><span>{[d.specialization, d.hospital].filter(Boolean).join(', ')}</span><span>Doctor ID {d.doctor_id}</span></div>
    </header>
  );
}

function Frame({ back, children, actions }: { back: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="print-page">
      <div className="print-bar no-print">
        <a className="back" href={back}><ArrowLeft size={16} />Back</a>
        <div className="row-btns">{actions}<button className="btn primary" onClick={() => window.print()}><Printer size={16} />Print or save as PDF</button></div>
      </div>
      <article className="sheet">{children}</article>
    </div>
  );
}

/** A referral, sick note or letter laid out as a sheet to print, with the reference and how to check it. */
export function PrintDoc({ id }: { id: number }) {
  const [d, setD] = useState<ClinicDoc | null>(null);
  const [err, setErr] = useState('');
  const load = () => getDocument(id).then(setD).catch(e => setErr((e as Error).message));
  useEffect(() => { load(); }, [id]);   // eslint-disable-line react-hooks/exhaustive-deps
  if (err) return <div className="alert-box" role="alert">{err}</div>;
  if (!d) return <div className="card"><Skeleton h={300} /></div>;
  const b = d.body;
  const who = `${d.patient || 'Patient'}${d.patient_info?.age ? `, ${d.patient_info.age} years` : ''}${d.patient_info?.gender ? `, ${d.patient_info.gender}` : ''}`;
  const withdraw = async () => { if (window.confirm('Withdraw this document? Anyone checking its reference will be told it is no longer valid.')) { await revokeDocument(id).catch(() => {}); load(); } };
  return (
    <Frame back={`#/patient/${d.patient_id}`} actions={!d.revoked && <button className="btn ghost" onClick={withdraw}><Ban size={16} />Withdraw</button>}>
      {d.doctor && <Letterhead d={d.doctor} />}
      {d.revoked && <p className="void">WITHDRAWN. This document is no longer valid.</p>}
      <h1>{d.title}</h1>
      <p className="dateline">{day(d.issued_at)}</p>
      <dl className="sheet-dl"><dt>Patient</dt><dd>{who}</dd></dl>

      {d.kind === 'referral' && <>
        <dl className="sheet-dl"><dt>To</dt><dd>{b.to || 'The receiving clinician'}{b.specialty ? `, ${b.specialty}` : ''}</dd><dt>Urgency</dt><dd style={{ textTransform: 'capitalize' }}>{b.urgency || 'routine'}</dd></dl>
        <h3>Reason for referral</h3><p className="pre">{b.reason}</p>
        {b.history && <><h3>Relevant history</h3><p className="pre">{b.history}</p></>}
        {b.medicines && <><h3>Current medicines</h3><p className="pre">{b.medicines}</p></>}
      </>}
      {d.kind === 'sick_note' && <>
        <p>This is to certify that <b>{d.patient}</b> was seen and is unfit for work or school from <b>{dmy(b.from_date)}</b> to <b>{dmy(b.to_date)}</b> ({b.days} day{b.days === 1 ? '' : 's'}).</p>
        {b.show_diagnosis && b.diagnosis && <p>Diagnosis: {b.diagnosis}</p>}
        {b.note && <p className="pre">{b.note}</p>}
      </>}
      {d.kind === 'letter' && <>{b.to && <p>{b.to}</p>}<p className="pre">{b.text}</p></>}

      <footer className="sheet-foot">
        <div className="sig"><span /><small>{d.doctor?.name}</small></div>
        <p className="verify-line">Reference <b>{d.ref}</b>. To check this document is genuine, open <b>{window.location.origin}/doctor/#/verify/{d.ref}</b>. The check shows the doctor and date only, never the patient or contents.</p>
      </footer>
    </Frame>
  );
}

/** The patient's active medicines as a prescription sheet. */
export function PrintRx({ patientId, doctor }: { patientId: number; doctor: DoctorInfo }) {
  const [p, setP] = useState<Detail | null>(null);
  const [rx, setRx] = useState<Rx[] | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { getPatient(patientId).then(setP).catch(e => setErr((e as Error).message)); getPrescriptions(patientId).then(r => setRx(r.prescriptions.filter(x => x.status === 'active'))).catch(e => setErr((e as Error).message)); }, [patientId]);
  if (err) return <div className="alert-box" role="alert">{err}</div>;
  if (!p || !rx) return <div className="card"><Skeleton h={300} /></div>;
  const pt = p.patient;
  return (
    <Frame back={`#/patient/${patientId}`}>
      <Letterhead d={{ name: doctor.full_name, specialization: doctor.specialization, hospital: doctor.hospital, doctor_id: doctor.doctor_id }} />
      <h1>Prescription</h1>
      <p className="dateline">{day(new Date().toISOString())}</p>
      <dl className="sheet-dl"><dt>Patient</dt><dd>{pt.name}{pt.age ? `, ${pt.age} years` : ''}{pt.gender ? `, ${pt.gender}` : ''}</dd></dl>
      {rx.length === 0 ? <p>No active medicines.</p> : (
        <ol className="rx-sheet">{rx.map(r => <li key={r.id}><b>{r.name}</b> {r.dose}<br /><span>{r.times.join(', ')}{r.instructions ? `. ${r.instructions}` : ''}</span></li>)}</ol>
      )}
      <footer className="sheet-foot"><div className="sig"><span /><small>{doctor.full_name}</small></div><p className="verify-line">Printed from the HEWAL3 doctor site. A prescription is valid only with the doctor's signature.</p></footer>
    </Frame>
  );
}
