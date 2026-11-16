/**
 * The Health screen's own data, read from Apple Health and kept in memory so reopening the screen is instant.
 * It reloads when the screen opens, when the app returns to the foreground, and whenever a sync finished (`reloadKey` changes).
 */
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { buildInsights, Insights } from './healthMath';
import { readInsightData } from './healthkit';

export type InsightState = { status: 'loading' | 'ready' | 'unavailable'; data: Insights | null };
let cache: Insights | null = null;

export function useHealthInsights(connected: boolean, reloadKey: number): InsightState & { reload: () => void } {
  const [state, setState] = useState<InsightState>({ status: cache ? 'ready' : 'loading', data: cache });
  const load = useCallback(async () => {
    if (!connected) { setState({ status: 'unavailable', data: null }); return; }
    try {
      const raw = await readInsightData();
      if (!raw) { setState({ status: 'unavailable', data: null }); return; }
      cache = buildInsights(raw);
      setState({ status: 'ready', data: cache });
    } catch {
      setState((s) => (s.data ? s : { status: 'unavailable', data: null }));      // keep the last good picture if a read fails
    }
  }, [connected]);
  useEffect(() => { load(); }, [load, reloadKey]);
  useEffect(() => { const s = AppState.addEventListener('change', (a) => { if (a === 'active') load(); }); return () => s.remove(); }, [load]);
  return { ...state, reload: load };
}
