import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { Activity, BarChart3, CalendarDays, LayoutDashboard, LogOut, Siren, Users, WifiOff } from 'lucide-react';
import { getAppointments, getInbox, getOverview, Profile, loadSession, saveSession, setExpiredHandler, Session } from './api';
import Login from './Login';
import OverviewPage from './OverviewPage';
import PatientsPage from './PatientsPage';
import PatientPage from './PatientPage';
import AlertsPage from './AlertsPage';
import ProfilePage from './ProfilePage';
import AppointmentsPage from './AppointmentsPage';
import ImpactPage from './ImpactPage';
import TopBar from './TopBar';
import { CallProvider } from './calls';
import { realtime } from './realtime';
import type { Overview } from './types';
import { initials, useHashRoute, usePolling } from './util';

const NAV = [
  { href: '#/', label: 'Overview', icon: LayoutDashboard, match: (r: string) => r === '#/' || r === '' },
  { href: '#/patients', label: 'Patients', icon: Users, match: (r: string) => r.startsWith('#/patients') || r.startsWith('#/patient/') },
  { href: '#/appointments', label: 'Appointments', icon: CalendarDays, match: (r: string) => r.startsWith('#/appointments') },
  { href: '#/impact', label: 'Impact', icon: BarChart3, match: (r: string) => r.startsWith('#/impact') },
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
      {session ? <CallProvider><Shell session={session} route={route} signOut={() => signOut(false)} onProfile={p => { const s = { ...session, doctor: { ...session.doctor, full_name: p.full_name, specialization: p.specialization, hospital: p.hospital } }; saveSession(s); setSession(s); }} /></CallProvider> : <Login notice={notice} onSignedIn={s => { setNotice(''); setSession(s); }} />}
    </MotionConfig>
  );
}

function Shell({ session, route, signOut, onProfile }: { session: Session; route: string; signOut: () => void; onProfile: (p: Profile) => void }) {
  // one shared, always fresh copy of the doctor's panel; every page reads from it so they never disagree
  const { data, error, online, updated, reload } = usePolling<Overview>(getOverview, 30000, []);   // the websocket pushes changes; this is the safety net
  const [live, setLive] = useState(false);
  const [unread, setUnread] = useState<Record<string, number>>({});
  const [toast, setToast] = useState('');
  const [requests, setRequests] = useState(0);
  const refreshRequests = useCallback(() => { getAppointments('upcoming').then(r => setRequests(r.appointments.filter(x => x.status === 'requested').length)).catch(() => {}); }, []);
  const refreshInbox = useCallback(() => { getInbox().then(i => setUnread(i.unread)).catch(() => {}); }, []);
  useEffect(() => {
    realtime.start(session.token);
    const offs = [
      realtime.onStatus(up => { setLive(up); if (up) { reload(); refreshInbox(); } }),
      realtime.on('care.refresh', () => reload()),
      realtime.on('appointment.update', e => {
        refreshRequests();
        if (e.appointment?.status === 'requested') { setToast(`${e.appointment.patient || 'A patient'} asked for an appointment`); window.setTimeout(() => setToast(''), 5000); }
      }),
      realtime.on('presence', () => reload()),
      realtime.on('doctor_message.new', e => {
        if (new RegExp(`^#/patient/${e.patient_id}\b`).test(window.location.hash)) return;   // already reading this chat
        setUnread(u => ({ ...u, [e.patient_id]: (u[e.patient_id] || 0) + 1 }));
        setToast(`New message from ${e.patient_name || 'a patient'}`);
        window.setTimeout(() => setToast(''), 5000);
      }),
    ];
    refreshInbox(); refreshRequests();
    return () => { offs.forEach(o => o()); realtime.stop(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.token]);
  useEffect(() => { if (patient) setUnread(u => { if (!u[patient[1]]) return u; const n = { ...u }; delete n[patient[1]]; return n; }); });
  const unreadTotal = Object.values(unread).reduce((a, b) => a + b, 0);
  const d = session.doctor;
  const patient = /^#\/patient\/(\d+)/.exec(route);
  const pageKey = patient ? `p${patient[1]}` : route.split('?')[0];
  const alerts = data?.stats.active_alerts ?? 0;

  let page: React.ReactNode;
  if (patient) page = <PatientPage id={Number(patient[1])} overview={data} />;
  else if (route.startsWith('#/patients')) page = <PatientsPage overview={data} error={error} unread={unread} />;
  else if (route.startsWith('#/alerts')) page = <AlertsPage overview={data} />;
  else if (route.startsWith('#/appointments')) page = <AppointmentsPage />;
  else if (route.startsWith('#/impact')) page = <ImpactPage />;
  else if (route.startsWith('#/profile')) page = <ProfilePage onSaved={onProfile} />;
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
                {n.label === 'Patients' && unreadTotal > 0 && <em className="count msg" aria-label={`${unreadTotal} unread messages`}>{unreadTotal}</em>}
                {n.label === 'Appointments' && requests > 0 && <em className="count msg" aria-label={`${requests} requests waiting`}>{requests}</em>}
                {n.label === 'Emergencies' && alerts > 0 && <em className="count" aria-label={`${alerts} active`}>{alerts}</em>}
              </a>
            );
          })}
        </nav>
        <div className="side-foot">
          <div className={`live ${online ? '' : 'off'}`} aria-live="polite">
            {online ? <span className="pulse" /> : <WifiOff size={14} />}
            {!online ? 'Offline, retrying' : live ? 'Live, instant updates' : `Updating every 30 s${updated ? `, ${updated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}`}
          </div>
        </div>
      </aside>
      <main className="main" id="content">
        <TopBar doctor={d} signOut={signOut} />
        <AnimatePresence mode="wait">
          <motion.div key={pageKey} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}>
            {page}
          </motion.div>
        </AnimatePresence>
      </main>
      <AnimatePresence>{toast && <motion.a href="#/patients" className="toast" role="status" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{toast}</motion.a>}</AnimatePresence>
    </div>
  );
}
