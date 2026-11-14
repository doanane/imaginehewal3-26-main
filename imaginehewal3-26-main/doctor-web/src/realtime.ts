/** Authenticated websocket to the backend /ws. The token goes in the first frame, never in the URL.
 *  Reconnects with backoff, and tells listeners when the connection comes back so they can catch up. */
type Handler = (e: any) => void;

class Realtime {
  private ws: WebSocket | null = null;
  private handlers = new Map<string, Set<Handler>>();
  private status = new Set<(up: boolean) => void>();
  private token: string | null = null;
  private retry = 0;
  private timer: number | undefined;
  private ping: number | undefined;
  up = false;
  myKey = 0;

  start(token: string) {
    this.stop();
    this.token = token;
    this.open();
  }

  stop() {
    this.token = null;
    window.clearTimeout(this.timer); window.clearInterval(this.ping);
    if (this.ws) { this.ws.onclose = null; try { this.ws.close(); } catch { /* closed */ } }
    this.ws = null;
    this.setUp(false);
  }

  on(type: string, h: Handler) {
    if (!this.handlers.has(type)) this.handlers.set(type, new Set());
    this.handlers.get(type)!.add(h);
    return () => { this.handlers.get(type)?.delete(h); };
  }

  onStatus(h: (up: boolean) => void) { this.status.add(h); h(this.up); return () => { this.status.delete(h); }; }

  send(payload: object): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.up) { this.ws.send(JSON.stringify(payload)); return true; }
    return false;
  }

  private setUp(v: boolean) { if (this.up !== v) { this.up = v; this.status.forEach(h => h(v)); } }

  private open() {
    if (!this.token) return;
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${proto}://${window.location.host}/ws`);
    this.ws = ws;
    ws.onopen = () => ws.send(JSON.stringify({ type: 'auth', token: this.token }));
    ws.onmessage = ev => {
      let e: any;
      try { e = JSON.parse(String(ev.data)); } catch { return; }
      if (e.type === 'ready') {
        this.retry = 0; this.myKey = e.user_id; this.setUp(true);
        window.clearInterval(this.ping);
        this.ping = window.setInterval(() => this.send({ type: 'ping' }), 25000);
      }
      this.handlers.get(e.type)?.forEach(h => h(e));
    };
    ws.onclose = ev => {
      window.clearInterval(this.ping);
      this.setUp(false);
      if (!this.token || ev.code === 4401) return;          // 4401: token rejected, the REST layer will send the user to sign in
      this.timer = window.setTimeout(() => this.open(), Math.min(15000, 800 * 2 ** this.retry++));
    };
  }
}

export const realtime = new Realtime();
