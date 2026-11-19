import React, { useCallback, useEffect, useState } from 'react';
import { Building2, FlaskConical, LogIn, LogOut, Plus, ScanLine, ShieldAlert, Syringe } from 'lucide-react';
import { addAllergy, addImmunisation, addLab, addRadiology, checkIn, checkOut, getRecord, HealthRecord } from './api';
import { realtime } from './realtime';
import { Empty, Skeleton } from './ui';
import { when } from './util';

const FLAG: Record<string, string> = { normal: 'Normal', low: 'Low', high: 'High', critical: 'Critical' };
const MODALITY: Record<string, string> = { xray: 'X-ray', ct: 'CT', mri: 'MRI', ultrasound: 'Ultrasound', mammogram: 'Mammogram', other: 'Other' };
const KIND: Record<string, string> = { clinic: 'Clinic visit', emergency: 'Emergency', admission: 'Admission' };
const day = (s: string | null) => (s ? new Date(s).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** The health record as the doctor sees and writes it: allergies, laboratory results, imaging reports, vaccinations and hospital visits.
 *  Insurance is read-only here because the patient enters it from their own card. */
export default function RecordTab({ id }: { id: number }) {
  const [r, setR] = useState<HealthRecord | null>(null);
  const [err, setErr] = useState('');
  const load = useCallback(() => { getRecord(id).then(x => { setR(x); setErr(''); }).catch(e => setErr((e as Error).message)); }, [id]);
  useEffect(() => { setR(null); load(); }, [load]);
  useEffect(() => realtime.on('care.refresh', (m: { patient_id?: number }) => { if (!m.patient_id || m.patient_id === id) load(); }), [id, load]);
  if (err) return <div className="card"><p className="muted" role="alert">{err}</p></div>;
  if (!r) return <div className="card"><Skeleton h={220} /></div>;
  return (
    <div className="grid-2 record">
      <Visits id={id} r={r} run={load} />
      <Allergies id={id} r={r} run={load} />
      <Labs id={id} r={r} run={load} />
      <Radiology id={id} r={r} run={load} />
      <Vaccines id={id} r={r} run={load} />
      <section className="card"><div className="card-head"><h2><Building2 size={18} />Insurance</h2></div>
        {r.insurance ? (
          <ul className="plain"><li><div><b>{r.insurance.provider}{r.insurance.plan ? `, ${r.insurance.plan}` : ''}</b>
            <small>{[r.insurance.member_no && `Member ${r.insurance.member_no}`, r.insurance.valid_until && `${r.insurance.expired ? 'Expired' : 'Valid until'} ${day(r.insurance.valid_until)}`].filter(Boolean).join(', ')}</small>
            {r.insurance.coverage_notes && <small>{r.insurance.coverage_notes}</small>}</div></li></ul>
        ) : <p className="muted">The patient has not added insurance details.</p>}
        <p className="muted small">Entered by the patient from their own card.</p>
      </section>
    </div>
  );
}

type P = { id: number; r: HealthRecord; run: () => void };

function useSubmit(run: () => void) {
  const [busy, setBusy] = useState(false); const [msg, setMsg] = useState('');
  const go = async (fn: () => Promise<unknown>, after: () => void) => {
    setBusy(true); setMsg('');
    try { await fn(); after(); run(); } catch (x) { setMsg((x as Error).message); } finally { setBusy(false); }
  };
  return { busy, msg, go };
}

function Visits({ id, r, run }: P) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ kind: 'clinic', reason: '' });
  const [sum, setSum] = useState('');
  const { busy, msg, go } = useSubmit(run);
  const ov = r.open_visit;
  return (
    <section className="card">
      <div className="card-head"><h2><LogIn size={18} />Check-in and visits</h2>
        {!ov && <button className="btn primary small" onClick={() => setOpen(o => !o)}><Plus size={15} />Check in</button>}</div>
      {ov && (
        <div className="callout">
          <b>Checked in {when(ov.checked_in_at)}</b><small>{[KIND[ov.kind], ov.facility, ov.reason].filter(Boolean).join(', ')}</small>
          <label htmlFor="vsum">Discharge summary (optional)</label>
          <div className="field"><textarea id="vsum" maxLength={3000} rows={3} value={sum} onChange={e => setSum(e.target.value)} placeholder="What was done and what happens next" /></div>
          <div className="row-end"><small>{msg}</small><button className="btn primary small" disabled={busy} onClick={() => go(() => checkOut(id, ov.id, sum), () => setSum(''))}><LogOut size={15} />Check out</button></div>
        </div>
      )}
      {open && !ov && (
        <form className="rx-form" onSubmit={e => { e.preventDefault(); go(() => checkIn(id, f), () => { setF({ kind: 'clinic', reason: '' }); setOpen(false); }); }}>
          <label htmlFor="vk">Type of visit</label>
          <div className="field"><select id="vk" value={f.kind} onChange={e => setF({ ...f, kind: e.target.value })}>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <label htmlFor="vr">Reason (optional)</label>
          <div className="field"><input id="vr" maxLength={300} value={f.reason} onChange={e => setF({ ...f, reason: e.target.value })} /></div>
          <div className="row-end"><small>{msg || 'The patient is told straight away.'}</small><button className="btn primary" disabled={busy}>Check in</button></div>
        </form>
      )}
      {r.visits.filter(v => !v.open).length === 0 && !ov ? <Empty icon={<Building2 size={26} />} title="No visits recorded">Check the patient in when they arrive.</Empty> : (
        <ul className="plain">{r.visits.filter(v => !v.open).map(v => (
          <li key={v.id}><div><b>{KIND[v.kind]}{v.reason ? `, ${v.reason}` : ''}</b>
            <small>{[v.facility, `${when(v.checked_in_at)} to ${when(v.checked_out_at)}`].filter(Boolean).join(', ')}</small>{v.summary && <small>{v.summary}</small>}</div></li>))}</ul>
      )}
    </section>
  );
}

function Allergies({ id, r, run }: P) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ substance: '', reaction: '', severity: 'mild' });
  const { busy, msg, go } = useSubmit(run);
  return (
    <section className="card">
      <div className="card-head"><h2><ShieldAlert size={18} />Allergies</h2><button className="btn primary small" onClick={() => setOpen(o => !o)}><Plus size={15} />Add</button></div>
      {open && (
        <form className="rx-form" onSubmit={e => { e.preventDefault(); go(() => addAllergy(id, f), () => { setF({ substance: '', reaction: '', severity: 'mild' }); setOpen(false); }); }}>
          <label htmlFor="as">Allergic to</label>
          <div className="field"><input id="as" required maxLength={120} value={f.substance} onChange={e => setF({ ...f, substance: e.target.value })} placeholder="For example penicillin" /></div>
          <label htmlFor="ar">Reaction (optional)</label>
          <div className="field"><input id="ar" maxLength={200} value={f.reaction} onChange={e => setF({ ...f, reaction: e.target.value })} /></div>
          <label htmlFor="av">Severity</label>
          <div className="field"><select id="av" value={f.severity} onChange={e => setF({ ...f, severity: e.target.value })}><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option></select></div>
          <div className="row-end"><small>{msg}</small><button className="btn primary" disabled={busy}>Add allergy</button></div>
        </form>
      )}
      {r.allergies.length === 0 ? <p className="muted">No allergies recorded.</p> : (
        <ul className="plain">{r.allergies.map(a => <li key={a.id}><div><b>{a.substance}<span className={`flag ${a.severity === 'severe' ? 'critical' : a.severity === 'moderate' ? 'high' : 'normal'}`}>{a.severity}</span></b>
          <small>{[a.reaction, a.source === 'patient' ? 'Added by the patient' : 'Added by a doctor'].filter(Boolean).join(', ')}</small></div></li>)}</ul>
      )}
    </section>
  );
}

function Labs({ id, r, run }: P) {
  const [open, setOpen] = useState(false);
  const blank = { test: '', value: '', unit: '', ref_range: '', flag: 'normal', note: '' };
  const [f, setF] = useState(blank);
  const { busy, msg, go } = useSubmit(run);
  return (
    <section className="card">
      <div className="card-head"><h2><FlaskConical size={18} />Laboratory results</h2><button className="btn primary small" onClick={() => setOpen(o => !o)}><Plus size={15} />Add result</button></div>
      {open && (
        <form className="rx-form" onSubmit={e => { e.preventDefault(); go(() => addLab(id, f), () => { setF(blank); setOpen(false); }); }}>
          <label htmlFor="lt">Test</label>
          <div className="field"><input id="lt" required maxLength={120} value={f.test} onChange={e => setF({ ...f, test: e.target.value })} placeholder="For example HbA1c" /></div>
          <label htmlFor="lv">Result</label>
          <div className="field"><input id="lv" required maxLength={60} value={f.value} onChange={e => setF({ ...f, value: e.target.value })} /></div>
          <label htmlFor="lu">Unit and normal range (optional)</label>
          <div className="field"><input id="lu" maxLength={30} value={f.unit} onChange={e => setF({ ...f, unit: e.target.value })} placeholder="Unit, for example %" /></div>
          <div className="field"><input aria-label="Normal range" maxLength={60} value={f.ref_range} onChange={e => setF({ ...f, ref_range: e.target.value })} placeholder="Normal range, for example 4.0 to 5.6" /></div>
          <label htmlFor="lf">Flag</label>
          <div className="field"><select id="lf" value={f.flag} onChange={e => setF({ ...f, flag: e.target.value })}>{Object.entries(FLAG).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="row-end"><small>{msg || 'The patient is told straight away.'}</small><button className="btn primary" disabled={busy}>Save result</button></div>
        </form>
      )}
      {r.labs.length === 0 ? <p className="muted">No results yet.</p> : (
        <ul className="plain">{r.labs.map(l => <li key={l.id}><div><b>{l.test}: {l.value}{l.unit ? ` ${l.unit}` : ''}<span className={`flag ${l.flag}`}>{FLAG[l.flag]}</span></b>
          <small>{[l.ref_range && `Normal ${l.ref_range}`, day(l.taken_at)].filter(Boolean).join(', ')}</small></div></li>)}</ul>
      )}
    </section>
  );
}

function Radiology({ id, r, run }: P) {
  const [open, setOpen] = useState(false);
  const blank = { modality: 'xray', body_part: '', findings: '', impression: '', image_url: '' };
  const [f, setF] = useState(blank);
  const { busy, msg, go } = useSubmit(run);
  return (
    <section className="card">
      <div className="card-head"><h2><ScanLine size={18} />Imaging and radiology</h2><button className="btn primary small" onClick={() => setOpen(o => !o)}><Plus size={15} />Add report</button></div>
      {open && (
        <form className="rx-form" onSubmit={e => { e.preventDefault(); go(() => addRadiology(id, { ...f, image_url: f.image_url || undefined }), () => { setF(blank); setOpen(false); }); }}>
          <label htmlFor="rm">Type</label>
          <div className="field"><select id="rm" value={f.modality} onChange={e => setF({ ...f, modality: e.target.value })}>{Object.entries(MODALITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <label htmlFor="rb">Body part</label>
          <div className="field"><input id="rb" required maxLength={80} value={f.body_part} onChange={e => setF({ ...f, body_part: e.target.value })} placeholder="For example chest" /></div>
          <label htmlFor="rf">Findings</label>
          <div className="field"><textarea id="rf" rows={3} maxLength={4000} value={f.findings} onChange={e => setF({ ...f, findings: e.target.value })} /></div>
          <label htmlFor="ri">Impression</label>
          <div className="field"><textarea id="ri" rows={2} maxLength={2000} value={f.impression} onChange={e => setF({ ...f, impression: e.target.value })} /></div>
          <label htmlFor="ru">Link to the image (optional, https)</label>
          <div className="field"><input id="ru" type="url" maxLength={500} value={f.image_url} onChange={e => setF({ ...f, image_url: e.target.value })} placeholder="https://" /></div>
          <div className="row-end"><small>{msg || 'The patient is told straight away.'}</small><button className="btn primary" disabled={busy}>Save report</button></div>
        </form>
      )}
      {r.radiology.length === 0 ? <p className="muted">No imaging reports yet.</p> : (
        <ul className="plain">{r.radiology.map(x => <li key={x.id}><div><b>{MODALITY[x.modality] || x.modality}, {x.body_part}</b>
          <small>{[x.facility, day(x.performed_at)].filter(Boolean).join(', ')}</small>{x.impression && <small>{x.impression}</small>}
          {x.image_url && <small><a href={x.image_url} target="_blank" rel="noopener noreferrer">Open the image</a></small>}</div></li>)}</ul>
      )}
    </section>
  );
}

function Vaccines({ id, r, run }: P) {
  const [open, setOpen] = useState(false);
  const blank = { vaccine: '', dose: '', given_on: new Date().toISOString().slice(0, 10) };
  const [f, setF] = useState(blank);
  const { busy, msg, go } = useSubmit(run);
  return (
    <section className="card">
      <div className="card-head"><h2><Syringe size={18} />Immunisations</h2><button className="btn primary small" onClick={() => setOpen(o => !o)}><Plus size={15} />Add</button></div>
      {open && (
        <form className="rx-form" onSubmit={e => { e.preventDefault(); go(() => addImmunisation(id, f), () => { setF(blank); setOpen(false); }); }}>
          <label htmlFor="iv">Vaccine</label>
          <div className="field"><input id="iv" required maxLength={120} value={f.vaccine} onChange={e => setF({ ...f, vaccine: e.target.value })} /></div>
          <label htmlFor="id">Dose (optional)</label>
          <div className="field"><input id="id" maxLength={30} value={f.dose} onChange={e => setF({ ...f, dose: e.target.value })} placeholder="For example booster" /></div>
          <label htmlFor="ig">Date given</label>
          <div className="field"><input id="ig" type="date" required max={new Date().toISOString().slice(0, 10)} value={f.given_on} onChange={e => setF({ ...f, given_on: e.target.value })} /></div>
          <div className="row-end"><small>{msg}</small><button className="btn primary" disabled={busy}>Save</button></div>
        </form>
      )}
      {r.immunisations.length === 0 ? <p className="muted">No vaccinations recorded.</p> : (
        <ul className="plain">{r.immunisations.map(i => <li key={i.id}><div><b>{i.vaccine}{i.dose ? `, ${i.dose}` : ''}</b>
          <small>{[day(i.given_on), i.facility, i.source === 'patient' ? 'Added by the patient' : 'Added by a doctor'].filter(Boolean).join(', ')}</small></div></li>)}</ul>
      )}
    </section>
  );
}
