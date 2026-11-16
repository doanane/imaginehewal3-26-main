import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, CheckCheck, MessageSquare, Phone, Send, Video } from 'lucide-react';
import { ChatMessage, getThread, postThread, readThread } from './api';
import { useCalls } from './calls';
import { realtime } from './realtime';

const clock = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');
const dayLabel = (iso: string | null) => {
  if (!iso) return '';
  const d = new Date(iso), t = new Date();
  if (d.toDateString() === t.toDateString()) return 'Today';
  const y = new Date(t.getTime() - 864e5);
  return d.toDateString() === y.toDateString() ? 'Yesterday' : d.toLocaleDateString([], { day: 'numeric', month: 'short' });
};

/** Live chat with one patient. Messages arrive over the websocket the moment the patient sends them, with typing, presence and read receipts. */
export default function ChatPanel({ patientId, name }: { patientId: number; name: string }) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [online, setOnline] = useState(false);
  const [typing, setTyping] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const end = useRef<HTMLDivElement>(null);
  const typingTimer = useRef<number>();
  const wasTyping = useRef(false);
  const peerTimer = useRef<number>();
  const { start, supported } = useCalls();

  const load = useCallback(async () => {
    try {
      const t = await getThread(patientId);
      setMsgs(t.messages); setOnline(t.peer_online); setErr('');
      if (t.messages.some(m => m.sender_role === 'patient' && !m.read_at)) readThread(patientId).catch(() => {});
    } catch (e) { setErr((e as Error).message); } finally { setLoading(false); }
  }, [patientId]);

  useEffect(() => { setLoading(true); setMsgs([]); load(); }, [load]);

  useEffect(() => {
    const offs = [
      realtime.on('doctor_message.new', e => {
        if (e.patient_id !== patientId) return;
        setMsgs(p => p.some(m => m.id === e.message.id) ? p : [...p, e.message]);
        setTyping(false);
        readThread(patientId).catch(() => {});
      }),
      realtime.on('doctor_message.read', e => {
        if (e.patient_id !== patientId) return;
        const now = new Date().toISOString();
        setMsgs(p => p.map(m => (m.sender_role === 'doctor' && !m.read_at ? { ...m, read_at: now } : m)));
      }),
      realtime.on('typing', e => {
        if (e.from_user_id !== patientId) return;
        setTyping(!!e.is_typing);
        window.clearTimeout(peerTimer.current);
        if (e.is_typing) peerTimer.current = window.setTimeout(() => setTyping(false), 5000);
      }),
      realtime.on('presence', e => { if (e.user_id === patientId) setOnline(!!e.online); }),
      realtime.onStatus(up => { if (up) load(); }),                 // catch up after a dropped connection
    ];
    return () => { offs.forEach(o => o()); window.clearTimeout(typingTimer.current); window.clearTimeout(peerTimer.current); };
  }, [patientId, load]);

  useEffect(() => { end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs.length, typing]);

  const onChange = (v: string) => {
    setText(v);
    if (!wasTyping.current && v) { wasTyping.current = true; realtime.send({ type: 'typing', to_user_id: patientId, is_typing: true }); }
    window.clearTimeout(typingTimer.current);
    typingTimer.current = window.setTimeout(() => { wasTyping.current = false; realtime.send({ type: 'typing', to_user_id: patientId, is_typing: false }); }, 2000);
  };

  const send = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true); setText(''); setErr('');
    wasTyping.current = false; realtime.send({ type: 'typing', to_user_id: patientId, is_typing: false });
    const temp: ChatMessage = { id: -Date.now(), sender_role: 'doctor', content: body, created_at: new Date().toISOString(), read_at: null };
    setMsgs(p => [...p, temp]);
    try { const saved = await postThread(patientId, body); setMsgs(p => p.map(m => (m.id === temp.id ? saved : m))); }
    catch (x) { setMsgs(p => p.filter(m => m.id !== temp.id)); setText(body); setErr((x as Error).message); }
    finally { setBusy(false); }
  };

  const callBtn = (media: 'audio' | 'video') => (
    <button className="btn ghost sm" disabled={!supported || !online} onClick={() => start(patientId, name, media)}
      aria-label={`${media === 'video' ? 'Video' : 'Voice'} call ${name}`} title={!online ? 'The patient is offline' : !supported ? 'Calls need a modern browser over HTTPS' : undefined}>
      {media === 'video' ? <Video size={16} /> : <Phone size={16} />}{media === 'video' ? 'Video' : 'Call'}
    </button>
  );

  let lastDay = '';
  return (
    <section className="card chat">
      <div className="card-head">
        <h2><MessageSquare size={18} />{name ? `Chat with ${name.split(" ")[0]}` : "Chat"}</h2>
        <div className="chat-tools"><span className={`presence ${online ? 'on' : ''}`}>{online ? 'Online' : 'Offline'}</span>{callBtn('audio')}{callBtn('video')}</div>
      </div>
      <div className="chat-log" role="log" aria-live="polite" aria-label="Messages">
        {loading ? <p className="muted">Loading messages</p> : msgs.length === 0 ? <p className="muted">No messages yet. Anything you send arrives on their phone instantly.</p> : msgs.map(m => {
          const d = dayLabel(m.created_at); const head = d !== lastDay; lastDay = d;
          const mine = m.sender_role === 'doctor';
          return (
            <React.Fragment key={m.id}>
              {head && <div className="chat-day">{d}</div>}
              <motion.div className={`bubble ${mine ? 'mine' : ''}`} initial={{ opacity: 0, y: 8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.2 }}>
                <p>{m.content}</p>
                <small>{m.id < 0 ? 'Sending' : clock(m.created_at)}{mine && m.id > 0 && (m.read_at ? <CheckCheck size={13} aria-label="Read" /> : <Check size={13} aria-label="Delivered" />)}</small>
              </motion.div>
            </React.Fragment>
          );
        })}
        <AnimatePresence>{typing && <motion.div className="bubble typing" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} aria-label={`${name} is typing`}><i /><i /><i /></motion.div>}</AnimatePresence>
        <div ref={end} />
      </div>
      {err && <div className="alert-box" role="alert">{err}</div>}
      <form className="chat-form" onSubmit={send}>
        <textarea rows={1} maxLength={1000} value={text} onChange={e => onChange(e.target.value)} aria-label={`Message to ${name}`} placeholder="Write a message"
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }} />
        <button className="btn primary" disabled={busy || !text.trim()} aria-label="Send message"><Send size={16} /></button>
      </form>
    </section>
  );
}
