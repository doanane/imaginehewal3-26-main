import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bubble, ChatWallpaper, Composer } from '../../components/ChatParts';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Avatar, Banner, EmptyState, IconButton, Screen, T } from '../../components/ui';
import { theme } from '../../constants/theme';
import api, { DoctorChatMessage } from '../../services/api';
import { calls } from '../../services/calls';
import { realtime } from '../../services/realtime';
import { ActivityIndicator, FlatList, View } from '../../components/themed';

const C = theme.COLORS;
const clock = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');

/** Live chat with the patient's linked doctor. The doctor's website and this screen share one thread, delivered over the websocket. */
export default function DoctorChat() {
  const router = useRouter();
  const [msgs, setMsgs] = useState<DoctorChatMessage[]>([]);
  const [doctor, setDoctor] = useState<{ full_name: string } | null>(null);
  const [peer, setPeer] = useState(0);
  const [online, setOnline] = useState<boolean | undefined>(undefined);
  const [typing, setTyping] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasTyping = useRef(false);
  const peerRef = useRef(0);

  const load = useCallback(async () => {
    try {
      const t = await api.getDoctorThread();
      setMsgs(t.messages); setDoctor(t.doctor); setPeer(t.peer_id); peerRef.current = t.peer_id; setOnline(t.peer_online); setError(null);
      if (t.messages.some((m) => m.sender_role === 'doctor' && !m.read_at)) api.markDoctorThreadRead().catch(() => {});
    } catch (e: any) { setError(e?.message || 'Could not load the chat.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { realtime.start(); load(); }, [load]);

  useEffect(() => {
    const offs = [
      realtime.on('doctor_message.new', (e) => {
        setMsgs((p) => (p.some((m) => m.id === e.message.id) ? p : [...p, e.message]));
        setTyping(false);
        api.markDoctorThreadRead().catch(() => {});
      }),
      realtime.on('doctor_message.read', () => {
        const now = new Date().toISOString();
        setMsgs((p) => p.map((m) => (m.sender_role === 'patient' && !m.read_at ? { ...m, read_at: now } : m)));
      }),
      realtime.on('typing', (e) => {
        if (e.from_user_id !== peerRef.current) return;
        setTyping(!!e.is_typing);
        if (peerTimer.current) clearTimeout(peerTimer.current);
        if (e.is_typing) peerTimer.current = setTimeout(() => setTyping(false), 5000);
      }),
      realtime.on('presence', (e) => { if (e.user_id === peerRef.current) setOnline(!!e.online); }),
      realtime.onStatus((c) => { if (c) load(); }),
    ];
    return () => { offs.forEach((o) => o()); if (typingTimer.current) clearTimeout(typingTimer.current); if (peerTimer.current) clearTimeout(peerTimer.current); };
  }, [load]);

  const onChange = (v: string) => {
    setText(v);
    if (!peerRef.current) return;
    if (!wasTyping.current && v.length > 0) { wasTyping.current = true; realtime.send({ type: 'typing', to_user_id: peerRef.current, is_typing: true }); }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => { wasTyping.current = false; realtime.send({ type: 'typing', to_user_id: peerRef.current, is_typing: false }); }, 2000);
  };

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true); setText(''); wasTyping.current = false;
    const temp: DoctorChatMessage = { id: -Date.now(), sender_role: 'patient', content: body, created_at: new Date().toISOString(), read_at: null };
    setMsgs((p) => [...p, temp]);
    try { const saved = await api.sendDoctorMessage(body); setMsgs((p) => p.map((m) => (m.id === temp.id ? saved : m))); }
    catch (e: any) { setMsgs((p) => p.filter((m) => m.id !== temp.id)); setText(body); setError(e?.message || 'Message not sent'); }
    finally { setSending(false); }
  };

  const data = useMemo(() => [...msgs].reverse(), [msgs]);
  const name = doctor?.full_name || 'My doctor';
  const canCall = !!peer && online !== false && calls.available;

  return (
    <ProtectedRoute>
      <Screen scroll={false} keyboard
        header={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingBottom: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: C.separator }}>
            <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
            <Avatar name={name} size={40} online={online} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T v="heading" numberOfLines={1}>{name}</T>
              <T v="caption" color={typing ? C.primary : C.textSecondary}>{typing ? 'typing...' : online === undefined ? '' : online ? 'Online' : 'Offline'}</T>
            </View>
            {canCall ? <>
              <IconButton icon="call-outline" label={`Voice call ${name}`} onPress={() => calls.start(peer, name, 'audio')} />
              <IconButton icon="videocam-outline" label={`Video call ${name}`} onPress={() => calls.start(peer, name, 'video')} />
            </> : null}
          </View>}
        footer={<Composer value={text} onChange={onChange} onSend={send} sending={sending} safeBottom placeholder="Write to your doctor" maxLength={1000} />}
      >
        <ChatWallpaper>
        {error ? <View style={{ padding: 12 }}><Banner tone="danger" text={error} action="Dismiss" onAction={() => setError(null)} /></View> : null}
        {loading ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.primary} /></View> : (
          <FlatList
            inverted
            data={data}
            keyExtractor={(m) => String(m.id)}
            contentContainerStyle={{ padding: 16, flexGrow: 1 }}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
            ListEmptyComponent={<View style={{ transform: [{ scaleY: -1 }] }}><EmptyState icon="chatbubble-outline" title="No messages yet" text="Write to your doctor. They see it the moment it is sent." /></View>}
            renderItem={({ item }) => <Bubble text={item.content} mine={item.sender_role === 'patient'} time={item.id < 0 ? 'Sending...' : `${clock(item.created_at)}${item.sender_role === 'patient' && item.read_at ? '  Read' : ''}`} />}
          />
        )}
        </ChatWallpaper>
      </Screen>
    </ProtectedRoute>
  );
}
