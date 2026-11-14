import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Mic, MicOff, Phone, PhoneOff, Video, VideoOff } from 'lucide-react';
import { getIce } from './api';
import { realtime } from './realtime';
import { initials } from './util';

/** Voice and video calls with a patient. The server only relays signalling; audio and video go straight between the two devices (WebRTC).
 *  Signal frames: {type:'offer'|'answer', sdp} and {type:'candidate', candidate}. The phone app uses the same shapes. */
type Media = 'audio' | 'video';
type Phase = 'idle' | 'calling' | 'ringing' | 'connecting' | 'active';
interface Call { phase: Phase; peer: number; name: string; media: Media; id: string; note?: string }
const IDLE: Call = { phase: 'idle', peer: 0, name: '', media: 'audio', id: '' };

const FALLBACK_ICE: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];

interface Ctx { call: Call; start: (peer: number, name: string, media: Media) => void; supported: boolean }
const CallCtx = createContext<Ctx>({ call: IDLE, start: () => {}, supported: false });
export const useCalls = () => useContext(CallCtx);

export function CallProvider({ children }: { children: React.ReactNode }) {
  const [call, setCall] = useState<Call>(IDLE);
  const callRef = useRef<Call>(IDLE);
  const pc = useRef<RTCPeerConnection | null>(null);
  const local = useRef<MediaStream | null>(null);
  const [remote, setRemote] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const pending = useRef<RTCIceCandidateInit[]>([]);
  const ice = useRef<RTCIceServer[]>(FALLBACK_ICE);
  const ringTimer = useRef<number>();
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [secs, setSecs] = useState(0);
  const [net, setNet] = useState({ sending: false, hearing: false });
  const lastBytes = useRef({ sent: 0, recv: 0 });
  const supported = typeof RTCPeerConnection !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  const set = (c: Call) => { callRef.current = c; setCall(c); };

  const cleanup = useCallback((note?: string) => {
    window.clearTimeout(ringTimer.current);
    pc.current?.close(); pc.current = null;
    local.current?.getTracks().forEach(t => t.stop()); local.current = null;
    pending.current = []; setRemote(null); setLocalStream(null); setMuted(false); setCamOff(false); setSecs(0);
    if (note) { set({ ...IDLE, phase: 'idle', note }); window.setTimeout(() => { if (callRef.current.phase === 'idle') set(IDLE); }, 3500); }
    else set(IDLE);
  }, []);

  const buildPc = useCallback((peer: number, id: string) => {
    const p = new RTCPeerConnection({ iceServers: ice.current });
    p.onicecandidate = e => { if (e.candidate) realtime.send({ type: 'call.signal', to: peer, call_id: id, data: { type: 'candidate', candidate: e.candidate.toJSON() } }); };
    p.ontrack = e => setRemote(prev => { const s = prev || new MediaStream(); if (!s.getTracks().includes(e.track)) s.addTrack(e.track); return new MediaStream(s.getTracks()); });
    p.onconnectionstatechange = () => {
      if (p.connectionState === 'connected') set({ ...callRef.current, phase: 'active' });
      if (p.connectionState === 'failed') { realtime.send({ type: 'call.end', to: peer, call_id: id }); cleanup('The call could not connect. Check both connections.'); }
    };
    local.current?.getTracks().forEach(t => p.addTrack(t, local.current!));
    pc.current = p;
    return p;
  }, [cleanup]);

  const getMedia = async (media: Media) => {
    const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true }, video: media === 'video' ? { facingMode: 'user' } : false });
    local.current = s; setLocalStream(s);
  };

  const start = useCallback(async (peer: number, name: string, media: Media) => {
    if (callRef.current.phase !== 'idle') return;
    if (!realtime.up) { set({ ...IDLE, note: 'Not connected yet. Try again in a moment.' }); return; }
    const id = (crypto.randomUUID?.() || String(Date.now()));
    getIce().then(r => { ice.current = r.iceServers; }).catch(() => {});   // STUN, plus a TURN relay with short-lived credentials when the server has one
    try { await getMedia(media); } catch { set({ ...IDLE, note: 'Allow microphone' + (media === 'video' ? ' and camera' : '') + ' access to place a call.' }); return; }
    set({ phase: 'calling', peer, name, media, id });
    realtime.send({ type: 'call.invite', to: peer, call_id: id, media });
    ringTimer.current = window.setTimeout(() => { realtime.send({ type: 'call.end', to: peer, call_id: id }); cleanup('No answer.'); }, 45000);
  }, [cleanup]);

  const accept = async () => {
    const c = callRef.current;
    await getIce().then(r => { ice.current = r.iceServers; }).catch(() => {});
    try { await getMedia(c.media); } catch { realtime.send({ type: 'call.reject', to: c.peer, call_id: c.id }); cleanup('Microphone access was blocked.'); return; }
    buildPc(c.peer, c.id);
    set({ ...c, phase: 'connecting' });
    realtime.send({ type: 'call.accept', to: c.peer, call_id: c.id });
  };
  const hangup = () => {
    const c = callRef.current;
    if (c.phase === 'ringing') realtime.send({ type: 'call.reject', to: c.peer, call_id: c.id });
    else realtime.send({ type: 'call.end', to: c.peer, call_id: c.id });
    cleanup();
  };

  useEffect(() => {
    const offs = [
      realtime.on('call.invite', e => {
        if (callRef.current.phase !== 'idle') { realtime.send({ type: 'call.reject', to: e.from_user_id, call_id: e.call_id }); return; }
        set({ phase: 'ringing', peer: e.from_user_id, name: e.from_name || 'Patient', media: e.media === 'video' ? 'video' : 'audio', id: e.call_id });
      }),
      realtime.on('call.accept', async e => {
        const c = callRef.current;
        if (e.call_id !== c.id || c.phase !== 'calling') return;
        window.clearTimeout(ringTimer.current);
        set({ ...c, phase: 'connecting' });
        const p = buildPc(c.peer, c.id);
        const offer = await p.createOffer();
        await p.setLocalDescription(offer);
        realtime.send({ type: 'call.signal', to: c.peer, call_id: c.id, data: { type: 'offer', sdp: offer.sdp } });
      }),
      realtime.on('call.signal', async e => {
        const c = callRef.current;
        if (e.call_id !== c.id) return;
        const d = e.data || {};
        const p = pc.current;
        if (d.type === 'candidate') {
          if (p && p.remoteDescription) await p.addIceCandidate(d.candidate).catch(() => {});
          else pending.current.push(d.candidate);
        } else if (p && (d.type === 'offer' || d.type === 'answer')) {
          await p.setRemoteDescription({ type: d.type, sdp: d.sdp });
          for (const cand of pending.current.splice(0)) await p.addIceCandidate(cand).catch(() => {});
          if (d.type === 'offer') {
            const ans = await p.createAnswer();
            await p.setLocalDescription(ans);
            realtime.send({ type: 'call.signal', to: c.peer, call_id: c.id, data: { type: 'answer', sdp: ans.sdp } });
          }
        }
      }),
      realtime.on('call.ringing', e => { if (e.call_id === callRef.current.id) set({ ...callRef.current, note: 'Their app is closed. A notification was sent; the call rings when they open it.' }); }),
      realtime.on('call.reject', e => { if (e.call_id === callRef.current.id) cleanup('The patient declined the call.'); }),
      realtime.on('call.end', e => { if (e.call_id === callRef.current.id) cleanup(e.reason === 'dropped' ? 'The other side lost connection.' : 'Call ended.'); }),
      realtime.on('call.unavailable', e => { if (e.call_id === callRef.current.id) cleanup(e.reason === 'busy' ? 'They are already on a call.' : 'They are offline right now. Send a message instead.'); }),
    ];
    return () => offs.forEach(o => o());
  }, [buildPc, cleanup]);

  // a simple ring tone for incoming calls, made with the Web Audio API (no audio file needed)
  useEffect(() => {
    if (call.phase !== 'ringing') return;
    let ctx: AudioContext | null = null;
    let t: number | undefined;
    try {
      ctx = new AudioContext();
      const beep = () => {
        if (!ctx) return;
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 440; g.gain.value = 0.05; o.connect(g); g.connect(ctx.destination);
        o.start(); o.stop(ctx.currentTime + 0.4);
      };
      beep(); t = window.setInterval(beep, 1800);
    } catch { /* silent ring is fine */ }
    return () => { if (t) window.clearInterval(t); ctx?.close().catch(() => {}); };
  }, [call.phase]);

  useEffect(() => {
    if (call.phase !== 'active') return;
    const t = window.setInterval(() => setSecs(s => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [call.phase]);

  // Every 1.5 s, ask the browser whether voice bytes are really moving each way, so "I cannot hear you" can be told apart from "nothing is arriving".
  useEffect(() => {
    if (call.phase !== 'active' && call.phase !== 'connecting') { lastBytes.current = { sent: 0, recv: 0 }; setNet({ sending: false, hearing: false }); return; }
    const t = window.setInterval(async () => {
      const p = pc.current;
      if (!p) return;
      let sent = 0, recv = 0;
      (await p.getStats()).forEach((r: any) => {
        if (r.type === 'outbound-rtp' && r.kind === 'audio') sent += r.bytesSent || 0;
        if (r.type === 'inbound-rtp' && r.kind === 'audio') recv += r.bytesReceived || 0;
      });
      setNet({ sending: sent > lastBytes.current.sent, hearing: recv > lastBytes.current.recv });
      lastBytes.current = { sent, recv };
    }, 1500);
    return () => window.clearInterval(t);
  }, [call.phase]);

  const toggleMic = () => { local.current?.getAudioTracks().forEach(t => { t.enabled = muted; }); setMuted(!muted); };
  const toggleCam = () => { local.current?.getVideoTracks().forEach(t => { t.enabled = camOff; }); setCamOff(!camOff); };

  return (
    <CallCtx.Provider value={{ call, start, supported }}>
      {children}
      <CallOverlay call={call} remote={remote} local={localStream} muted={muted} camOff={camOff} secs={secs} net={net}
        onAccept={accept} onHangup={hangup} onMic={toggleMic} onCam={toggleCam} />
    </CallCtx.Provider>
  );
}

/** The other person's voice. A plain audio element, played explicitly; if the browser blocks it, a button lets the doctor start it. */
function RemoteAudio({ stream }: { stream: MediaStream | null }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [blocked, setBlocked] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || !stream) return;
    el.srcObject = stream;
    el.play().then(() => setBlocked(false)).catch(() => setBlocked(true));
  }, [stream]);
  return (
    <>
      <audio ref={ref} autoPlay />
      {blocked && <button className="call-unmute" onClick={() => ref.current?.play().then(() => setBlocked(false)).catch(() => {})}>Click to turn on sound</button>}
    </>
  );
}

function Stream({ stream, muted, className }: { stream: MediaStream | null; muted?: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
  return <video ref={ref} className={className} autoPlay playsInline muted={muted} />;
}

function CallOverlay({ call, remote, local, muted, camOff, secs, net, onAccept, onHangup, onMic, onCam }: {
  call: Call; remote: MediaStream | null; local: MediaStream | null; muted: boolean; camOff: boolean; secs: number; net: { sending: boolean; hearing: boolean };
  onAccept: () => void; onHangup: () => void; onMic: () => void; onCam: () => void;
}) {
  const live = call.phase !== 'idle';
  const label = call.phase === 'calling' ? 'Calling' : call.phase === 'ringing' ? `Incoming ${call.media} call` : call.phase === 'connecting' ? 'Connecting' :
    `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  return (
    <>
      <AnimatePresence>
        {live && (
          <motion.div className="call" role="dialog" aria-modal="true" aria-label={`Call with ${call.name}`}
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.97 }} transition={{ duration: 0.25 }}>
            {call.media === 'video' && remote && <Stream stream={remote} muted className="call-remote" />}
            {/* the voice is played by its own audio element, for voice and video calls alike */}
            <RemoteAudio stream={remote} />
            <div className="call-body">
              {(call.media === 'audio' || !remote) && (
                <div className="call-who">
                  <motion.span className="call-avatar" animate={call.phase === 'ringing' || call.phase === 'calling' ? { scale: [1, 1.06, 1] } : {}} transition={{ repeat: Infinity, duration: 1.6 }}>{initials(call.name)}</motion.span>
                  <b>{call.name}</b>
                </div>
              )}
              {call.media === 'video' && remote && <div className="call-name-tag">{call.name}</div>}
              <div className="call-state" aria-live="polite">{label}</div>
              {(call.phase === 'active' || call.phase === 'connecting') && (
                <div className="call-meter" aria-live="polite">
                  <span className={net.sending ? 'ok' : 'bad'}>{muted ? 'Your microphone is muted' : net.sending ? 'Your voice is being sent' : 'Your voice is not being sent'}</span>
                  <span className={net.hearing ? 'ok' : 'bad'}>{net.hearing ? 'Receiving their voice' : 'Not receiving their voice yet'}</span>
                </div>
              )}
              {call.media === 'video' && local && <Stream stream={local} muted className="call-self" />}
              <div className="call-actions">
                {call.phase === 'ringing' ? (
                  <>
                    <button className="call-btn ok" onClick={onAccept} aria-label="Accept call"><Phone size={22} /></button>
                    <button className="call-btn end" onClick={onHangup} aria-label="Decline call"><PhoneOff size={22} /></button>
                  </>
                ) : (
                  <>
                    <button className={`call-btn ${muted ? 'on' : ''}`} onClick={onMic} aria-label={muted ? 'Unmute microphone' : 'Mute microphone'} aria-pressed={muted}>{muted ? <MicOff size={20} /> : <Mic size={20} />}</button>
                    {call.media === 'video' && <button className={`call-btn ${camOff ? 'on' : ''}`} onClick={onCam} aria-label={camOff ? 'Turn camera on' : 'Turn camera off'} aria-pressed={camOff}>{camOff ? <VideoOff size={20} /> : <Video size={20} />}</button>}
                    <button className="call-btn end" onClick={onHangup} aria-label="End call"><PhoneOff size={22} /></button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {!live && call.note && <motion.div className="toast" role="status" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>{call.note}</motion.div>}
      </AnimatePresence>
    </>
  );
}
