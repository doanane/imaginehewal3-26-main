import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import api from './api';
import { realtime } from './realtime';

const EVENTS = ['notification.new', 'doctor_message.new', 'appointment.update', 'prescription.update', 'care_note.new', 'message.new'];

/** How many notifications are still unread. Updates the moment something arrives over the live connection and when the screen is focused. */
export function useUnreadNotifications(): number {
  const [count, setCount] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const load = useCallback(async () => {
    try {
      const g: any = await api.getNotifications();
      const all = [...(g?.system || []), ...(g?.caregiver || []), ...(g?.doctor || [])];
      setCount(all.filter((n: any) => !n.is_read).length);
    } catch { /* keep the last number */ }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => {
    realtime.start();
    const offs = EVENTS.map((t) => realtime.on(t, () => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(load, 700); }));
    return () => { offs.forEach((o) => o()); if (timer.current) clearTimeout(timer.current); };
  }, [load]);
  return count;
}
