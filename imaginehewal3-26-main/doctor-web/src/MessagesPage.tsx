import React, { useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';
import ChatPanel from './Chat';
import { getConversations } from './api';
import { realtime } from './realtime';
import { Empty, Skeleton } from './ui';
import { ago, initials, usePolling } from './util';

/** Every conversation in one place, newest first, with the chat beside it. */
export default function MessagesPage({ selected }: { selected: number | null }) {
  const c = usePolling(getConversations, 30000, []);
  const [open, setOpen] = useState<number | null>(selected);
  useEffect(() => { setOpen(selected); }, [selected]);
  useEffect(() => { const a = realtime.on('doctor_message.new', () => c.reload()); const b = realtime.on('doctor_message.read', () => c.reload()); return () => { a(); b(); }; }, []);   // eslint-disable-line react-hooks/exhaustive-deps
  const list = c.data?.conversations || [];
  const cur = list.find(x => x.patient_id === open);

  return (
    <>
      <header className="page-head"><div><h1>Messages</h1><p>{c.data ? (c.data.unread_total ? `${c.data.unread_total} unread` : 'You are up to date') : ''}</p></div></header>
      <div className="msg-layout">
        <section className="card msg-list" aria-label="Conversations">
          {!c.data ? <Skeleton h={200} /> : list.length === 0 ? <Empty icon={<MessageSquare size={26} />} title="No conversations yet">When a patient writes to you, it appears here.</Empty> : (
            <ul className="plain">
              {list.map(x => (
                <li key={x.patient_id} className={x.patient_id === open ? 'on' : ''}>
                  <button type="button" onClick={() => { setOpen(x.patient_id); window.history.replaceState(null, '', `#/messages/${x.patient_id}`); }}>
                    <span className="avatar">{initials(x.patient)}</span>
                    <div><b>{x.patient}{x.online && <i className="dot-on" aria-label="online" />}</b><small>{x.from === 'doctor' ? 'You: ' : ''}{x.last}</small></div>
                    <span className="msg-meta"><small>{x.at ? ago(x.at) : ''}</small>{x.unread > 0 && <em className="count msg">{x.unread}</em>}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card msg-chat">
          {open && cur ? <ChatPanel key={open} patientId={open} name={cur.patient} /> : <Empty icon={<MessageSquare size={26} />} title="Choose a conversation">Pick a patient on the left.</Empty>}
        </section>
      </div>
    </>
  );
}
