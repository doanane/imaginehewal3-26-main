import React, { useEffect, useState } from 'react';
import { Modal, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../constants/theme';
import { useAuth } from '../contexts/AuthContext';
import { calls, CallState } from '../services/calls';
import { realtime } from '../services/realtime';
import { profileImageSource } from '../services/imageUrl';
import { Image, Ionicons, Pressable, Text, View } from './themed';

const C = theme.COLORS;

/** Mounted once at the root: wires incoming calls for a signed-in person and shows the full-screen call UI on top of any screen. */
export default function CallHost() {
  const { isAuthenticated } = useAuth();
  const [s, setS] = useState<CallState>(calls.state);
  const [secs, setSecs] = useState(0);
  const insets = useSafeAreaInsets();

  useEffect(() => calls.subscribe(setS), []);
  useEffect(() => {
    if (!isAuthenticated || !calls.available) return;
    realtime.start();
    calls.listen();
  }, [isAuthenticated]);
  useEffect(() => {
    if (s.phase !== 'active') { setSecs(0); return; }
    const t = setInterval(() => setSecs((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [s.phase]);

  if (!calls.available) return null;
  const RTCView = require('react-native-webrtc').RTCView;
  const live = s.phase !== 'idle';
  const label = s.phase === 'calling' ? 'Calling' : s.phase === 'ringing' ? `Incoming ${s.media} call` : s.phase === 'connecting' ? 'Connecting'
    : `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  const showVideo = s.media === 'video' && s.remote;

  return (
    <>
      <Modal visible={live} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => calls.hangup()}>
        <View style={[st.wrap, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 32 }]}>
          {showVideo ? <RTCView streamURL={s.remote.toURL()} style={StyleSheet.absoluteFill} objectFit="cover" /> : null}
          {/* a voice call has no picture, but its sound still has to be played */}
          {!showVideo && s.remote ? <RTCView streamURL={s.remote.toURL()} style={{ width: 1, height: 1 }} /> : null}
          {!showVideo ? (
            <View style={st.who}>
              <View style={st.avatar}>{s.photo
                ? <Image source={profileImageSource(s.photo) as any} style={st.photo} accessibilityLabel={`${s.name}'s picture`} />
                : <Text style={st.initial}>{(s.name || '?').trim().charAt(0).toUpperCase()}</Text>}</View>
              <Text style={st.name} accessibilityRole="header">{s.name}</Text>
            </View>
          ) : <Text style={st.tag}>{s.name}</Text>}
          <Text style={st.state} accessibilityLiveRegion="polite">{label}</Text>
          {s.muted && s.phase === 'active' ? <Text style={[st.meter, { color: '#fbbf24' }]} accessibilityLiveRegion="polite">Your microphone is muted</Text> : null}
          {s.media === 'video' && s.local ? <RTCView streamURL={s.local.toURL()} style={st.self} objectFit="cover" mirror zOrder={1} /> : null}
          <View style={st.actions}>
            {s.phase === 'ringing' ? (
              <>
                <Pressable onPress={() => calls.accept()} accessibilityRole="button" accessibilityLabel="Accept call" style={[st.btn, { backgroundColor: '#1aa36b' }]}><Ionicons name="call" size={28} color="#fff" /></Pressable>
                <Pressable onPress={() => calls.hangup()} accessibilityRole="button" accessibilityLabel="Decline call" style={[st.btn, { backgroundColor: '#d92d3f' }]}><Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} /></Pressable>
              </>
            ) : (
              <>
                <Pressable onPress={() => calls.toggleMute()} accessibilityRole="button" accessibilityState={{ selected: s.muted }} accessibilityLabel={s.muted ? 'Unmute microphone' : 'Mute microphone'} style={[st.btn, s.muted && st.btnOn]}><Ionicons name={s.muted ? 'mic-off' : 'mic'} size={26} color={s.muted ? '#111' : '#fff'} /></Pressable>
                {s.media === 'video' ? <Pressable onPress={() => calls.toggleCamera()} accessibilityRole="button" accessibilityState={{ selected: s.camOff }} accessibilityLabel={s.camOff ? 'Turn camera on' : 'Turn camera off'} style={[st.btn, s.camOff && st.btnOn]}><Ionicons name={s.camOff ? 'videocam-off' : 'videocam'} size={26} color={s.camOff ? '#111' : '#fff'} /></Pressable> : null}
                <Pressable onPress={() => calls.hangup()} accessibilityRole="button" accessibilityLabel="End call" style={[st.btn, { backgroundColor: '#d92d3f' }]}><Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} /></Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
      {!live && s.note ? (
        <View pointerEvents="none" style={[st.note, { bottom: insets.bottom + 90 }]}><Text style={st.noteText} accessibilityLiveRegion="polite">{s.note}</Text></View>
      ) : null}
    </>
  );
}

const st = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: '#0b0910', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  who: { alignItems: 'center', gap: 16, marginTop: 40 },
  avatar: { width: 120, height: 120, borderRadius: 60, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 10, borderColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' },
  photo: { width: 100, height: 100, borderRadius: 50 },
  initial: { color: '#fff', fontSize: 46, fontWeight: '700' },
  name: { color: '#fff', fontSize: 26, fontWeight: '600', textAlign: 'center' },
  tag: { position: 'absolute', top: 70, left: 20, color: '#fff', backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, overflow: 'hidden' },
  state: { color: 'rgba(255,255,255,0.85)', fontSize: 17 },
  meter: { fontSize: 13, fontWeight: '600' },
  self: { position: 'absolute', right: 18, bottom: 150, width: 110, height: 156, borderRadius: 14, overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.4)' },
  actions: { flexDirection: 'row', gap: 22, alignItems: 'center' },
  btn: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  btnOn: { backgroundColor: '#fff' },
  note: { position: 'absolute', left: 20, right: 20, alignItems: 'center' },
  noteText: { backgroundColor: '#17151d', color: '#fff', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, overflow: 'hidden', textAlign: 'center' },
});
