import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bell, ChevronDown, LogOut, Menu, Search, UserCog } from 'lucide-react';
import type { DoctorInfo } from './types';
import { ThemeToggle } from './theme';
import { initials } from './util';

/** Top right corner: who is signed in, with a menu for the profile, the colour theme and signing out. */
export default function TopBar({ doctor, signOut, notes = [], onMenu, menuOpen = false }: { doctor: DoctorInfo; signOut: () => void; notes?: { text: string; href: string }[]; onMenu?: () => void; menuOpen?: boolean }) {
  const [bell, setBell] = useState(false);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [open]);
  useEffect(() => { const f = () => setOpen(false); window.addEventListener('hashchange', f); return () => window.removeEventListener('hashchange', f); }, []);

  const sub = [doctor.specialization, doctor.hospital].filter(Boolean).join(', ');
  return (
    <div className="topbar">
      {onMenu && <button type="button" className="icon-btn hamburger" onClick={onMenu} aria-label={menuOpen ? 'Close the menu' : 'Open the menu'} aria-expanded={menuOpen} aria-controls="side-nav"><Menu size={20} /></button>}
      <button type="button" className="search-btn" onClick={() => window.dispatchEvent(new Event('open-palette'))} aria-label="Search patients and pages"><Search size={16} /><span>Search</span><kbd>Ctrl K</kbd></button>
      <div className="bell-wrap">
        <button type="button" className="icon-btn bell" aria-label={`Notifications, ${notes.length}`} aria-expanded={bell} onClick={() => setBell(b => !b)}><Bell size={18} />{notes.length > 0 && <em className="count">{notes.length}</em>}</button>
        {bell && <div className="menu notes-menu" role="menu">{notes.length === 0 ? <p className="muted" style={{ padding: 14 }}>Nothing needs you right now.</p> : notes.map((n, i) => <a key={i} role="menuitem" className="menu-item" href={n.href} onClick={() => setBell(false)}>{n.text}</a>)}</div>}
      </div>
      <ThemeToggle />
      <div className="profile-menu" ref={box}>
        <button className="profile-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(o => !o)}>
          <span className="avatar">{initials(doctor.full_name)}</span>
          <span className="profile-name"><b>{doctor.full_name}</b><small>{doctor.doctor_id}</small></span>
          <ChevronDown size={16} className={open ? 'flip' : ''} />
        </button>
        <AnimatePresence>
          {open && (
            <motion.div className="menu" role="menu" initial={{ opacity: 0, y: -8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.16 }}>
              <div className="menu-head"><span className="avatar lg">{initials(doctor.full_name)}</span><div><b>{doctor.full_name}</b><small>{sub || 'Add your specialty in your profile'}</small><small>Doctor ID {doctor.doctor_id}</small></div></div>
              <a role="menuitem" className="menu-item" href="#/profile"><UserCog size={17} />My profile and password</a>
              <button role="menuitem" className="menu-item danger" onClick={signOut}><LogOut size={17} />Sign out</button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
