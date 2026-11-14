import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Activity, AlertCircle, AlertTriangle, ArrowLeft, Footprints, Info, MapPin, OctagonAlert, Pill, ScrollText, Send, Sparkles, UtensilsCrossed } from 'lucide-react';
import { getAnalytics, getBrief, getPatient, sendMessage } from './api';
import { AdherenceGrid, Bars, Gauge, TrendChart } from './Charts';
import type { Analytics, Brief, Detail, Finding, MetricBlock, Overview } from './types';
import { Badge, CountUp, Empty, Segmented, Skeleton, Tilt } from './ui';
import { ago, bpText, initials, NA, safeMap, shortDay, show, signed, SOS_LABEL, usePolling, when } from './util';

type Tab = 'summary' | 'trends' | 'medication' | 'records';
const TABS: { v: Tab; label: string; icon: React.ElementType }[] = [
  { v: 'summary', label: 'Summary', icon: Activity }, { v: 'trends', label: 'Trends', icon: ScrollText },
  { v: 'medication', label: 'Medication', icon: Pill }, { v: 'records', label: 'Records', icon: UtensilsCrossed },
];
const LEVEL: Record<Finding['level'], { icon: React.ElementType; label: string }> = {
  critical: { icon: OctagonAlert, label: 'Critical' }, high: { icon: AlertTriangle, label: 'High' }, moderate: { icon: AlertCircle, label: 'Moderate' }, info: { icon: Info, label: 'Note' },
};
const COLORS: Record<string, string> = { heart_rate: 'var(--c-brand)', systolic: 'var(--c-amber)', diastolic: 'var(--c-green)', blood_oxygen: 'var(--c-blue)', glucose: 'var(--c-violet)' };
const BP_ORDER = [['normal', 'Normal'], ['elevated', 'Elevated'], ['stage1', 'Stage 1'], ['stage2', 'Stage 2'], ['crisis', 'Crisis']] as const;

export default function PatientPage({ id, overview }: { id: number; overview: Overview | null }) {
  const [tab, setTab] = useState<Tab>('summary');
  const [days, setDays] = useState(14);
  const detail = usePolling<Detail>(() => getPatient(id), 8000, [id]);
  const stats = usePolling<Analytics>(() => getAnalytics(id, days), 30000, [id, days]);
  const d = detail.data, a = stats.data;
  const fromList = overview?.patients.find(p => p.patient_id === id);
  const p = d?.patient || fromList;

  if (!p) return <><a className="back" href="#/patients"><ArrowLeft size={16} />All patients</a>{detail.error ? <div className="alert-box" role="alert">{detail.error}</div> : <div className="card"><Skeleton h={120} /></div>}</>;
  const v = p.vitals;

  return (
    <>
      <a className="back" href="#/patients"><ArrowLeft size={16} />All patients</a>
      {detail.error && <div className="alert-box soft" role="status">Could not refresh ({detail.error}). Showing the last data.</div>}

      <section className="card hero">
        <span className={`avatar xl ${p.group}`}>{initials(p.name)}</span>
        <div className="hero-main">
          <h1>{p.name} <Badge group={p.group} /></h1>
          <p className="meta">{[p.age ? `${p.age} years` : null, p.gender, p.identifier, d?.profile.weight ? `${d.profile.weight} kg` : null, d?.profile.height ? `${d.profile.height} cm` : null].filter(Boolean).join(', ')}</p>
          {p.conditions.length > 0 && <div className="tags">{p.conditions.map(c => <span key={c} className="tag">{c}</span>)}</div>}
          {p.reasons.length > 0 && <div className="tags">{p.reasons.map(r => <span key={r} className="tag warn">{r}</span>)}</div>}
        </div>
        <div className="hero-side"><small>Last reading</small><b>{ago(v.at)}</b>{p.caregivers.length > 0 && <small>Caregivers: {p.caregivers.join(', ')}</small>}</div>
      </section>

      <div className="tabbar">
        <div className="tabs" role="tablist" aria-label="Patient sections">
          {TABS.map(t => (
            <button key={t.v} role="tab" aria-selected={tab === t.v} className="tabbtn" onClick={() => setTab(t.v)}>
              {tab === t.v && <motion.span layoutId="tabline" className="tab-line" transition={{ type: 'spring', stiffness: 400, damping: 34 }} />}
              <t.icon size={16} />{t.label}
            </button>
          ))}
        </div>
        {(tab === 'trends' || tab === 'summary' || tab === 'medication') && <Segmented label="analysis-window" value={days} onChange={setDays} options={[{ v: 7, label: '7d' }, { v: 14, label: '14d' }, { v: 30, label: '30d' }, { v: 90, label: '90d' }]} />}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.22 }}>
          {tab === 'summary' && <Summary id={id} a={a} err={stats.error} d={d} v={v} adherence={p.adherence} />}
          {tab === 'trends' && <Trends a={a} err={stats.error} days={days} d={d} />}
          {tab === 'medication' && <Medication a={a} d={d} />}
          {tab === 'records' && <Records d={d} />}
        </motion.div>
      </AnimatePresence>
    </>
  );
}

// ------------------------------------------------------------------ summary
function Summary({ id, a, err, d, v, adherence }: { id: number; a: Analytics | null; err: string | null; d: Detail | null; v: Detail['patient']['vitals']; adherence: number | null }) {
  const m = a?.metrics;
  const tile = (label: string, value: React.ReactNode, unit: string, block?: MetricBlock) => (
    <Tilt><div className="vt"><span className="vt-l">{label}</span><b>{value}</b><small>{unit}</small>
      {block && <em title="Share of readings inside the reference range">{block.time_in_range}% in range</em>}</div></Tilt>
  );
  return (
    <>
      <div className="grid-vt">
        {tile('Heart rate', v.heart_rate === null ? NA : <CountUp value={v.heart_rate} />, 'bpm', m?.heart_rate)}
        {tile('Oxygen', v.blood_oxygen === null ? NA : <CountUp value={v.blood_oxygen} digits={v.blood_oxygen % 1 ? 1 : 0} suffix="%" />, 'SpO2', m?.blood_oxygen)}
        {tile('Blood pressure', bpText(v.systolic, v.diastolic), 'mmHg', m?.systolic)}
        {tile('Steps today', v.steps === null ? NA : <CountUp value={v.steps} />, 'steps')}
        {tile('Glucose', v.glucose === null ? NA : <CountUp value={v.glucose} />, 'mg/dL', m?.glucose)}
        {tile('Medication taken', adherence === null ? NA : <CountUp value={adherence} suffix="%" />, 'last 7 days')}
      </div>

      <div className="grid-2">
        <section className="card">
          <div className="card-head"><h2><Activity size={18} />Findings</h2>{a && <small>{a.coverage.readings} readings over {a.coverage.days_with_readings} of {a.window_days} days</small>}</div>
          {!a ? (err ? <div className="alert-box" role="alert">{err}</div> : <Skeleton h={140} />) : a.findings.length === 0 ? (
            <Empty icon={<Activity size={26} />} title="Nothing unusual in this window">Readings are inside their reference ranges and no trend is statistically significant.</Empty>
          ) : (
            <ul className="findings">
              {a.findings.map((f, i) => {
                const L = LEVEL[f.level];
                return (
                  <motion.li key={f.title} className={f.level} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}>
                    <span className="f-ic"><L.icon size={18} /></span>
                    <div><b>{f.title}</b><p>{f.evidence}</p></div><em>{L.label}</em>
                  </motion.li>
                );
              })}
            </ul>
          )}
          {a && <details className="method"><summary>How this is calculated</summary><p>{a.method}</p></details>}
        </section>
        <div className="stack">
          {d && d.emergencies.length > 0 && <Emergencies d={d} />}
          <Brief id={id} />
          <Composer id={id} sent={d?.messages || []} />
        </div>
      </div>
    </>
  );
}

function Emergencies({ d }: { d: Detail }) {
  return (
    <section className="card danger"><div className="card-head"><h2><AlertTriangle size={18} />Emergencies</h2></div>
      <ul className="plain">{d.emergencies.slice(0, 4).map(e => {
        const m = safeMap(e.location_url);
        return <li key={e.id}><div><b>{SOS_LABEL[e.status] || e.status}</b><small>{[e.reason, when(e.at)].filter(Boolean).join(', ')}</small></div>{m && <a href={m} target="_blank" rel="noopener noreferrer" aria-label="Open live location"><MapPin size={16} /></a>}</li>;
      })}</ul></section>
  );
}

const FIGURE: Record<string, string> = { avg_hr: 'Mean heart rate', min_hr: 'Lowest heart rate', max_hr: 'Highest heart rate', avg_bp: 'Mean BP', max_systolic: 'Highest systolic', avg_oxygen: 'Mean oxygen', min_oxygen: 'Lowest oxygen', avg_steps: 'Mean steps', adherence: 'Medication taken' };

function Brief({ id }: { id: number }) {
  const [s, setS] = useState<{ loading?: boolean; data?: Brief; error?: string }>({});
  useEffect(() => setS({}), [id]);
  const load = (refresh: boolean) => { setS(x => ({ ...x, loading: true, error: undefined })); getBrief(id, refresh).then(data => setS({ data })).catch(e => setS(x => ({ data: x.data, error: (e as Error).message }))); };
  const d = s.data;
  return (
    <section className="card">
      <div className="card-head"><h2><Sparkles size={18} />Written summary</h2>
        <button className="btn small ghost" disabled={!!s.loading} onClick={() => load(!!d)}>{s.loading ? 'Writing' : d ? 'Refresh' : 'Generate'}</button></div>
      {s.error && <div className="alert-box" role="alert">{s.error}</div>}
      {!d && !s.loading && !s.error && <p className="muted">A short plain-language summary of the last 7 days, generated by an AI model from this patient&apos;s figures. Names and contact details are never sent. The statistics beside it are the source of truth.</p>}
      {d && (<div className="brief"><p>{d.summary}</p>
        {d.flags.length > 0 && <ul>{d.flags.map(f => <li key={f}>{f}</li>)}</ul>}
        {d.suggested_questions.length > 0 && <><h3>Questions to ask</h3><ul>{d.suggested_questions.map(q => <li key={q}>{q}</li>)}</ul></>}
        <div className="tags">{Object.keys(d.figures || {}).filter(k => FIGURE[k]).map(k => <span className="tag" key={k}>{FIGURE[k]}: {String(d.figures![k])}</span>)}</div>
        <small>{d.source === 'ai' ? 'Generated by AI' : 'Plain summary, AI unavailable'}{d.generated_at ? `, ${when(d.generated_at)}` : ''}</small></div>)}
    </section>
  );
}

function Composer({ id, sent }: { id: number; sent: Detail['messages'] }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true); setNote(null);
    try { await sendMessage(id, text.trim()); setText(''); setNote({ ok: true, text: 'Sent. It is on the patient’s phone now.' }); }
    catch (x) { setNote({ ok: false, text: (x as Error).message }); } finally { setBusy(false); }
  };
  return (
    <section className="card">
      <div className="card-head"><h2><Send size={18} />Message the patient</h2></div>
      <form onSubmit={send}>
        <textarea rows={3} maxLength={1000} value={text} onChange={e => setText(e.target.value)} aria-label="Message to the patient" placeholder="Write a short instruction or check-in." />
        <div className="row-end"><small>{text.length}/1000</small><button className="btn primary" disabled={busy || !text.trim()}><Send size={16} />{busy ? 'Sending' : 'Send'}</button></div>
        {note && <div className={`alert-box ${note.ok ? 'ok' : ''}`} role="status">{note.text}</div>}
      </form>
      {sent.length > 0 && <ul className="plain sent">{sent.slice(0, 3).map((m, i) => <li key={i}><div>{m.message}<small>{when(m.at)}</small></div></li>)}</ul>}
    </section>
  );
}

// ------------------------------------------------------------------ trends
function Trends({ a, err, days, d }: { a: Analytics | null; err: string | null; days: number; d: Detail | null }) {
  const [key, setKey] = useState<MetricBlock['key']>('heart_rate');
  if (!a) return err ? <div className="alert-box" role="alert">{err}</div> : <div className="card"><Skeleton h={300} /></div>;
  const keys = (Object.keys(a.metrics) as MetricBlock['key'][]);
  if (keys.length === 0 && !a.steps) return <section className="card"><Empty icon={<Activity size={28} />} title="No readings in this window">When this patient&apos;s phone or watch records heart rate, blood pressure or oxygen, the analysis appears here.</Empty></section>;
  const cur = a.metrics[key] || a.metrics[keys[0]];
  return (
    <>
      {cur && (
        <section className="card">
          <div className="metric-tabs" role="tablist" aria-label="Measure">
            {keys.map(k => <button key={k} role="tab" aria-selected={cur.key === k} className="mtab" onClick={() => setKey(k)}><i style={{ background: COLORS[k] }} />{a.metrics[k]!.label}</button>)}
          </div>
          <div className="card-head"><h2>{cur.label}, {days} days</h2><small>{cur.daily.length} days with readings</small></div>
          <TrendChart key={`${cur.key}-${days}`} block={cur} days={days} color={COLORS[cur.key]} />
          <TrendSentence m={cur} />
          <div className="statgrid">
            {[['Readings', cur.stats.n], ['Mean', cur.stats.mean], ['Median', cur.stats.median], ['Std. deviation', cur.stats.sd], ['Lowest', cur.stats.min], ['Highest', cur.stats.max], ['10th percentile', cur.stats.p10], ['90th percentile', cur.stats.p90]].map(([l, x]) => (
              <div key={String(l)}><small>{l}</small><b>{x}</b></div>
            ))}
            <div><small>In reference range</small><b>{cur.time_in_range}%</b></div>
            <div><small>Variability (CV)</small><b>{cur.stats.cv === null ? NA : `${cur.stats.cv}%`}</b></div>
            {cur.vs_previous && <div><small>vs previous {days} days</small><b>{signed(cur.vs_previous.delta)} {cur.unit}</b></div>}
          </div>
          {cur.outliers.length > 0 && (
            <div className="outliers"><h3>Unusual readings</h3><p className="muted">Far from this patient&apos;s own typical value (modified z-score above 3.5). Worth checking against what they were doing.</p>
              <ul className="plain">{cur.outliers.map(o => <li key={o.at}><div><b>{o.value} {cur.unit}</b><small>{when(o.at)}, z = {o.z}</small></div></li>)}</ul></div>
          )}
        </section>
      )}
      <div className="grid-2">
        {Object.keys(a.bp_categories).length > 0 && (
          <section className="card"><div className="card-head"><h2>Blood pressure categories</h2><small>AHA/ACC, share of readings</small></div>
            <BpBar cats={a.bp_categories} /></section>
        )}
        {a.steps && (
          <section className="card"><div className="card-head"><h2><Footprints size={18} />Daily steps</h2><small>Mean {Math.round(a.steps.stats.mean).toLocaleString()}, best {a.steps.stats.max.toLocaleString()}</small></div>
            <Bars data={a.steps.daily.slice(-14).map(s => ({ label: shortDay(s.day).split(' ')[0], value: s.steps }))} />
            {a.steps.trend.direction !== 'unknown' && <p className="muted tsent">{a.steps.trend.direction === 'steady' ? `No significant change in daily steps (p = ${a.steps.trend.p}).` : `Steps are ${a.steps.trend.direction}: ${signed(a.steps.trend.change_over_window ?? 0, 0)} over the window (p = ${a.steps.trend.p}).`}</p>}</section>
        )}
      </div>
      {d && d.vitals_series.length > 1 && null}
    </>
  );
}

function TrendSentence({ m }: { m: MetricBlock }) {
  const t = m.trend;
  let text: string;
  if (t.direction === 'unknown') text = t.note || 'Not enough days with readings to fit a trend.';
  else if (t.direction === 'steady') text = `No statistically significant trend. Fitted change ${signed(t.change_over_window ?? 0)} ${m.unit} over the window (p = ${t.p}, R squared ${t.r2}, ${t.days_used} days).`;
  else text = `${t.direction === 'rising' ? 'Rising' : 'Falling'}: ${signed(t.change_over_window ?? 0)} ${m.unit} over the window, ${signed(t.slope_per_day ?? 0, 2)} per day (p = ${t.p}, R squared ${t.r2}, ${t.days_used} days).`;
  return <p className={`tsent ${t.direction}`}><b>Trend.</b> {text}</p>;
}

function BpBar({ cats }: { cats: Record<string, number> }) {
  const total = Object.values(cats).reduce((x, y) => x + y, 0) || 1;
  return (
    <div>
      <div className="stackbar" role="img" aria-label="Blood pressure categories">
        {BP_ORDER.filter(([k]) => cats[k]).map(([k, l], i) => (
          <motion.div key={k} className={`seg-${k}`} initial={{ flexGrow: 0 }} animate={{ flexGrow: cats[k] }} transition={{ delay: i * 0.08, duration: 0.8 }} title={`${l}: ${cats[k]}`}>{Math.round((cats[k] / total) * 100) >= 9 ? `${Math.round((cats[k] / total) * 100)}%` : ''}</motion.div>
        ))}
      </div>
      <ul className="legend2">{BP_ORDER.filter(([k]) => cats[k]).map(([k, l]) => <li key={k}><i className={`seg-${k}`} />{l} <b>{cats[k]}</b></li>)}</ul>
      <p className="muted">{total} readings. Normal below 120/80, elevated 120 to 129, stage 1 from 130/80, stage 2 from 140/90, crisis from 180/120.</p>
    </div>
  );
}

// ------------------------------------------------------------------ medication
function Medication({ a, d }: { a: Analytics | null; d: Detail | null }) {
  const m = a?.medication;
  if (!a) return <div className="card"><Skeleton h={200} /></div>;
  if (!m) return <section className="card"><Empty icon={<Pill size={28} />} title="No medication schedule">The patient has not set up medicines in the HEWAL3 app.</Empty></section>;
  const change = m.first_half_pct !== null && m.second_half_pct !== null ? m.second_half_pct - m.first_half_pct : null;
  return (
    <>
      <div className="grid-2">
        <section className="card"><div className="card-head"><h2>Doses taken</h2><small>Last {m.daily.length} days</small></div>
          <div className="gauges one"><Gauge value={m.adherence_pct} label="Taken" sub={change === null ? 'Share of scheduled doses logged as taken' : `Second half of the window ${signed(change, 0)} points against the first half`} /></div>
          <AdherenceGrid days={m.daily} />
          <ul className="legend2"><li><i className="a-full" />All taken</li><li><i className="a-part" />Half or more</li><li><i className="a-low" />Some</li><li><i className="a-none" />None</li></ul>
        </section>
        <section className="card"><div className="card-head"><h2>By time of day</h2><small>Share taken at each scheduled time</small></div>
          <Bars unit="%" data={m.by_time.map(t => ({ label: t.time, value: t.taken_pct, tone: t.taken_pct < 80 ? 'warn' : '' }))} />
          {m.weakest_time && <p className="muted tsent">The {m.weakest_time.time} dose is the one most often missed ({m.weakest_time.taken_pct}%). A reminder or a change of time may help.</p>}
          <h3>Prescribed</h3>
          <ul className="plain">{m.medicines.map(x => <li key={x.name}><div><b>{x.name}{x.dose ? `, ${x.dose}` : ''}</b><small>{x.times.join(', ')}</small></div></li>)}</ul>
        </section>
      </div>
      {d && d.medications.length > 0 && (
        <section className="card"><div className="card-head"><h2>Today</h2></div>
          <ul className="plain">{d.medications.map(x => <li key={x.name}><div><b>{x.name}</b><div className="tags">{x.doses.map(z => <span key={z.time} className={`tag ${z.taken ? 'good' : ''}`}>{z.time} {z.taken ? 'taken' : 'not yet'}</span>)}</div></div></li>)}</ul></section>
      )}
    </>
  );
}

// ------------------------------------------------------------------ records
function Records({ d }: { d: Detail | null }) {
  if (!d) return <div className="card"><Skeleton h={200} /></div>;
  return (
    <div className="grid-2">
      <section className="card"><div className="card-head"><h2><UtensilsCrossed size={18} />Recent meals</h2></div>
        {d.meals.length === 0 ? <p className="muted">No meals logged.</p> : <ul className="plain">{d.meals.map((m, i) => <li key={i}><div><b>{(m.meal || 'Meal') + (m.score !== null ? `, score ${m.score}` : '')}</b><small>{(m.summary || 'No analysis') + (m.at ? `, ${when(m.at)}` : '')}</small></div></li>)}</ul>}</section>
      <section className="card"><div className="card-head"><h2><AlertTriangle size={18} />Emergency history</h2></div>
        {d.emergencies.length === 0 ? <p className="muted">No emergencies recorded.</p> : <ul className="plain">{d.emergencies.map(e => <li key={e.id}><div><b>{SOS_LABEL[e.status] || e.status}</b><small>{[e.reason, when(e.at)].filter(Boolean).join(', ')}</small></div></li>)}</ul>}</section>
      <section className="card"><div className="card-head"><h2>Profile</h2></div>
        <ul className="plain">
          <li><div><b>Family history</b><small>{d.profile.family_history.length ? d.profile.family_history.join(', ') : 'None recorded'}</small></div></li>
          <li><div><b>Emergency contact</b><small>{d.profile.emergency_contact || 'None recorded'}</small></div></li>
        </ul></section>
    </div>
  );
}
