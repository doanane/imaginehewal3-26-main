import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Pill, Plus, Printer, ShieldAlert, Trash2 } from 'lucide-react';
import { checkRx, getPrescriptions, MedRef, prescribe, Rx, RxCheck, searchMedicines, stopPrescription } from './api';
import { Empty } from './ui';

/** Prescribing inside a consultation: pick from the common medicines (usual doses and times fill in), see reminders about this patient before you save,
 *  and see what they already take. The reminders never block: you decide. */
export default function RxPanel({ patientId, name, locked }: { patientId: number; name: string; locked: boolean }) {
  const [rx, setRx] = useState<Rx[] | null>(null);
  const [f, setF] = useState({ name: '', dose: '', times: ['08:00'], instructions: '' });
  const [sugg, setSugg] = useState<MedRef[]>([]);
  const [pick, setPick] = useState<MedRef | null>(null);
  const [check, setCheck] = useState<RxCheck | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [stopping, setStopping] = useState<number | null>(null);
  const [why, setWhy] = useState('');
  const t = useRef<number>();

  const load = useCallback(() => { getPrescriptions(patientId).then(r => setRx(r.prescriptions)).catch(e => setErr((e as Error).message)); }, [patientId]);
  useEffect(() => { load(); }, [load]);

  const type = (v: string) => {
    setF(x => ({ ...x, name: v })); setPick(null); setCheck(null);
    window.clearTimeout(t.current);
    if (v.trim().length < 2) { setSugg([]); return; }
    t.current = window.setTimeout(() => { searchMedicines(v.trim()).then(r => setSugg(r.results.slice(0, 6))).catch(() => setSugg([])); }, 200);
  };
  const choose = (m: MedRef) => {
    setPick(m); setSugg([]);
    setF({ name: m.name, dose: m.doses[0] || '', times: m.times.length ? m.times : ['08:00'], instructions: m.how });
    checkRx(patientId, m.name).then(setCheck).catch(() => setCheck(null));
  };
  const checkTyped = () => { if (f.name.trim().length >= 2 && !pick) checkRx(patientId, f.name.trim()).then(setCheck).catch(() => setCheck(null)); };

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { await prescribe(patientId, { name: f.name.trim(), dose: f.dose.trim() || undefined, times: f.times, instructions: f.instructions.trim() || undefined }); setF({ name: '', dose: '', times: ['08:00'], instructions: '' }); setPick(null); setCheck(null); load(); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  const stop = async (r: Rx) => {
    setBusy(true); setErr('');
    try { await stopPrescription(r.id, why); setStopping(null); setWhy(''); load(); } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };
  const active = (rx || []).filter(r => r.status === 'active');

  return (
    <section className="card">
      <div className="card-head"><h2><Pill size={18} />Medicines</h2>
        {active.length > 0 && <a className="btn ghost small" href={`#/rx/${patientId}`}><Printer size={14} />Print prescription</a>}</div>
      {rx === null ? null : active.length === 0 ? <p className="muted small">{name.split(' ')[0]} has no active prescriptions from you or on their own list.</p> : (
        <ul className="rx-list">
          {active.map(r => (
            <li key={r.id}>
              <div><b>{r.name}</b>{r.dose && <span className="dose">{r.dose}</span>}<small>{r.times.join(', ')}{r.instructions ? `, ${r.instructions}` : ''}</small></div>
              {!locked && (stopping === r.id ? (
                <div className="rx-stop"><div className="field"><input aria-label="Why stop" value={why} maxLength={200} onChange={e => setWhy(e.target.value)} placeholder="Reason (the patient sees it)" /></div>
                  <button className="btn ghost small" onClick={() => setStopping(null)}>Back</button><button className="btn primary small" disabled={busy} onClick={() => stop(r)}>Stop</button></div>
              ) : <button className="btn ghost small" onClick={() => setStopping(r.id)}>Stop</button>)}
            </li>
          ))}
        </ul>
      )}

      {!locked && (
        <form onSubmit={save} className="rx-form open">
          <label htmlFor="rxn2">Add a medicine</label>
          <div className="suggest">
            <div className="field"><Plus size={16} /><input id="rxn2" required minLength={2} maxLength={120} value={f.name} onChange={e => type(e.target.value)} onBlur={() => window.setTimeout(checkTyped, 150)} placeholder="Start typing, for example Amlod" autoComplete="off" /></div>
            {sugg.length > 0 && (
              <ul className="suggest-list" role="listbox">
                {sugg.map(m => <li key={m.name}><button type="button" role="option" aria-selected={false} onMouseDown={e => e.preventDefault()} onClick={() => choose(m)}><b>{m.name}</b><small>{m.cls}, usually {m.doses[0]}</small></button></li>)}
              </ul>
            )}
          </div>
          {check && check.warnings.length > 0 && (
            <ul className="rx-warn" role="alert">
              {check.warnings.map((w, i) => <li key={i} className={w.level}>{w.level === 'avoid' ? <ShieldAlert size={16} /> : <AlertTriangle size={16} />}<span>{w.text}</span></li>)}
              <li className="foot">Reminders only. You decide.</li>
            </ul>
          )}
          {check && !check.known && check.note && <small className="muted">{check.note}</small>}
          {pick && pick.doses.length > 1 && <div className="chips" aria-label="Usual doses">{pick.doses.map(d => <button key={d} type="button" className="chip-btn" aria-pressed={f.dose === d} onClick={() => setF({ ...f, dose: d })}>{d}</button>)}</div>}
          <div className="two">
            <div><label htmlFor="rxd2">Dose</label><div className="field"><input id="rxd2" maxLength={60} value={f.dose} onChange={e => setF({ ...f, dose: e.target.value })} placeholder="For example 5 mg" /></div></div>
            <div><label>Times each day</label>
              <div className="times">
                {f.times.map((x, i) => (
                  <span key={i} className="time-chip"><input type="time" aria-label={`Dose time ${i + 1}`} value={x} required onChange={e => setF({ ...f, times: f.times.map((y, j) => (j === i ? e.target.value : y)) })} />
                    {f.times.length > 1 && <button type="button" className="icon-btn" aria-label="Remove this time" onClick={() => setF({ ...f, times: f.times.filter((_, j) => j !== i) })}><Trash2 size={14} /></button>}</span>
                ))}
                {f.times.length < 6 && <button type="button" className="btn ghost small" onClick={() => setF({ ...f, times: [...f.times, '20:00'] })}><Plus size={14} />Time</button>}
              </div></div>
          </div>
          <label htmlFor="rxi2">Instructions</label>
          <div className="field"><input id="rxi2" maxLength={400} value={f.instructions} onChange={e => setF({ ...f, instructions: e.target.value })} placeholder="For example: after food" /></div>
          {err && <div className="alert-box" role="alert">{err}</div>}
          <div className="row-end"><small>It appears in the patient's own medicine list with reminders.</small><button className="btn primary" disabled={busy || f.name.trim().length < 2}>{busy ? 'Saving' : 'Prescribe'}</button></div>
        </form>
      )}
      {locked && active.length === 0 && <Empty icon={<Pill size={24} />} title="No active medicines" />}
    </section>
  );
}
