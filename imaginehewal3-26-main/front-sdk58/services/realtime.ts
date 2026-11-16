/**
 * Realtime client for the backend's authenticated /ws endpoint.
 *
 * Protocol: open the socket, send {type:"auth", token} as the FIRST frame (token is never put in the URL),
 * wait for {type:"ready"}, then receive events: message.new, notification.new, vitals.update, presence, typing, alert.
 * Reconnects with exponential backoff and when the app returns to the foreground.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { resolveBaseUrl } from './baseUrl';
import { AppState, AppStateStatus } from 'react-native';

type Handler = (event: any) => void;

const baseUrl = resolveBaseUrl;

class Realtime {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<Handler>>();
  private statusHandlers = new Set<(connected: boolean) => void>();
  private retry = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private wanted = false;
  private appStateSub: { remove: () => void } | null = null;
  connected = false;

  start() {
    if (this.wanted) return;
    this.wanted = true;
    this.appStateSub = AppState.addEventListener('change', this.onAppState);
    this.open();
  }

  stop() {
    this.wanted = false;
    this.appStateSub?.remove();
    this.appStateSub = null;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.teardown();
    this.setConnected(false);
  }

  /** Subscribe to one event type ('*' for all). Returns an unsubscribe function. */
  on(type: string, handler: Handler): () => void {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(handler);
    return () => this.handlers.get(type)?.delete(handler);
  }

  onStatus(handler: (connected: boolean) => void): () => void {
    this.statusHandlers.add(handler);
    handler(this.connected);
    return () => this.statusHandlers.delete(handler);
  }

  send(payload: object): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.connected) {
      this.ws.send(JSON.stringify(payload));
      return true;
    }
    return false;
  }

  /** Resolves true as soon as the live connection is up, or false after `ms`. A restart or a sleeping server drops it for a few seconds. */
  whenConnected(ms = 10000): Promise<boolean> {
    if (this.connected) return Promise.resolve(true);
    return new Promise((resolve) => {
      let off: () => void = () => {};
      const t = setTimeout(() => { off(); resolve(false); }, ms);
      off = this.onStatus((up) => { if (up) { clearTimeout(t); off(); resolve(true); } });
    });
  }

  private onAppState = (state: AppStateStatus) => {
    if (state === 'active' && this.wanted && !this.connected) {
      this.retry = 0;
      this.open();
    }
  };

  private setConnected(value: boolean) {
    if (this.connected === value) return;
    this.connected = value;
    this.statusHandlers.forEach((h) => h(value));
  }

  private teardown() {
    if (this.pingTimer) clearInterval(this.pingTimer);
    this.pingTimer = null;
    if (this.ws) {
      this.ws.onopen = this.ws.onmessage = this.ws.onclose = this.ws.onerror = null;
      try { this.ws.close(); } catch { /* already closed */ }
    }
    this.ws = null;
  }

  private async open() {
    if (!this.wanted || this.ws) return;
    const token = await AsyncStorage.getItem('access_token');
    if (!token) return;
    const ws = new WebSocket(`${baseUrl().replace(/^http/, 'ws')}/ws`);
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token }));
    ws.onmessage = (e) => {
      let event: any;
      try { event = JSON.parse(String(e.data)); } catch { return; }
      if (event.type === 'ready') {
        this.retry = 0;
        this.setConnected(true);
        this.pingTimer = setInterval(() => this.send({ type: 'ping' }), 25000);
      }
      this.handlers.get(event.type)?.forEach((h) => h(event));
      this.handlers.get('*')?.forEach((h) => h(event));
    };
    ws.onerror = () => { /* onclose follows */ };
    ws.onclose = (e) => {
      this.teardown();
      this.setConnected(false);
      if (!this.wanted) return;
      if (e.code === 4401) { this.wanted = false; return; } // token rejected: needs a fresh login
      const delay = Math.min(30000, 1000 * 2 ** this.retry++);
      this.reconnectTimer = setTimeout(() => this.open(), delay);
    };
  }
}

export const realtime = new Realtime();
export default realtime;
