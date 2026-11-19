import React, { useCallback, useEffect, useState } from 'react';
import { KeyRound, Plus, RefreshCw, Sun, Thermometer, Trash2 } from 'lucide-react';
import { addSiteReading, createWorkplace, deleteWorkplace, getSiteReadings, getWorkplaces, rotateWorkplace, Workplace, WorkplaceReading } from './api';
import { Empty, Skeleton } from './ui';
import { when } from './util';

const LEVEL: Record<string, { label: string; cls: string }> = {
  low: { label: 'Low risk', cls: 'normal' }, caution: { label: 'Caution', cls: 'low' }, extreme_caution: { label: 'Extreme caution', cls: 'high' },
  danger: { label: 'Danger', cls: 'critical' }, extreme_danger: { label: 'Extreme danger', cls: 'critical' },
};
type Secret = { id: number; join_code: string; site_key: string };

/** Workplace heat safety for an occupational-health doctor: record the site temperature and humidity (or let a sensor post them), see the current level,
 *  and staff who joined are warned when it reaches danger. The page shows how many people joined (hidden under 5), never anyone's health. */
export default function WorkplacePage() {
  const [list, setList] = useState<Workplace[] | null>(null);
  const [err, setErr] = useState('');
  const [secret, setSecret] = useState<Secret | null>(null);
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', region: 'ae' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => { getWorkplaces().then(r => { setList(r.workplaces); setErr(''); }).catch(e => setErr((e as Error).message)); }, []);
  useEffect(() => { load(); const t = window.setInterval(load, 60000); return () => window.clearInterval(t); }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr('');
    try { const w = await createWorkplace(f.name.trim(), f.region); setSecret({ id: w.id, join_code: w.join_code, site_key: w.site_key }); setF({ name: '', region: 'ae' }); setOpen(false); load(); }
    catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="page">
      <header className="page-head"><h1>Workplaces</h1><button className="btn primary" onClick={() => setOpen(o => !o)}><Plus size={16} />Add workplace</button></header>
      <p className="muted">Keep outdoor and hot-site staff safe in the heat. Enter the temperature and humidity where they work. When it becomes dangerous, everyone who joined gets a warning on their phone, with advice written for their own health.</p>
      <ol className="steps">
        <li><b>Add your workplace</b><small>Give it a name. You get a short staff code.</small></li>
        <li><b>Staff join</b><small>They open the HEWAL3 app, then Profile, Prevention, My workplace, and type the code.</small></li>
        <li><b>Enter the temperature</b><small>Type it in a few times a day, or ask your IT team to connect a sensor.</small></li>
      </ol>
      {err && <p className="muted" role="alert">{err}</p>}

      {open && (
        <form className="card rx-form" onSubmit={create}>
          <label htmlFor="wn">Name of the workplace</label>
          <div className="field"><input id="wn" required minLength={2} maxLength={120} value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="For example Port Terminal, Khalifa Port" /></div>
          <label htmlFor="wr">Country</label>
          <div className="field"><select id="wr" value={f.region} onChange={e => setF({ ...f, region: e.target.value })}><option value="ae">United Arab Emirates</option><option value="gh">Ghana</option></select></div>
          <div className="row-end"><small>You get a join code for staff and a key for sensors, shown once.</small><button className="btn primary" disabled={busy}>{busy ? 'Creating' : 'Create'}</button></div>
        </form>
      )}

      {secret && <SecretBox s={secret} onClose={() => setSecret(null)} />}

      {!list ? <div className="card"><Skeleton h={160} /></div> : list.length === 0 ? (
        <Empty icon={<Sun size={26} />} title="No workplaces yet">Add one, then give staff the join code. They see the site conditions in their app with advice for their own health.</Empty>
      ) : <div className="wp-grid">{list.map(w => <Site key={w.id} w={w} reload={load} onSecret={setSecret} />)}</div>}
    </div>
  );
}

function SecretBox({ s, onClose }: { s: Secret; onClose: () => void }) {
  return (
    <section className="card callout" role="status">
      <b>Your staff code</b>
      <small>Give this to your staff. In the HEWAL3 app they go to Profile, Prevention, My workplace and type it. It is shown only now, so write it down.</small>
      <code className="bigcode">{s.join_code}</code>
      <details className="tech">
        <summary>For your IT team: connect an automatic temperature sensor</summary>
        <small>A sensor or a small program can send readings by itself. Give your IT team this key and this address. The key is shown only now.</small>
        <small>Address: <code>POST /workplace/ingest</code> with the header <code>X-Site-Key</code> and a body like <code>{'{"temp_c": 38, "humidity_pct": 50}'}</code></small>
        <code className="keycode">{s.site_key}</code>
      </details>
      <div className="row-end"><small /><button className="btn primary small" onClick={onClose}>I have written it down</button></div>
    </section>
  );
}

function Site({ w, reload, onSecret }: { w: Workplace; reload: () => void; onSecret: (s: Secret) => void }) {
  const [form, setForm] = useState({ temp: '', rh: '', note: '' });
  const [hist, setHist] = useState<WorkplaceReading[] | null>(null);
  const [showHist, setShowHist] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const lv = w.level ? LEVEL[w.level] : null;

  useEffect(() => { if (showHist) getSiteReadings(w.id).then(r => setHist(r.readings)).catch(() => setHist([])); }, [showHist, w.id, w.latest?.at]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setMsg('');
    try { await addSiteReading(w.id, { temp_c: parseFloat(form.temp), humidity_pct: parseFloat(form.rh), note: form.note.trim() || undefined }); setForm({ temp: '', rh: '', note: '' }); reload(); }
    catch (x) { setMsg((x as Error).message); } finally { setBusy(false); }
  };
  const rotate = async () => {
    if (!window.confirm('This gives you a new staff code and a new sensor key. The old ones stop working. Staff who already joined stay joined. Continue?')) return;
    try { const r = await rotateWorkplace(w.id); onSecret({ id: w.id, join_code: r.join_code, site_key: r.site_key }); } catch (x) { setMsg((x as Error).message); }
  };
  const remove = async () => {
    if (!window.confirm(`Delete ${w.name} and its readings? Staff are removed from it.`)) return;
    try { await deleteWorkplace(w.id); reload(); } catch (x) { setMsg((x as Error).message); }
  };

  return (
    <section className="card wp">
      <div className="card-head"><h2><Thermometer size={18} />{w.name}</h2>
        {lv ? <span className={`flag ${lv.cls}`}>{lv.label}</span> : <span className="flag">No recent reading</span>}</div>
      {w.latest && lv ? (
        <p className="wp-now"><b>{(w.heat_index_c ?? 0) >= 55 ? '55°C or more' : `${Math.round(w.heat_index_c ?? w.latest.temp_c)}°C`}</b> feels like, from {w.latest.temp_c}°C and {w.latest.humidity_pct}% humidity <small>{when(w.latest.at)}, {w.latest.source === 'sensor' ? 'sensor' : 'entered by hand'}</small></p>
      ) : <p className="muted">{w.latest ? 'The last reading is more than 12 hours old, so no level is shown.' : 'Nobody has recorded a reading yet.'}</p>}
      <p className="muted small">{w.members_hidden ? 'Fewer than 5 staff have joined, so the number is hidden to protect their privacy.' : `${w.members} staff have joined.`}{w.last_alert_at ? ` Last alert: ${when(w.last_alert_at)}.` : ''}</p>

      <form onSubmit={submit} className="wp-form">
        <div className="field"><input aria-label="Temperature in degrees Celsius" required type="number" step="0.1" min={-20} max={50} placeholder="°C" value={form.temp} onChange={e => setForm({ ...form, temp: e.target.value })} /></div>
        <div className="field"><input aria-label="Humidity in percent" required type="number" step="1" min={0} max={100} placeholder="% RH" value={form.rh} onChange={e => setForm({ ...form, rh: e.target.value })} /></div>
        <div className="field wp-note"><input aria-label="Note (optional)" maxLength={200} placeholder="Where" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} /></div>
        <button className="btn primary" disabled={busy}>{busy ? 'Saving' : 'Record'}</button>
      </form>
      {msg && <p className="muted small" role="alert">{msg}</p>}

      <div className="row-end">
        <button className="btn ghost small" onClick={() => setShowHist(s => !s)}>{showHist ? 'Hide history' : 'Last 48 hours'}</button>
        <span className="wp-actions"><button className="btn ghost small" onClick={rotate}><RefreshCw size={14} />Change the code</button><button className="icon-btn" aria-label={`Delete ${w.name}`} onClick={remove}><Trash2 size={15} /></button></span>
      </div>
      {showHist && (!hist ? <Skeleton h={80} /> : hist.length === 0 ? <p className="muted small">No readings in the last 48 hours.</p> : (
        <ul className="plain">{hist.slice(0, 30).map(r => <li key={r.id}><div><b>{r.temp_c}°C, {r.humidity_pct}% <span className={`flag ${LEVEL[r.level]?.cls}`}>{LEVEL[r.level]?.label}</span></b><small>{when(r.at)}, {r.source === 'sensor' ? 'sensor' : 'by hand'}{r.note ? `, ${r.note}` : ''}</small></div></li>)}</ul>
      ))}
      <small className="muted"><KeyRound size={12} /> {w.has_sensor_key ? 'An automatic sensor can be connected.' : 'No sensor connected.'}</small>
    </section>
  );
}
