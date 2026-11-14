import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { Activity, LayoutDashboard, LogOut, Siren, Users, WifiOff } from 'lucide-react';
import { getOverview, loadSession, saveSession, setExpiredHandler, Session } from './api';
import Login from './Login';
import OverviewPage from './OverviewPage';
import PatientsPage from './PatientsPage';
import PatientPage from './PatientPage';
import AlertsPage from './AlertsPage';
import type { Overview } from './types';
import { initials, useHashRoute, usePolling } from './util';

const NAV = [
  { href: '#/', label: 'Overview', icon: LayoutDashboard, match: (r: string) => r === '#/' || r === '' },
  { href: '#/patients', label: 'Patients', icon: Users, match: (r: string) => r.startsWith('#/patients') || r.startsWith('#/patient/') },
  { href: '#/alerts', label: 'Emergencies', icon: Siren, match: (r: string) => r.startsWith('#/alerts') },
];

export default function App() {
  const [session, setSession] = useState<Session | null>(loadSession());
  const [notice, setNotice] = useState('');
  const route = useHashRoute();

  const signOut = useCallback((expired = false) => {
    saveSession(null); setSession(null); setNotice(expired ? 'Your session ended. Please sign in again.' : '');
    window.location.hash = '#/';
  }, []);
  useEffect(() => { setExpiredHandler(() => signOut(true)); }, [signOut]);

  return (
    <MotionConfig reducedMotion="user">
      {session ? <Shell session={session} route={route} signOut={() => signOut(false)} /> : <Login notice={notice} onSignedIn={s => { setNotice(''); setSession(s); }} />}
    </MotionConfig>
  );
}

function Shell({ session, route, signOut }: { session: Session; route: string; signOut: () => void }) {
  // one shared, always fresh copy of the doctor's panel; every page reads from it so they never disagree
  const { data, error, online, updated } = usePolling<Overview>(getOverview, 5000, []);
  const d = session.doctor;
  const patient = /^#\/patient\/(\d+)/.exec(route);
  const pageKey = patient ? `p${patient[1]}` : route.split('?')[0];
  const alerts = data?.stats.active_alerts ?? 0;

  let page: React.ReactNode;
  if (patient) page = <PatientPage id={Number(patient[1])} overview={data} />;
  else if (route.startsWith('#/patients')) page = <PatientsPage overview={data} error={error} />;
  else if (route.startsWith('#/alerts')) page = <AlertsPage overview={data} />;
  else page = <OverviewPage overview={data} error={error} />;

  return (
    <div className="shell">
      <aside className="side">
        <a className="brand-row" href="#/"><span className="logo-mark"><Activity size={20} strokeWidth={2.4} /></span><span className="brand-name">HEWAL3</span></a>
        <nav aria-label="Main">
          {NAV.map(n => {
            const active = n.match(route);
            return (
              <a key={n.href} href={n.href} className={`nav ${active ? 'on' : ''}`} aria-current={active ? 'page' : undefined}>
                {active && <motion.span layoutId="nav-pill" className="nav-pill" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                <n.icon size={19} /><span>{n.label}</span>
                {n.label === 'Emergencies' && alerts > 0 && <em className="count" aria-label={`${alerts} active`}>{alerts}</em>}
              </a>
            );
          })}
        </nav>
        <div className="side-foot">
          <div className={`live ${online ? '' : 'off'}`} aria-live="polite">
            {online ? <span className="pulse" /> : <WifiOff size={14} />}
            {online ? `Live${updated ? `, ${updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}` : 'Offline, retrying'}
          </div>
          <div className="me">
            <span className="avatar">{initials(d.full_name)}</span>
            <div><b>{d.full_name}</b><small>{[d.specialization, d.hospital].filter(Boolean).join(', ') || d.doctor_id}</small></div>
          </div>
          <button className="btn ghost wide" onClick={signOut}><LogOut size={16} />Sign out</button>
        </div>
      </aside>
      <main className="main" id="content">
        <AnimatePresence mode="wait">
          <motion.div key={pageKey} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
            {page}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
