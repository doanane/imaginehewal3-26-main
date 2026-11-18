import { useEffect, useRef, useState } from 'react';

export const NA = 'n/a';
export const show = (x: number | null | undefined, unit = '') => (x === null || x === undefined ? NA : `${x}${unit}`);
export const bpText = (s: number | null, d: number | null) => (s && d ? `${s}/${d}` : NA);
export const shortDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' });
export const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('');
export const signed = (n: number, digits = 1) => `${n > 0 ? '+' : n < 0 ? '-' : ''}${Math.abs(n).toFixed(digits).replace(/\.0+$/, '')}`;

export function ago(iso: string | null): string {
  if (!iso) return 'no readings yet';
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 15) return 'just now';
  if (s < 90) return `${s} sec ago`;
  if (s < 5400) return `${Math.round(s / 60)} min ago`;
  if (s < 129600) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} days ago`;
}
export const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '');

export const GROUP_LABEL: Record<string, string> = { critical: 'Critical', monitor: 'Monitor', stable: 'Stable', healthy: 'Healthy', no_data: 'No recent data' };
export const SOS_LABEL: Record<string, string> = {
  pending: 'Patient can still cancel', active: 'Waiting for a caregiver', acknowledged: 'Caregiver is responding',
  escalated: 'Escalated to emergency services', resolved: 'Resolved', cancelled: 'Cancelled by patient',
};
export const safeMap = (url: string | null) => (url && /^https:\/\/maps\.google\.com\//.test(url) ? url : null);

/** Loads now and again every `ms`. Keeps the last good data on screen if a refresh fails, and says so. */
export function usePolling<T>(load: () => Promise<T>, ms: number, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);
  const [updated, setUpdated] = useState<Date | null>(null);
  const loadRef = useRef(load);
  loadRef.current = load;
  const nowRef = useRef<() => void>(() => {});
  useEffect(() => {
    let stop = false;
    let busy = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setData(null); setError(null);
    const tick = async () => {
      if (busy) return;
      busy = true;
      try {
        const d = await loadRef.current();
        if (!stop) { setData(d); setError(null); setOnline(true); setUpdated(new Date()); }
      } catch (e) {
        if (!stop) { setError((e as Error).message); setOnline(false); }
      } finally {
        busy = false;
        if (!stop) timer = setTimeout(tick, document.hidden ? ms * 4 : ms);
      }
    };
    nowRef.current = () => { if (timer) clearTimeout(timer); tick(); };
    tick();
    return () => { stop = true; if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, error, online, updated, reload: () => nowRef.current() };
}

export function useHashRoute(): string {
  const [h, setH] = useState(window.location.hash || '#/');
  useEffect(() => {
    const f = () => setH(window.location.hash || '#/');
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  return h;
}

/** A patient ID worth showing: IDs that only mark sample accounts (they start with "demo") are left out. */
export const shownId = (id?: string | null) => (id && !/^demo/i.test(id) ? id : null);
