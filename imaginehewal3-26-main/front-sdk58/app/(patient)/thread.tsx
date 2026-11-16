import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bubble, ChatWallpaper, Composer } from '../../components/ChatParts';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Avatar, Banner, EmptyState, Screen, T, IconButton } from '../../components/ui';
import { theme } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import messagingService, { Message } from '../../services/messaging';
import { calls } from '../../services/calls';
import { realtime } from '../../services/realtime';
import { ActivityIndicator, FlatList, View } from '../../components/themed';

const C = theme.COLORS;
const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
const byTime = (a: Message, b: Message) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime() || a.id - b.id;

export default function Thread() {
  const router = useRouter();
  const { user } = useAuth();
  const { userId, name } = useLocalSearchParams<{ userId: string; name: string }>();
  const peerId = Number(userId);
  const me = Number(user?.id);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [online, setOnline] = useState<boolean | undefined>(undefined);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const peerTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wasTyping = useRef(false);

  const markRead = useCallback((list: Message[]) => {
    const ids = list.filter((m) => m.sender_id === peerId && !m.is_read).map((m) => m.id);
    if (ids.length) messagingService.markMessagesAsRead(ids).catch(() => {});
  }, [peerId]);

  const load = useCallback(async () => {
    try {
      const list = await messagingService.getConversationMessages(peerId, 100, 0);
      const sorted = [...list].sort(byTime);
      setMessages(sorted); markRead(sorted); setError(null);
    } catch (e: any) { setError(e.message || 'Could not load messages'); }
    finally { setLoading(false); }
  }, [peerId, markRead]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const offs = [
      realtime.on('message.new', (e) => {
        const m: Message = e.message;
        if (m.sender_id !== peerId) return;
        setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m].sort(byTime));
        markRead([m]); setPeerTyping(false);
      }),
      realtime.on('typing', (e) => {
        if (e.from_user_id !== peerId) return;
        setPeerTyping(!!e.is_typing);
        if (peerTypingTimer.current) clearTimeout(peerTypingTimer.current);
        if (e.is_typing) peerTypingTimer.current = setTimeout(() => setPeerTyping(false), 5000);
      }),
      realtime.on('presence', (e) => { if (e.user_id === peerId) setOnline(!!e.online); }),
      realtime.onStatus((c) => { if (c) load(); }),   // catch up on anything missed while offline
    ];
    return () => { offs.forEach((o) => o()); if (typingTimer.current) clearTimeout(typingTimer.current); if (peerTypingTimer.current) clearTimeout(peerTypingTimer.current); };
  }, [peerId, load, markRead]);

  const onChange = (v: string) => {
    setText(v);
    if (!wasTyping.current && v.length > 0) { wasTyping.current = true; messagingService.sendTypingStatus(peerId, true); }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => { wasTyping.current = false; messagingService.sendTypingStatus(peerId, false); }, 2000);
  };

  const send = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true); setText(''); wasTyping.current = false; messagingService.sendTypingStatus(peerId, false);
    const temp: Message = { id: -Date.now(), sender_id: me, receiver_id: peerId, content, is_read: false, created_at: new Date().toISOString() };
    setMessages((p) => [...p, temp]);
    try {
      const saved = await messagingService.sendMessage(peerId, content);
      setMessages((p) => p.map((m) => (m.id === temp.id ? saved : m)));
    } catch (e: any) {
      setMessages((p) => p.filter((m) => m.id !== temp.id));
      setText(content); setError(e.message || 'Message not sent');
    } finally { setSending(false); }
  };

  const data = useMemo(() => [...messages].reverse(), [messages]);   // inverted list: newest at the bottom

  return (
    <ProtectedRoute>
      <Screen scroll={false} keyboard
        header={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 8, paddingBottom: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: C.separator }}>
            <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
            <Avatar name={String(name || '')} size={40} online={online} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T v="heading" numberOfLines={1}>{name}</T>
              <T v="caption" color={peerTyping ? C.primary : C.textSecondary}>{peerTyping ? 'typing...' : online === undefined ? '' : online ? 'Online' : 'Offline'}</T>
            </View>
            {calls.available && online !== false ? <>
              <IconButton icon="call-outline" label={`Voice call ${name}`} onPress={() => calls.start(peerId, String(name || ''), 'audio')} />
              <IconButton icon="videocam-outline" label={`Video call ${name}`} onPress={() => calls.start(peerId, String(name || ''), 'video')} />
            </> : null}
          </View>}
        footer={<Composer value={text} onChange={onChange} onSend={send} sending={sending} safeBottom placeholder="Write a message" />}
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
            ListEmptyComponent={<View style={{ transform: [{ scaleY: -1 }] }}><EmptyState icon="chatbubble-outline" title="No messages yet" text={`Send ${name || 'them'} a message. It is delivered instantly.`} /></View>}
            renderItem={({ item }) => <Bubble text={item.content} mine={item.sender_id === me} time={item.id < 0 ? 'Sending...' : clock(item.created_at)} />}
          />
        )}
        </ChatWallpaper>
      </Screen>
    </ProtectedRoute>
  );
}
