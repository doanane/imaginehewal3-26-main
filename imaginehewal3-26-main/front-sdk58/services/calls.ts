/**
 * Voice and video calls (WebRTC). The backend only relays signalling over the /ws socket; audio and video go straight between the devices.
 * Needs the react-native-webrtc native module, so it exists only in a build made after that package was added. Without it
 * `calls.available` is false and the call buttons are hidden: nothing crashes and nothing pretends to work.
 * Signal frames match the doctor website: {type:'offer'|'answer', sdp} and {type:'candidate', candidate}.
 */
import { webrtcModulePresent } from './native';
import api from './api';
import { realtime } from './realtime';
import { startRinging, stopRinging, useCallAudioMode } from './callAudio';

export type CallMedia = 'audio' | 'video';
export type CallPhase = 'idle' | 'calling' | 'ringing' | 'connecting' | 'active';
export interface CallState { phase: CallPhase; peer: number; name: string; media: CallMedia; id: string; note?: string; muted: boolean; camOff: boolean; local: any; remote: any; sending: boolean; receiving: boolean }

const IDLE: CallState = { phase: 'idle', peer: 0, name: '', media: 'audio', id: '', muted: false, camOff: false, local: null, remote: null, sending: false, receiving: false };
let iceServers: any[] = [{ urls: 'stun:stun.l.google.com:19302' }];

let rtc: any | null | undefined;
const lib = () => {
  if (rtc === undefined) {
    try { rtc = webrtcModulePresent() ? require('react-native-webrtc') : null; } catch { rtc = null; }
  }
  return rtc;
};

class Calls {
  state: CallState = IDLE;
  private subs = new Set<(s: CallState) => void>();
  private pc: any = null;
  private pending: any[] = [];
  private ring: ReturnType<typeof setTimeout> | null = null;
  private wired = false;
  private meter: ReturnType<typeof setInterval> | null = null;
  private bytes = { sent: 0, recv: 0 };
  private quiet = 0; private repaired = false; private lastEnergy = 0;

  /** The microphone captured nothing: set the phone's audio up for a call again, open a fresh microphone and swap it into the call. */
  private async reopenMic(pc: any) {
    try {
      await useCallAudioMode();
      const fresh = await lib().mediaDevices.getUserMedia({ audio: true, video: false });
      const track = fresh.getAudioTracks()[0];
      const sender = pc.getSenders().find((x: any) => x.track && x.track.kind === 'audio');
      if (track && sender) { await sender.replaceTrack(track); this.state.local?.getAudioTracks().forEach((t: any) => t.stop()); this.set({ local: fresh }); }
    } catch { /* the call carries on with the original microphone */ }
  }

  get available() { return !!lib(); }

  subscribe(fn: (s: CallState) => void) { this.subs.add(fn); fn(this.state); return () => { this.subs.delete(fn); }; }
  private set(patch: Partial<CallState>) { this.state = { ...this.state, ...patch }; this.subs.forEach((f) => f(this.state)); }

  /** Start listening for incoming calls. Call once after sign-in; safe to call again. */
  listen() {
    if (this.wired || !this.available) return;
    this.wired = true;
    realtime.on('call.invite', (e) => {
      if (this.state.phase !== 'idle') { realtime.send({ type: 'call.reject', to: e.from_user_id, call_id: e.call_id }); return; }
      this.set({ ...IDLE, phase: 'ringing', peer: e.from_user_id, name: e.from_name || 'Care team', media: e.media === 'video' ? 'video' : 'audio', id: e.call_id });
      startRinging();
    });
    // the same person answered or declined on another device of theirs
    realtime.on('call.handled', (e) => { if (e.call_id === this.state.id && this.state.phase === 'ringing') this.end(); });
    realtime.on('call.accept', async (e) => {
      if (e.call_id !== this.state.id || this.state.phase !== 'calling') return;
      if (this.ring) clearTimeout(this.ring);
      this.set({ phase: 'connecting' });
      const pc = this.build();
      const offer = await pc.createOffer({});
      await pc.setLocalDescription(offer);
      realtime.send({ type: 'call.signal', to: this.state.peer, call_id: this.state.id, data: { type: 'offer', sdp: offer.sdp } });
    });
    realtime.on('call.signal', async (e) => {
      if (e.call_id !== this.state.id) return;
      const { RTCSessionDescription, RTCIceCandidate } = lib();
      const d = e.data || {};
      const pc = this.pc;
      try {
        if (d.type === 'candidate') {
          if (pc && pc.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(d.candidate));
          else this.pending.push(d.candidate);
        } else if (pc && (d.type === 'offer' || d.type === 'answer')) {
          await pc.setRemoteDescription(new RTCSessionDescription({ type: d.type, sdp: d.sdp }));
          for (const c of this.pending.splice(0)) await pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
          if (d.type === 'offer') {
            const ans = await pc.createAnswer();
            await pc.setLocalDescription(ans);
            realtime.send({ type: 'call.signal', to: this.state.peer, call_id: this.state.id, data: { type: 'answer', sdp: ans.sdp } });
          }
        }
      } catch { /* a bad frame must not end the call */ }
    });
    realtime.on('call.ringing', (e) => { if (e.call_id === this.state.id) this.set({ note: 'Their app is closed. A notification was sent; the call rings when they open it.' }); });
    realtime.on('call.reject', (e) => { if (e.call_id === this.state.id) this.end('The call was declined.'); });
    realtime.on('call.end', (e) => { if (e.call_id === this.state.id) this.end(e.reason === 'dropped' ? 'The other side lost connection.' : 'Call ended.'); });
    realtime.on('call.unavailable', (e) => { if (e.call_id === this.state.id) this.end(e.reason === 'busy' ? 'They are already on a call.' : 'They are offline right now. Send a message instead.'); });
  }

  private async media(kind: CallMedia) {
    await useCallAudioMode();
    const stream = await lib().mediaDevices.getUserMedia({ audio: true, video: kind === 'video' ? { facingMode: 'user' } : false });
    this.set({ local: stream });
  }

  private build() {
    const { RTCPeerConnection } = lib();
    const pc = new RTCPeerConnection({ iceServers });
    const { peer, id } = this.state;
    pc.addEventListener('icecandidate', (e: any) => { if (e.candidate) realtime.send({ type: 'call.signal', to: peer, call_id: id, data: { type: 'candidate', candidate: e.candidate.toJSON() } }); });
    pc.addEventListener('track', (e: any) => { if (e.streams && e.streams[0]) this.set({ remote: e.streams[0] }); });
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'connected') { this.set({ phase: 'active' }); void useCallAudioMode(); }
      if (pc.connectionState === 'failed') { realtime.send({ type: 'call.end', to: peer, call_id: id }); this.end('The call could not connect. Check both connections.'); }
    });
    this.state.local?.getTracks().forEach((t: any) => pc.addTrack(t, this.state.local));
    this.pc = pc;
    this.bytes = { sent: 0, recv: 0 };
    this.quiet = 0; this.repaired = false;
    if (this.meter) clearInterval(this.meter);
    // Every 1.5 s: is the microphone really picking up sound? Bytes leave a phone even when the microphone is capturing silence, so the
    // loudness of what is being sent is checked as well. If the microphone stays silent for about 9 s while not muted, it is opened again.
    this.meter = setInterval(async () => {
      try {
        let sent = 0, recv = 0; let energy: number | null = null;
        const report: any = await pc.getStats();
        report.forEach((r: any) => {
          const kind = r.kind || r.mediaType;
          if (r.type === 'outbound-rtp' && kind === 'audio') sent += Number(r.bytesSent || 0);
          if (r.type === 'inbound-rtp' && kind === 'audio') recv += Number(r.bytesReceived || 0);
          if (r.type === 'media-source' && kind === 'audio' && typeof r.totalAudioEnergy === 'number') energy = r.totalAudioEnergy;
        });
        this.set({ sending: sent > this.bytes.sent, receiving: recv > this.bytes.recv });
        this.bytes = { sent, recv };
        if (energy !== null && pc.connectionState === 'connected' && !this.state.muted) {
          if (energy <= this.lastEnergy + 1e-9) this.quiet += 1; else this.quiet = 0;
          if (this.quiet >= 6 && !this.repaired) { this.repaired = true; this.quiet = 0; void this.reopenMic(pc); }
        }
        if (energy !== null) this.lastEnergy = energy;
      } catch { /* stats are a diagnostic only */ }
    }, 1500);
    return pc;
  }

  async start(peer: number, name: string, media: CallMedia) {
    if (!this.available || this.state.phase !== 'idle') return;
    if (!realtime.connected) { this.flash('Not connected yet. Try again in a moment.'); return; }
    api.getIceServers().then((r) => { iceServers = r.iceServers; }).catch(() => {});   // STUN plus a TURN relay when the server has one
    const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    this.set({ ...IDLE, peer, name, media, id });
    try { await this.media(media); } catch { this.flash('Allow microphone' + (media === 'video' ? ' and camera' : '') + ' access in Settings to place a call.'); return; }
    this.set({ phase: 'calling' });
    realtime.send({ type: 'call.invite', to: peer, call_id: id, media });
    this.ring = setTimeout(() => { realtime.send({ type: 'call.end', to: peer, call_id: id }); this.end('No answer.'); }, 45000);
  }

  async accept() {
    const s = this.state;
    if (s.phase !== 'ringing') return;
    stopRinging();
    await api.getIceServers().then((r) => { iceServers = r.iceServers; }).catch(() => {});
    try { await this.media(s.media); } catch { realtime.send({ type: 'call.reject', to: s.peer, call_id: s.id }); this.end('Microphone access was blocked.'); return; }
    this.build();
    this.set({ phase: 'connecting' });
    realtime.send({ type: 'call.accept', to: s.peer, call_id: s.id });
  }

  hangup() {
    const s = this.state;
    if (s.phase === 'idle') return;
    stopRinging();
    realtime.send({ type: s.phase === 'ringing' ? 'call.reject' : 'call.end', to: s.peer, call_id: s.id });
    this.end();
  }

  toggleMute() { const m = !this.state.muted; this.state.local?.getAudioTracks().forEach((t: any) => { t.enabled = !m; }); this.set({ muted: m }); }
  toggleCamera() { const o = !this.state.camOff; this.state.local?.getVideoTracks().forEach((t: any) => { t.enabled = !o; }); this.set({ camOff: o }); }

  private flash(note: string) { this.set({ ...IDLE, note }); setTimeout(() => { if (this.state.phase === 'idle') this.set({ note: undefined }); }, 4000); }

  private end(note?: string) {
    stopRinging();
    if (this.ring) clearTimeout(this.ring);
    if (this.meter) { clearInterval(this.meter); this.meter = null; }
    try { this.pc?.close(); } catch { /* closed */ }
    this.pc = null; this.pending = [];
    this.state.local?.getTracks().forEach((t: any) => t.stop());
    this.set({ ...IDLE });
    if (note) this.flash(note);
  }
}

export const calls = new Calls();
