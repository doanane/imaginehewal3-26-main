/**
 * Offline-first actions. When there is no signal, check-ins and medicine logs are saved on the phone and sent when the
 * connection returns. Only network failures are queued; a server rejection (4xx) is a real error and is surfaced.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getNetInfo } from './native';
import { useEffect, useState } from 'react';
import { apiCall } from './api';

const KEY = 'hewal3_offline_actions_v1';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
type Item = { id: string; path: string; method: 'POST' | 'PUT' | 'DELETE'; body?: unknown; at: string };
const listeners = new Set<(n: number) => void>();
let flushing = false;

async function read(): Promise<Item[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const items: Item[] = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    return items.filter((i) => now - Date.parse(i.at) <= MAX_AGE_MS);
  } catch { return []; }
}
async function write(items: Item[]) {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage full or unavailable */ }
  listeners.forEach((l) => l(items.length));
}

export function isNetworkError(e: any): boolean {
  const m = String(e?.message || '');
  return !e?.status && /Cannot connect|timed out|Network request failed|Failed to fetch|Network Error/i.test(m);
}

/** Try the call now. If the phone is offline, queue it and report `queued: true`. */
export async function callOrQueue<T = any>(path: string, method: 'POST' | 'PUT' | 'DELETE', body?: unknown): Promise<{ queued: boolean; data?: T }> {
  try {
    return { queued: false, data: await apiCall<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) }) };
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    await write([...(await read()), { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, path, method, body, at: new Date().toISOString() }]);
    return { queued: true };
  }
}

export async function pendingCount(): Promise<number> { return (await read()).length; }

/** Send everything waiting, oldest first. Stops at the first network failure; drops items the server rejects. */
export async function flushQueue(): Promise<number> {
  if (flushing) return 0;
  flushing = true;
  let sent = 0;
  try {
    const items = await read();
    const rest: Item[] = [];
    for (let i = 0; i < items.length; i++) {
      try {
        await apiCall(items[i].path, { method: items[i].method, body: items[i].body === undefined ? undefined : JSON.stringify(items[i].body) });
        sent++;
      } catch (e: any) {
        if (isNetworkError(e)) { rest.push(...items.slice(i)); break; }   // still offline: keep the rest in order
        // server said no (e.g. 400/404): this item can never succeed, so drop it
      }
    }
    await write(rest);
  } finally { flushing = false; }
  return sent;
}

/** Start syncing whenever the connection returns. Call once at app start; returns an unsubscribe function. */
export function startOfflineSync(): () => void {
  flushQueue();
  const NetInfo = getNetInfo();
  if (!NetInfo) { const t = setInterval(flushQueue, 30000); return () => clearInterval(t); }    // no native network monitor: retry on a timer
  const unsub = NetInfo.addEventListener((s) => { if (s.isConnected && s.isInternetReachable !== false) flushQueue(); });
  return unsub;
}

export function usePendingActions(): number {
  const [n, setN] = useState(0);
  useEffect(() => { pendingCount().then(setN); listeners.add(setN); return () => { listeners.delete(setN); }; }, []);
  return n;
}
