import { usePathname, useRouter } from 'expo-router';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import api, { SosEvent } from '../services/api';
import { startOfflineSync } from '../services/offlineActions';
import { realtime } from '../services/realtime';
import { useAuth } from './AuthContext';

const OPEN = ['pending', 'active', 'acknowledged', 'escalated'];
export const isOpen = (e?: SosEvent | null) => !!e && OPEN.includes(e.status);

type Ctx = {
  mine: SosEvent | null;            // the signed-in user's own emergency (may be in a finished state)
  patients: SosEvent[];             // emergencies of people this user cares for
  incoming: SosEvent[];             // those that still need this user's attention
  refresh: () => Promise<void>;
  startSos: () => Promise<void>;
  dismiss: (id: number) => void;
};
const EmergencyContext = createContext<Ctx | undefined>(undefined);
export const useEmergency = () => {
  const c = useContext(EmergencyContext);
  if (!c) throw new Error('useEmergency must be used inside EmergencyProvider');
  return c;
};

export function EmergencyProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mine, setMine] = useState<SosEvent | null>(null);
  const [patients, setPatients] = useState<SosEvent[]>([]);
  const [dismissed, setDismissed] = useState<number[]>([]);
  const pathRef = useRef(pathname);
  pathRef.current = pathname;
  const me = Number(user?.id);

  const refresh = useCallback(async () => {
    try {
      const r = await api.getActiveEmergencies();
      setMine(r.mine); setPatients(r.patients);
    } catch { /* offline: keep what we have */ }
  }, []);

  const openScreen = useCallback(() => {
    if (!pathRef.current.includes('/emergency')) router.push('/(patient)/emergency' as any);
  }, [router]);

  const upsert = useCallback((ev: SosEvent) => {
    if (ev.user_id === me) setMine(ev);
    else setPatients((p) => (isOpen(ev) ? [ev, ...p.filter((x) => x.id !== ev.id)] : p.filter((x) => x.id !== ev.id)));
  }, [me]);

  useEffect(() => (isAuthenticated ? startOfflineSync() : undefined), [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) { setMine(null); setPatients([]); return; }
    refresh();
    const offs = [
      realtime.on('emergency.started', (e) => { setMine(e.event); openScreen(); }),
      realtime.on('emergency.update', (e) => upsert(e.event)),
      realtime.on('emergency.escalated', (e) => upsert(e.event)),
      realtime.on('emergency.acknowledged', (e) => upsert(e.event)),
      realtime.on('alert', (e) => {
        if (e.kind === 'emergency' && e.event) upsert(e.event);
        if (e.kind === 'emergency.cancelled' && e.event) upsert(e.event);
      }),
      realtime.on('emergency.location', (e) => {
        setPatients((p) => p.map((x) => (x.id === e.event_id ? { ...x, lat: e.lat, lng: e.lng, location_url: e.location_url } : x)));
      }),
      realtime.onStatus((connected) => { if (connected) refresh(); }),   // catch up after being offline
    ];
    return () => offs.forEach((o) => o());
  }, [isAuthenticated, refresh, upsert, openScreen]);

  const startSos = useCallback(async () => {
    const ev = await api.sendSos();
    setMine(ev);
    openScreen();
  }, [openScreen]);

  const incoming = useMemo(
    () => patients.filter((e) => ['active', 'escalated'].includes(e.status) && e.acknowledged_by !== me && !dismissed.includes(e.id)),
    [patients, dismissed, me],
  );

  const value = useMemo<Ctx>(() => ({
    mine, patients, incoming, refresh, startSos, dismiss: (id: number) => setDismissed((d) => [...d, id]),
  }), [mine, patients, incoming, refresh, startSos]);
  return <EmergencyContext.Provider value={value}>{children}</EmergencyContext.Provider>;
}
