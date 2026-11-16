import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { Activity, BarChart3, Bot, CalendarClock, CalendarDays, FileText, HeartPulse, LayoutDashboard, MessageSquare, Siren, Users, WifiOff } from 'lucide-react';
import { getAppointments, getInbox, getOverview, Profile, loadSession, saveSession, setExpiredHandler, Session } from './api';
import Login from './Login';
import OverviewPage from './OverviewPage';
import PatientsPage from './PatientsPage';
import PatientPage from './PatientPage';
import AlertsPage from './AlertsPage';
import ProfilePage from './ProfilePage';
import AppointmentsPage from './AppointmentsPage';
import TodayPage from './TodayPage';
import SchedulePage from './SchedulePage';
import MessagesPage from './MessagesPage';
import DocumentsPage from './DocumentsPage';
import ConsultPage from './ConsultPage';
import VerifyPage from './VerifyPage';
import CommandPalette from './CommandPalette';
import { PrintDoc, PrintRx } from './PrintDoc';
import ImpactPage from './ImpactPage';
import AgentPage from './AgentPage';
import StoryPage from './StoryPage';
import TopBar from './TopBar';
import Logo from './Logo';
import { CallProvider } from './calls';
import { realtime } from './realtime';
import type { Overview } from './types';
import { initials, useHashRoute, usePolling } from './util';

const NAV = [
  { href: '#/', label: 'Today', icon: LayoutDashboard, match: (r: string) => r === '#/' || r === '' || r.startsWith('#/consult/') },
  { href: '#/schedule', label: 'Schedule', icon: CalendarClock, match: (r: string) => r.startsWith('#/schedule') },
  { href: '#/patients', label: 'Patients', icon: Users, match: (r: string) => r.startsWith('#/patients') || r.startsWith('#/patient/') },
  { href: '#/messages', label: 'Messages', icon: MessageSquare, match: (r: string) => r.startsWith('#/messages') },
  { href: '#/appointments', label: 'Appointments', icon: CalendarDays, match: (r: string) => r.startsWith('#/appointments') },
  { href: '#/documents', label: 'Documents', icon: FileText, match: (r: string) => r.startsWith('#/documents') || r.startsWith('#/doc/') || r.startsWith('#/rx/') },
  { href: '#/panel', label: 'Panel health', icon: HeartPulse, match: (r: string) => r.startsWith('#/panel') },
  { href: '#/agent', label: 'Care agent', icon: Bot, match: (r: string) => r.startsWith('#/agent') },
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

  if (/^#\/story\/?$/.test(route)) return <MotionConfig reducedMotion="user"><StoryPage /></MotionConfig>;      // the story is public: judges can watch it with no sign-in
  const pub = /^#\/verify\/?(.*)$/.exec(route);          // the check page works without signing in
  if (pub) return <MotionConfig reducedMotion="user"><VerifyPage initial={decodeURIComponent(pub[1] || '')} /></MotionConfig>;
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
  // Menu: on a wide screen it collapses to icons (remembered); on a narrow one it slides in over the page.
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem('hw_side_collapsed') === '1'; } catch { return false; } });
  const [drawer, setDrawer] = useState(false);
  const narrow = () => window.matchMedia('(max-width: 1000px)').matches;
  const toggleMenu = () => { if (narrow()) setDrawer(o => !o); else setCollapsed(c => { const n = !c; try { localStorage.setItem('hw_side_collapsed', n ? '1' : '0'); } catch { /* storage unavailable */ } return n; }); };
  useEffect(() => { setDrawer(false); }, [route]);
  useEffect(() => { if (!drawer) return; const f = (e: KeyboardEvent) => { if (e.key === 'Escape') setDrawer(false); }; document.addEventListener('keydown', f); return () => document.removeEventListener('keydown', f); }, [drawer]);
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
        if (new RegExp(`^#/(patient|messages)/${e.patient_id}(\\b|$)`).test(window.location.hash)) return;   // already reading this chat
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
  const pageKey = patient ? `p${patient[1]}` : route.startsWith('#/messages') ? '#/messages' : route.split('?')[0];
  const alerts = data?.stats.active_alerts ?? 0;

  const consult = /^#\/consult\/(\d+)/.exec(route);
  const doc = /^#\/doc\/(\d+)/.exec(route);
  const rx = /^#\/rx\/(\d+)/.exec(route);
  const chat = /^#\/messages\/(\d+)/.exec(route);
  useEffect(() => { if (chat) setUnread(u => { if (!u[chat[1]]) return u; const n = { ...u }; delete n[chat[1]]; return n; }); });
  const notes = [
    ...(alerts > 0 ? [{ text: `${alerts} open emergenc${alerts === 1 ? 'y' : 'ies'}`, href: '#/alerts' }] : []),
    ...(requests > 0 ? [{ text: `${requests} appointment request${requests === 1 ? '' : 's'} waiting`, href: '#/appointments' }] : []),
    ...(unreadTotal > 0 ? [{ text: `${unreadTotal} unread message${unreadTotal === 1 ? '' : 's'}`, href: '#/messages' }] : []),
  ];

  let page: React.ReactNode;
  if (consult) page = <ConsultPage id={Number(consult[1])} />;
  else if (doc) page = <PrintDoc id={Number(doc[1])} />;
  else if (rx) page = <PrintRx patientId={Number(rx[1])} doctor={d} />;
  else if (route.startsWith('#/schedule')) page = <SchedulePage overview={data} />;
  else if (route.startsWith('#/messages')) page = <MessagesPage selected={chat ? Number(chat[1]) : null} />;
  else if (route.startsWith('#/documents')) page = <DocumentsPage overview={data} />;
  else if (route.startsWith('#/panel')) page = <OverviewPage overview={data} error={error} />;
  else if (patient) page = <PatientPage id={Number(patient[1])} overview={data} />;
  else if (route.startsWith('#/patients')) page = <PatientsPage overview={data} error={error} unread={unread} />;
  else if (route.startsWith('#/alerts')) page = <AlertsPage overview={data} />;
  else if (route.startsWith('#/appointments')) page = <AppointmentsPage />;
  else if (route.startsWith('#/agent')) page = <AgentPage />;
  else if (route.startsWith('#/impact')) page = <ImpactPage />;
  else if (route.startsWith('#/profile')) page = <ProfilePage onSaved={onProfile} />;
  else page = <TodayPage overview={data} error={error} />;

  return (
    <div className={`shell ${collapsed ? 'collapsed' : ''} ${drawer ? 'menu-open' : ''}`}>
      {drawer && <button type="button" className="scrim" aria-label="Close the menu" onClick={() => setDrawer(false)} />}
      <aside className="side" id="side-nav">
        <a className="brand-row" href="#/"><Logo width={168} /></a>
        <nav aria-label="Main">
          {NAV.map(n => {
            const active = n.match(route);
            return (
              <a key={n.href} href={n.href} title={n.label} className={`nav ${active ? 'on' : ''}`} aria-current={active ? 'page' : undefined}>
                {active && <motion.span layoutId="nav-pill" className="nav-pill" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}
                <n.icon size={19} /><span>{n.label}</span>
                {n.label === 'Messages' && unreadTotal > 0 && <em className="count msg" aria-label={`${unreadTotal} unread messages`}>{unreadTotal}</em>}
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
        {d.doctor_id === 'DOCGUEST' && <div className="demo-bar" role="alert">Demo mode. Sample data, not real patients.</div>}
        <TopBar doctor={d} signOut={signOut} notes={notes} onMenu={toggleMenu} menuOpen={drawer} />
        <CommandPalette overview={data} />
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
