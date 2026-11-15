import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, FileText, LayoutDashboard, MessageSquare, Search, Siren, Users } from 'lucide-react';
import type { Overview } from './types';

const PAGES = [
  { label: 'Today', href: '#/', icon: LayoutDashboard }, { label: 'Schedule', href: '#/schedule', icon: CalendarDays },
  { label: 'Patients', href: '#/patients', icon: Users }, { label: 'Messages', href: '#/messages', icon: MessageSquare },
  { label: 'Documents', href: '#/documents', icon: FileText }, { label: 'Emergencies', href: '#/alerts', icon: Siren },
];

/** Ctrl or Cmd + K: jump to any patient or page by typing. */
export default function CommandPalette({ overview }: { overview: Overview | null }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [i, setI] = useState(0);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setOpen(o => !o); setQ(''); setI(0); }
      else if (e.key === 'Escape') setOpen(false);
    };
    const o = () => { setOpen(true); setQ(''); setI(0); };
    window.addEventListener('keydown', k); window.addEventListener('open-palette', o);
    return () => { window.removeEventListener('keydown', k); window.removeEventListener('open-palette', o); };
  }, []);
  useEffect(() => { if (open) window.setTimeout(() => input.current?.focus(), 30); }, [open]);
  const items = useMemo(() => {
    const t = q.trim().toLowerCase();
    const pats = (overview?.patients || []).filter(p => !t || p.name.toLowerCase().includes(t) || (p.identifier || '').toLowerCase().includes(t) || p.conditions.some(c => c.toLowerCase().includes(t)))
      .slice(0, 8).map(p => ({ label: p.name, sub: [p.age ? `${p.age} yrs` : '', p.conditions.slice(0, 2).join(', ')].filter(Boolean).join(', '), href: `#/patient/${p.patient_id}`, icon: Users }));
    const pages = PAGES.filter(p => !t || p.label.toLowerCase().includes(t)).map(p => ({ ...p, sub: 'Page' }));
    return [...pats, ...pages];
  }, [q, overview]);
  if (!open) return null;
  const go = (href: string) => { window.location.hash = href; setOpen(false); };
  return (
    <div className="modal palette" role="dialog" aria-modal="true" aria-label="Search" onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="palette-card">
        <div className="field"><Search size={17} /><input ref={input} value={q} placeholder="Search patients, conditions or pages" aria-label="Search"
          onChange={e => { setQ(e.target.value); setI(0); }}
          onKeyDown={e => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setI(x => Math.min(x + 1, items.length - 1)); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); setI(x => Math.max(x - 1, 0)); }
            else if (e.key === 'Enter' && items[i]) go(items[i].href);
          }} /></div>
        <ul role="listbox">
          {items.length === 0 && <li className="muted pal-empty">Nothing matches.</li>}
          {items.map((x, n) => <li key={x.href + x.label} role="option" aria-selected={n === i}><button type="button" className={n === i ? 'on' : ''} onMouseEnter={() => setI(n)} onClick={() => go(x.href)}><x.icon size={16} /><b>{x.label}</b><small>{x.sub}</small></button></li>)}
        </ul>
        <small className="pal-foot">Up and down to move, Enter to open, Esc to close</small>
      </div>
    </div>
  );
}
