import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Activity, ArrowLeft, CalendarClock, CheckCircle2, ClipboardList, FileSignature, FileText, HeartPulse, Pill, Printer, Trash2 } from 'lucide-react';
import { addAddendum, ClinicDoc, ClinicVitals, Consultation, ConsultPatch, deleteConsultation, DocKind, getAnalytics, getConsultation, getPatient, getPatientConsultations, getPatientDocuments, patchConsultation, signConsultation } from './api';
import DiagnosisPicker from './DiagnosisPicker';
import DocComposer, { KIND_LABEL } from './DocComposer';
import { localInput } from './AppointmentsPage';
import RxPanel from './RxPanel';
import { Badge, Skeleton } from './ui';
import { ago, bpText, initials, NA, usePolling, when } from './util';

type Save = 'saved' | 'dirty' | 'saving' | 'error';
const VITALS: { k: keyof ClinicVitals; label: string; unit: string; step: string; warn: (v: number) => boolean }[] = [
  { k: 'systolic', label: 'Systolic', unit: 'mmHg', step: '1', warn: v => v >= 140 || v < 90 },
  { k: 'diastolic', label: 'Diastolic', unit: 'mmHg', step: '1', warn: v => v >= 90 || v < 50 },
  { k: 'heart_rate', label: 'Pulse', unit: 'bpm', step: '1', warn: v => v > 100 || v < 50 },
  { k: 'spo2', label: 'SpO2', unit: '%', step: '1', warn: v => v < 94 },
  { k: 'temperature', label: 'Temperature', unit: '°C', step: '0.1', warn: v => v >= 37.8 || v < 35.5 },
  { k: 'weight', label: 'Weight', unit: 'kg', step: '0.1', warn: () => false },
  { k: 'glucose', label: 'Glucose', unit: 'mg/dL', step: '1', warn: v => v >= 200 || v < 70 },
];
const FOLLOW = [{ label: '1 week', days: 7 }, { label: '2 weeks', days: 14 }, { label: '1 month', days: 30 }, { label: '3 months', days: 90 }];
const at9 = (days: number) => { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(9, 0, 0, 0); return d; };

/** One consultation, from opening the chart to signing the note. Everything autosaves as a draft; signing locks it. */
export default function ConsultPage({ id }: { id: number }) {
  const [c, setC] = useState<Consultation | null>(null);
  const [err, setErr] = useState('');
  const [save, setSave] = useState<Save>('saved');
  const [msg, setMsg] = useState('');
  const [doc, setDoc] = useState<DocKind | null>(null);
  const [docs, setDocs] = useState<ClinicDoc[]>([]);
  const [past, setPast] = useState<Consultation[]>([]);
  const [add, setAdd] = useState('');
  const [signing, setSigning] = useState(false);
  const pending = useRef<ConsultPatch>({});
  const timer = useRef<number>();

  useEffect(() => { setC(null); getConsultation(id).then(setC).catch(e => setErr((e as Error).message)); }, [id]);
  const pid = c?.patient_id;
  const detail = usePolling(() => (pid ? getPatient(pid) : Promise.reject(new Error('wait'))), 15000, [pid]);
  const stats = usePolling(() => (pid ? getAnalytics(pid, 14) : Promise.reject(new Error('wait'))), 60000, [pid]);
  const loadSide = useCallback(() => {
    if (!pid) return;
    getPatientDocuments(pid).then(r => setDocs(r.documents)).catch(() => {});
    getPatientConsultations(pid).then(r => setPast(r.consultations.filter(x => x.id !== id))).catch(() => {});
  }, [pid, id]);
  useEffect(() => { loadSide(); }, [loadSide]);

  const flush = useCallback(async () => {
    const p = pending.current;
    if (!Object.keys(p).length) return;
    pending.current = {};
    setSave('saving');
    try { await patchConsultation(id, p); setSave(Object.keys(pending.current).length ? 'dirty' : 'saved'); setMsg(''); }
    catch (e) { pending.current = { ...p, ...pending.current }; setSave('error'); setMsg((e as Error).message); }
  }, [id]);
  useEffect(() => () => { window.clearTimeout(timer.current); void flush(); }, [flush]);     // leaving the page saves what was typed

  const edit = (patch: ConsultPatch) => {
    setC(x => (x ? { ...x, ...patch, follow_up_at: patch.clear_follow_up ? null : patch.follow_up_at ?? x.follow_up_at } as Consultation : x));
    pending.current = { ...pending.current, ...patch };
    setSave('dirty');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => { void flush(); }, 900);
  };
  const setVital = (k: keyof ClinicVitals, raw: string) => {
    const v = { ...(c?.clinic_vitals || {}) } as Record<string, number>;
    if (raw === '') delete v[k]; else if (!Number.isNaN(Number(raw))) v[k] = Number(raw);
    edit({ clinic_vitals: v as ClinicVitals });
  };

  if (err) return <><a className="back" href="#/patients"><ArrowLeft size={16} />Patients</a><div className="alert-box" role="alert">{err}</div></>;
  if (!c) return <div className="card"><Skeleton h={300} /></div>;
  const locked = c.status === 'signed';
  const d = detail.data, a = stats.data;
  const p = d?.patient;
  const v = p?.vitals;

  const sign = async () => {
    setSigning(true); setMsg('');
    window.clearTimeout(timer.current); await flush();
    try { setC(await signConsultation(id)); loadSide(); } catch (e) { setMsg((e as Error).message); } finally { setSigning(false); }
  };
  const remove = async () => { if (!window.confirm('Delete this draft? It cannot be recovered.')) return; try { await deleteConsultation(id); window.location.hash = `#/patient/${c.patient_id}`; } catch (e) { setMsg((e as Error).message); } };
  const addNote = async () => { if (add.trim().length < 2) return; try { setC(await addAddendum(id, add.trim())); setAdd(''); } catch (e) { setMsg((e as Error).message); } };
  const mine = docs.filter(x => x.consultation_id === id);

  return (
    <>
      <a className="back" href={`#/patient/${c.patient_id}`}><ArrowLeft size={16} />{c.patient || 'Patient'}'s chart</a>
      <section className="card hero consult-head">
        <span className={`avatar xl ${p?.group || 'no_data'}`}>{initials(c.patient || 'P')}</span>
        <div className="hero-main">
          <h1>{c.patient || 'Patient'} {p && <Badge group={p.group} />}</h1>
          <p className="meta">{[p?.age ? `${p.age} years` : null, p?.gender, p?.identifier].filter(Boolean).join(', ')}</p>
          {p && p.conditions.length > 0 && <div className="tags">{p.conditions.map(x => <span key={x} className="tag">{x}</span>)}</div>}
        </div>
        <div className="hero-side">
          <span className={`status-pill ${locked ? 'confirmed' : 'requested'}`}>{locked ? 'Signed' : 'Draft'}</span>
          <small>Started {c.started_at ? ago(c.started_at) : ''}</small>
          {!locked && <small className={`savestate ${save}`} role="status">{save === 'saved' ? 'All changes saved' : save === 'saving' ? 'Saving' : save === 'error' ? 'Not saved' : 'Unsaved changes'}</small>}
        </div>
      </section>
      {msg && <div className="alert-box" role="alert">{msg}</div>}
      {locked && <div className="alert-box ok" role="status"><CheckCircle2 size={16} />Signed {when(c.signed_at)}. The note is locked. You can add an addendum below.</div>}

      <div className="consult">
        <div className="consult-main">
          <section className="card">
            <div className="card-head"><h2><ClipboardList size={18} />Reason for the visit</h2></div>
            <div className="field"><input aria-label="Reason for the visit" value={c.complaint || ''} maxLength={300} disabled={locked} onChange={e => edit({ complaint: e.target.value })} placeholder="In the patient's words" /></div>
          </section>

          <section className="card">
            <div className="card-head"><h2><Activity size={18} />Vitals taken today</h2><small className="one-line">Taken in the room, kept in this note only</small></div>
            <div className="vit-grid">
              {VITALS.map(x => {
                const val = c.clinic_vitals[x.k];
                return (
                  <label key={x.k} className={`vit ${val !== undefined && x.warn(val) ? 'warn' : ''}`}>
                    <span>{x.label}</span>
                    <input type="number" inputMode="decimal" step={x.step} value={val ?? ''} disabled={locked} onChange={e => setVital(x.k, e.target.value)} aria-label={`${x.label} in ${x.unit}`} />
                    <small>{x.unit}</small>
                  </label>
                );
              })}
            </div>
            {v && (v.systolic || v.heart_rate) ? <p className="muted small">Their own app, {ago(v.at)}: {[v.systolic ? `BP ${bpText(v.systolic, v.diastolic)}` : null, v.heart_rate ? `pulse ${v.heart_rate}` : null, v.blood_oxygen ? `SpO2 ${v.blood_oxygen}%` : null].filter(Boolean).join(', ')}.</p> : null}
          </section>

          <section className="card soap">
            <div className="card-head"><h2><FileText size={18} />Consultation note</h2></div>
            <label htmlFor="s1">Subjective, the history</label>
            <textarea id="s1" rows={4} disabled={locked} value={c.subjective || ''} maxLength={4000} onChange={e => edit({ subjective: e.target.value })} placeholder="How it started, how it has been, what makes it better or worse, medicines taken, allergies." />
            <label htmlFor="o1">Objective, examination and results</label>
            <textarea id="o1" rows={4} disabled={locked} value={c.objective || ''} maxLength={4000} onChange={e => edit({ objective: e.target.value })} placeholder="Examination findings, test results." />
            <label>Diagnoses</label>
            <DiagnosisPicker value={c.diagnoses} locked={locked} onChange={dx => edit({ diagnoses: dx })} />
            <label htmlFor="a1">Assessment</label>
            <textarea id="a1" rows={3} disabled={locked} value={c.assessment || ''} maxLength={3000} onChange={e => edit({ assessment: e.target.value })} placeholder="Your clinical impression, for example: hypertension above target on two drugs." />
            <label htmlFor="pl1">Plan</label>
            <textarea id="pl1" rows={4} disabled={locked} value={c.plan || ''} maxLength={3000} onChange={e => edit({ plan: e.target.value })} placeholder="What happens next: medicines, tests, advice, referral." />
            <label className="check"><input type="checkbox" checked={c.share_plan} disabled={locked} onChange={e => edit({ share_plan: e.target.checked })} />Send the diagnosis and plan to the patient when I sign (they see it as a note from you)</label>
          </section>

          <RxPanel patientId={c.patient_id} name={c.patient || 'the patient'} locked={locked} />

          <section className="card">
            <div className="card-head"><h2><CalendarClock size={18} />Follow-up</h2></div>
            <div className="chips" role="group" aria-label="Follow-up in">
              {FOLLOW.map(x => <button key={x.days} type="button" className="chip-btn" disabled={locked} onClick={() => edit({ follow_up_at: at9(x.days).toISOString() })}>In {x.label}</button>)}
              {c.follow_up_at && !locked && <button type="button" className="chip-btn" onClick={() => edit({ clear_follow_up: true })}>No follow-up</button>}
            </div>
            <div className="field" style={{ marginTop: 10, maxWidth: 280 }}><input type="datetime-local" aria-label="Follow-up date and time" disabled={locked} value={c.follow_up_at ? localInput(new Date(c.follow_up_at)) : ''} min={localInput(new Date())}
              onChange={e => { if (e.target.value) edit({ follow_up_at: new Date(e.target.value).toISOString() }); }} /></div>
            <p className="muted small">{c.follow_up_at ? `A 30 minute follow-up is booked for ${when(c.follow_up_at)} when you sign, and the patient is told.` : 'Optional. Signing books it for you.'}</p>
          </section>

          {!locked ? (
            <div className="sign-bar">
              <button type="button" className="btn ghost" onClick={remove}><Trash2 size={16} />Delete draft</button>
              <button type="button" className="btn primary" disabled={signing || !(c.diagnoses.length || (c.assessment || '').trim())} onClick={sign}><FileSignature size={17} />{signing ? 'Signing' : 'Sign and finish'}</button>
            </div>
          ) : (
            <>
              <section className="card">
                <div className="card-head"><h2><FileText size={18} />Documents for this visit</h2></div>
                <div className="row-btns">
                  {(['referral', 'sick_note', 'letter'] as DocKind[]).map(k => <button key={k} type="button" className="btn ghost" onClick={() => setDoc(k)}>{KIND_LABEL[k]}</button>)}
                  <a className="btn ghost" href={`#/rx/${c.patient_id}`}><Printer size={16} />Prescription</a>
                </div>
                {mine.length > 0 && <ul className="plain sent">{mine.map(x => <li key={x.id}><a href={`#/doc/${x.id}`}><div><b>{x.title}</b><small>{x.ref}{x.revoked ? ', withdrawn' : ''}, {when(x.issued_at)}</small></div></a></li>)}</ul>}
              </section>
              <section className="card">
                <div className="card-head"><h2>Addenda</h2><small>The signed note stays as it was. Anything new goes here with its time.</small></div>
                {c.addenda.length > 0 && <ul className="notes">{c.addenda.map((x, i) => <li key={i}><p>{x.text}</p><small>{when(x.at)}</small></li>)}</ul>}
                <textarea rows={3} value={add} maxLength={2000} onChange={e => setAdd(e.target.value)} placeholder="For example: result of the fasting glucose came back at 5.6 mmol/L." aria-label="Add an addendum" />
                <div className="row-end"><span /><button type="button" className="btn primary" disabled={add.trim().length < 2} onClick={addNote}>Add addendum</button></div>
              </section>
            </>
          )}
        </div>

        <aside className="consult-side" aria-label="Patient context">
          <section className="card">
            <div className="card-head"><h2><HeartPulse size={18} />From their app</h2><small>{v ? ago(v.at) : ''}</small></div>
            {!v ? <Skeleton h={90} /> : (
              <div className="mini-vt">
                <div><small>Heart rate</small><b>{v.heart_rate ?? NA}</b></div>
                <div><small>Blood pressure</small><b>{bpText(v.systolic, v.diastolic)}</b></div>
                <div><small>Oxygen</small><b>{v.blood_oxygen === null ? NA : `${v.blood_oxygen}%`}</b></div>
                <div><small>Steps today</small><b>{v.steps === null ? NA : v.steps.toLocaleString()}</b></div>
              </div>
            )}
          </section>
          <section className="card">
            <div className="card-head"><h2><Pill size={18} />Taking their medicines?</h2></div>
            {!a ? <Skeleton h={50} /> : !a.medication ? <p className="muted">No medicines on their list.</p> : a.medication.adherence_pct === null
              ? <p className="muted">Not enough doses have been due yet to judge ({a.medication.due} so far). This is new data, not zero.</p>
              : <><b className="big">{a.medication.adherence_pct}%</b><p className="muted small one-line">{a.medication.taken} of {a.medication.due} doses taken, 14 days{a.medication.unlogged ? `, ${a.medication.unlogged} not logged` : ''}</p></>}
          </section>
          <section className="card">
            <div className="card-head"><h2>What stands out</h2><small>14 days</small></div>
            {!a ? <Skeleton h={70} /> : a.findings.length === 0 ? <p className="muted">Nothing unusual in their readings.</p> : <ul className="plain">{a.findings.slice(0, 4).map(f => <li key={f.title}><div><b>{f.title}</b><small>{f.evidence}</small></div></li>)}</ul>}
          </section>
          <section className="card">
            <div className="card-head"><h2>Earlier visits</h2></div>
            {past.length === 0 ? <p className="muted">No earlier consultations here.</p> : <ul className="plain">{past.slice(0, 6).map(x => <li key={x.id}><a href={`#/consult/${x.id}`}><div><b>{x.diagnoses.map(y => y.label).join('; ') || x.complaint || 'Visit'}</b><small>{when(x.signed_at || x.started_at)}{x.status === 'draft' ? ', unsigned' : ''}</small></div></a></li>)}</ul>}
          </section>
        </aside>
      </div>
      {doc && <DocComposer patientId={c.patient_id} patientName={c.patient || 'patient'} kind={doc} consultation={c} onClose={() => setDoc(null)} onCreated={docId => { window.location.hash = `#/doc/${docId}`; }} />}
    </>
  );
}
