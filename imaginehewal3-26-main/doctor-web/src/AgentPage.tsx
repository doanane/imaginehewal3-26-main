import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BellRing, Check, ChevronRight, Eye, GitBranch, Lock, Pause, Play, Send, ShieldCheck, Stethoscope, Target, X } from 'lucide-react';
import { agentQueue, agentReview, agentStory, getPatientAgent } from './api';
import { Empty, Segmented, Skeleton } from './ui';
import { when } from './util';

export interface Trace {
  person: { name?: string | null; age?: number | null; segment?: string | null; region?: string | null };
  state: 'ok' | 'declining' | 'lapse'; missed_days: number;
  sense: { code: string; label: string; value: string; source: string }[];
  decide: { reasons: { code: string; text: string }[]; safety: { hold_level: boolean; note: string | null };
    plan: { text: string | null; smaller: boolean; usual_step: number; next_step: number; unit: string };
    send: { send: boolean; reason?: string; kind?: string; channel?: string }; method: string };
  act: { status: 'send' | 'waiting' | 'nothing_to_do'; channel: string | null; message: string | null; note: string | null; one_tap: { id: string; label: string }[] };
  handoff: { needed: boolean; reasons: { code: string; text: string }[]; to: string | null; note: string };
  measure: { text: string };
  if_wrong?: string[]; limits?: string;
}

const CHANNEL: Record<string, string> = { push: 'Phone notification', in_app: 'Quiet message inside the app', supporter: 'A supporter the person chose' };
const ACT: Record<Trace['act']['status'], { label: string; cls: string }> = {
  send: { label: 'Sends now', cls: 'good' }, waiting: { label: 'Waiting for the right moment', cls: 'warn' }, nothing_to_do: { label: 'Nothing to do', cls: '' },
};
const STATE: Record<Trace['state'], { label: string; cls: string }> = { ok: { label: 'Engaged', cls: 'good' }, declining: { label: 'Slipping', cls: 'warn' }, lapse: { label: 'Lapse noticed', cls: 'bad' } };

/** One pass of the loop for one person: what was sensed, why it chose what it chose, what it did, who looks next, and how it is measured. */
export function LoopView({ t }: { t: Trace }) {
  const st = STATE[t.state], act = ACT[t.act.status];
  const stages = [
    { key: 'sense', icon: <Eye size={18} />, title: 'Sense', sub: 'What it noticed', body: (
      <ul className="lv-list">{t.sense.map(s => <li key={s.code}><span>{s.label}</span><b>{s.value}</b><small>{s.source}</small></li>)}</ul>) },
    { key: 'decide', icon: <GitBranch size={18} />, title: 'Decide', sub: 'Why it chose this', body: (
      <>
        <ul className="lv-why">{t.decide.reasons.map(r => <li key={r.code} className={r.code === 'safety_hold' ? 'warn' : ''}>{r.text}</li>)}</ul>
        {t.decide.plan.text && <p className="lv-plan">{t.decide.plan.text}</p>}
        <p className="lv-method"><ShieldCheck size={14} />{t.decide.method}</p>
      </>) },
    { key: 'act', icon: <Send size={18} />, title: 'Act', sub: 'What it does', body: (
      <>
        <span className={`pill ${act.cls}`}>{act.label}</span>
        {t.act.message && <div className="lv-phone" role="note"><BellRing size={16} /><div><small>HEWAL3{t.act.channel ? `, ${CHANNEL[t.act.channel] || t.act.channel}` : ''}</small><p>{t.act.message}</p></div></div>}
        {t.act.note && <p className="muted small">{t.act.note}</p>}
        {t.act.one_tap.length > 0 && <div className="lv-taps" aria-label="One-tap answers the person can give">{t.act.one_tap.map(o => <span key={o.id}>{o.label}</span>)}</div>}
      </>) },
    { key: 'hand', icon: <Stethoscope size={18} />, title: 'Hand off', sub: 'Where a human steps in', body: (
      <>
        <span className={`pill ${t.handoff.needed ? 'bad' : 'good'}`}>{t.handoff.needed ? `Clinician asked: ${t.handoff.to}` : 'No clinician needed'}</span>
        {t.handoff.reasons.length > 0 && <ul className="lv-why">{t.handoff.reasons.map(r => <li key={r.code} className="warn">{r.text}</li>)}</ul>}
        <p className="muted small">{t.handoff.note}</p>
      </>) },
    { key: 'measure', icon: <Target size={18} />, title: 'Measure', sub: 'Did it work', body: <p>{t.measure.text}<br /><span className="muted small">A check-in within 48 hours of a message counts as the message working.</span></p> },
  ];
  return (
    <div className="loop">
      <div className="loop-top"><b>{t.person.name || 'This person'}</b><span className={`pill ${st.cls}`}>{st.label}{t.missed_days ? `, ${t.missed_days} quiet days` : ''}</span></div>
      <div className="loop-grid">
        {stages.map((s, i) => (
          <motion.section key={s.key} className={`stage s-${s.key}`} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.09, duration: 0.4 }}>
            <header><span className="stage-ic">{s.icon}</span><div><h3>{s.title}</h3><small>{s.sub}</small></div>{i < stages.length - 1 && <ChevronRight className="stage-arrow" size={18} aria-hidden />}</header>
            {s.body}
          </motion.section>
        ))}
      </div>
      {t.if_wrong && (
        <details className="lv-wrong"><summary>What happens if the agent is wrong</summary>
          <ul>{t.if_wrong.map((w, i) => <li key={i}>{w}</li>)}</ul>{t.limits && <p className="muted small">{t.limits}</p>}</details>
      )}
    </div>
  );
}

/** The four-beat story: one person, one moment, replayed with the agent in it. Simulated, and labelled so. */
export function StoryView() {
  const [scenario, setScenario] = useState<'lapse' | 'safety'>('lapse');
  const [d, setD] = useState<any | null>(null);
  const [err, setErr] = useState('');
  const [i, setI] = useState(1);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<number | undefined>();
  useEffect(() => { setD(null); setErr(''); agentStory(scenario).then(setD).catch(e => setErr((e as Error).message)); }, [scenario]);
  useEffect(() => {
    window.clearInterval(timer.current);
    if (!playing || !d) return;
    timer.current = window.setInterval(() => setI(n => (n + 1) % d.moments.length), 4500);
    return () => window.clearInterval(timer.current);
  }, [playing, d]);
  if (err) return <div className="alert-box" role="alert">{err}</div>;
  if (!d) return <div className="card"><Skeleton h={260} /></div>;
  const m = d.moments[i];
  const lapse = d.moments[1].trace as Trace;
  return (
    <div className="story">
      <p className="story-label"><ShieldCheck size={15} />{d.label}</p>
      <div className="beats">
        {d.beats.map((b: any, n: number) => (
          <motion.div key={b.id} className="beat" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: n * 0.1 }}>
            <span>{n + 1}</span><h3>{b.title}</h3><p>{b.text}</p>
          </motion.div>
        ))}
      </div>
      <p className="one-sentence"><small>The one-sentence test</small>{d.one_sentence}</p>

      <section className="card compare">
        <div className="card-head"><h2>The same moment, twice</h2><small>Tuesday, 11:30 in Abu Dhabi</small></div>
        <div className="compare-grid">
          <div className="cmp bad"><h3>Without the agent</h3>
            <div className="lv-phone dim"><BellRing size={16} /><div><small>{d.without_agent.when}</small><p>{d.without_agent.text}</p></div></div>
            <p>{d.without_agent.what_happens}</p><small className="muted">{d.without_agent.note}</small></div>
          <div className="cmp good"><h3>With the agent</h3>
            {lapse.act.message && <div className="lv-phone"><BellRing size={16} /><div><small>HEWAL3, 11:30</small><p>{lapse.act.message}</p></div></div>}
            <p>{scenario === 'safety' ? 'A very high reading came first: the step is held and a clinician is asked to look.' : lapse.decide.plan.text}</p>
            <small className="muted">Chosen because: {lapse.decide.reasons.map(r => r.text).join(' ')}</small></div>
        </div>
      </section>

      <div className="story-controls">
        <Segmented label="story-case" value={scenario} onChange={v => { setScenario(v); setI(1); }} options={[{ v: 'lapse', label: 'An ordinary lapse' }, { v: 'safety', label: 'Safety comes first' }]} />
        <div className="moments" role="tablist" aria-label="Moments in the story">
          {d.moments.map((x: any, n: number) => <button key={x.id} role="tab" aria-selected={i === n} className={`mtab ${i === n ? 'on' : ''}`} onClick={() => { setI(n); setPlaying(false); }}>{x.title}</button>)}
        </div>
        <button type="button" className="btn ghost small" onClick={() => setPlaying(p => !p)} aria-pressed={playing}>{playing ? <Pause size={15} /> : <Play size={15} />}{playing ? 'Pause' : 'Play the story'}</button>
      </div>
      <AnimatePresence mode="wait"><motion.div key={`${scenario}${i}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}><LoopView t={m.trace as Trace} /></motion.div></AnimatePresence>

      <div className="grid-2 story-foot">
        <section className="card"><div className="card-head"><h2><ShieldCheck size={18} />Safeguards</h2></div><ul className="plain">{d.safeguards.map((s: string) => <li key={s}>{s}</li>)}</ul></section>
        <section className="card"><div className="card-head"><h2><Target size={18} />What we measure</h2></div><ul className="plain">{d.measured.map((s: string) => <li key={s}>{s}</li>)}</ul></section>
      </div>
    </div>
  );
}

/** Hand-offs the agent has asked this doctor to review. Habit detail appears only for patients who chose to share it. */
export function QueueView() {
  const [q, setQ] = useState<{ pending: any[]; reviewed: any[] } | null>(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState<number | null>(null);
  const [text, setText] = useState<Record<number, { note: string; message: string }>>({});
  const load = useCallback(() => { agentQueue().then(setQ).catch(e => setErr((e as Error).message)); }, []);
  useEffect(load, [load]);
  const decide = async (id: number, decision: 'approve' | 'override' | 'dismiss') => {
    setBusy(id); setErr('');
    try { const t = text[id] || { note: '', message: '' }; await agentReview(id, decision, t.note, t.message); load(); } catch (e) { setErr((e as Error).message); } finally { setBusy(null); }
  };
  if (!q) return <div className="card"><Skeleton h={160} /></div>;
  return (
    <div className="stack">
      {err && <div className="alert-box" role="alert">{err}</div>}
      <p className="muted">The agent handles an ordinary lapse on its own. It asks you only for a very high reading, or a long silence in someone living with a condition. You can approve, change or dismiss, and message the patient.</p>
      {q.pending.length === 0 ? <section className="card"><Empty icon={<Check size={26} />} title="Nothing waiting for you">The agent has not asked for a review. Hand-offs appear here the moment it does.</Empty></section> : q.pending.map(r => (
        <section className="card handoff" key={r.id}>
          <div className="card-head"><h2><Stethoscope size={18} />{r.patient}</h2>{r.trace.simulated && <span className="pill">Demo</span>}<small>{when(r.created_at)}</small></div>
          {r.trace.hidden && <p className="muted small"><Lock size={13} /> {r.trace.hidden}</p>}
          <ul className="lv-why">{r.trace.handoff.reasons.map((x: any) => <li key={x.code} className="warn">{x.text}</li>)}</ul>
          {r.shared && r.trace.act?.message && <p className="muted small">Message the agent {r.trace.act.status === 'send' ? 'sends' : 'holds'}: “{r.trace.act.message}”</p>}
          <div className="field"><label htmlFor={`n${r.id}`}>Note for the record</label><input id={`n${r.id}`} value={text[r.id]?.note || ''} maxLength={500} onChange={e => setText(t => ({ ...t, [r.id]: { note: e.target.value, message: t[r.id]?.message || '' } }))} /></div>
          <div className="field"><label htmlFor={`m${r.id}`}>Message to the patient (optional)</label><input id={`m${r.id}`} value={text[r.id]?.message || ''} maxLength={500} onChange={e => setText(t => ({ ...t, [r.id]: { note: t[r.id]?.note || '', message: e.target.value } }))} /></div>
          <div className="row-actions">
            <button className="btn primary small" disabled={busy === r.id} onClick={() => decide(r.id, 'approve')}><Check size={15} />Agree</button>
            <button className="btn ghost small" disabled={busy === r.id} onClick={() => decide(r.id, 'override')}>I will handle it</button>
            <button className="btn ghost small" disabled={busy === r.id} onClick={() => decide(r.id, 'dismiss')}><X size={15} />Dismiss</button>
          </div>
        </section>
      ))}
      {q.reviewed.length > 0 && (
        <section className="card"><div className="card-head"><h2>Recently reviewed</h2></div>
          <table className="tbl"><tbody>{q.reviewed.map(r => <tr key={r.id}><td>{r.patient}</td><td><span className="pill">{r.review_status}</span></td><td className="muted">{r.review_note || ''}</td><td className="muted">{when(r.created_at)}</td></tr>)}</tbody></table>
        </section>
      )}
    </div>
  );
}

/** One patient's live loop, for the patient page. */
export function PatientLoop({ id }: { id: number }) {
  const [d, setD] = useState<any | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { setD(null); getPatientAgent(id).then(setD).catch(e => setErr((e as Error).message)); }, [id]);
  if (err) return <div className="alert-box" role="alert">{err}</div>;
  if (!d) return <div className="card"><Skeleton h={220} /></div>;
  if (d.has_plan === false) return <section className="card"><Empty icon={<Eye size={26} />} title="No plan yet">{d.message}</Empty></section>;
  if (d.shared === false) return <section className="card"><Empty icon={<Lock size={26} />} title="Habit detail is not shared with you">{d.hidden} {d.handoff?.needed ? `Safety note: ${d.handoff.reasons[0]?.text}` : 'No safety hand-off is open.'}</Empty></section>;
  return <LoopView t={d as Trace} />;
}

type Tab = 'story' | 'queue';
export default function AgentPage() {
  const [tab, setTab] = useState<Tab>('queue');
  return (
    <>
      <header className="page-head"><div><h1>Care agent</h1><p>It notices when someone goes quiet, acts, and asks you only when it matters. Everything it does is shown here.</p></div></header>
      <section className="card why-agent">
        <div><h3>A chatbot</h3><p>Waits to be asked. Knows nothing until the person types.</p></div>
        <div><h3>This agent</h3><p>Senses real signals on its own, decides with written rules, acts with one fitted message, hands off to you when it matters, and measures whether the person came back.</p></div>
      </section>
      <div className="tabbar"><Segmented label="agent-tab" value={tab} onChange={setTab} options={[{ v: 'queue', label: 'Review queue' }, { v: 'story', label: 'The story' }]} /></div>
      {tab === 'queue' ? <QueueView /> : <StoryView />}
    </>
  );
}
