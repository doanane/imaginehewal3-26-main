import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Appointment, getAppointments } from './api';
import { usePolling } from './util';

const MODE: Record<string, string> = { in_person: 'In person', video: 'Video', phone: 'Phone' };
const hm = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const initials = (n?: string | null) => (n || '?').replace(/\s*\(.*?\)/g, '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

/** The right-hand column: a month calendar with a dot on every day that has an appointment, then what is coming and what just happened. */
export default function Rail() {
  const up = usePolling(() => getAppointments('upcoming'), 60000, []);
  const past = usePolling(() => getAppointments('past'), 120000, []);
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const all: Appointment[] = useMemo(() => [...(up.data?.appointments || []), ...(past.data?.appointments || [])].filter(a => a.status !== 'cancelled' && a.status !== 'declined'), [up.data, past.data]);
  const busy = useMemo(() => new Set(all.map(a => dayKey(new Date(a.starts_at)))), [all]);

  const first = (month.getDay() + 6) % 7;                          // Monday first
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const today = dayKey(new Date());
  const title = month.toLocaleDateString([], { month: 'long', year: 'numeric' });

  const now = Date.now();
  const coming = (up.data?.appointments || []).filter(a => a.status === 'confirmed' && new Date(a.starts_at).getTime() >= now - 30 * 60000).slice(0, 5);
  const before = (past.data?.appointments || []).filter(a => a.status === 'completed').slice(0, 4);
  const todayCount = coming.filter(a => dayKey(new Date(a.starts_at)) === today).length;

  return (
    <aside className="rail" aria-label="Calendar and appointments">
      <section className="card rail-cal">
        <div className="rail-head">
          <h2>{title}</h2>
          <span>
            <button type="button" className="icon-btn" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={18} /></button>
            <button type="button" className="icon-btn" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={18} /></button>
          </span>
        </div>
        <div className="cal-grid" role="grid">
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((w, i) => <span key={i} className="cal-dow" aria-hidden>{w}</span>)}
          {cells.map((n, i) => {
            if (n === null) return <span key={i} />;
            const k = dayKey(new Date(month.getFullYear(), month.getMonth(), n));
            return <span key={i} className={`cal-day ${k === today ? 'today' : ''} ${busy.has(k) ? 'busy' : ''}`} aria-label={`${n}${busy.has(k) ? ', has appointments' : ''}`}>{n}</span>;
          })}
        </div>
      </section>

      <section className="card rail-list">
        <div className="rail-head"><h2>Upcoming</h2>{todayCount > 0 && <em className="rail-tag">{todayCount} today</em>}</div>
        {coming.length === 0 ? <p className="muted">Nothing confirmed ahead.</p> : (
          <ul>{coming.map(a => (
            <li key={a.id}><a href={`#/patient/${a.patient_id}`} className="rail-item">
              <span className="rail-bar" aria-hidden />
              <span className="rail-who"><b>{a.patient || 'Patient'}</b><small>{new Date(a.starts_at).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}, {hm(a.starts_at)}</small></span>
              <small className="rail-meta">{a.duration_min} min<br />{MODE[a.mode]}</small>
            </a></li>
          ))}</ul>
        )}
      </section>

      <section className="card rail-list">
        <div className="rail-head"><h2>Previous</h2></div>
        {before.length === 0 ? <p className="muted">No completed visits yet.</p> : (
          <ul>{before.map(a => (
            <li key={a.id}><a href={`#/patient/${a.patient_id}`} className="rail-item done">
              <span className="avatar">{initials(a.patient)}</span>
              <span className="rail-who"><b>{a.patient || 'Patient'}</b><small>{new Date(a.starts_at).toLocaleDateString([], { day: 'numeric', month: 'short' })}, {hm(a.starts_at)}</small></span>
              <small className="rail-meta">{a.reason || MODE[a.mode]}</small>
            </a></li>
          ))}</ul>
        )}
      </section>
    </aside>
  );
}
