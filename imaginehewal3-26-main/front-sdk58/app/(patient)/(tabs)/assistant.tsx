import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking } from 'react-native';
import { Bubble, Composer, ChatWallpaper } from '../../../components/ChatParts';
import { ReadAloud } from '../../../components/ReadAloud';
import { ActivityIndicator, FlatList, Pressable, ScrollView, View } from '../../../components/themed';
import { Button, Chip, IconButton, Screen, ScreenHeader, T } from '../../../components/ui';
import { EMERGENCY_NUMBER } from '../../../constants/behavior';
import { theme } from '../../../constants/theme';
import { useToast } from '../../../contexts/ToastContext';
import api, { AssistantMessage } from '../../../services/api';
import { copyText } from '../../../services/speech';

const C = theme.COLORS;
const STARTERS = [
  'What should I eat to feel healthier?',
  'Help me prepare questions for my clinic visit',
  'How can I sleep better?',
  'How do I remember to take my medicine?',
];
const STREAMING_ID = -1;
const clock = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '');

export default function Assistant() {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [waiting, setWaiting] = useState(false);          // sent, no word back yet
  const [starters, setStarters] = useState<string[]>(STARTERS);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [aiOn, setAiOn] = useState(true);
  const abort = useRef<AbortController | null>(null);
  const { showToast } = useToast();
  const copy = useCallback(async (value: string) => {
    const how = await copyText(value);
    showToast(how === 'copied' ? 'Copied to your clipboard' : how === 'shared' ? 'Choose where to send it' : 'Could not copy this', how === 'failed' ? 'error' : 'success');
  }, [showToast]);

  useEffect(() => {
    api.getAssistantHistory(60).then(setMessages).catch(() => {}).finally(() => setLoading(false));
    api.getAssistantSuggestions().then((r) => { if (r.suggestions.length) setStarters(r.suggestions); setAiOn(r.ai); }).catch(() => {});
    return () => abort.current?.abort();
  }, []);

  const send = useCallback(async (raw?: string) => {
    const content = (raw ?? text).trim();
    if (!content || busy) return;
    const tempUser: AssistantMessage = { id: -Date.now(), role: 'user', content, emergency: false, source: 'user', created_at: new Date().toISOString() };
    setMessages((p) => [...p, tempUser]); setText(''); setBusy(true); setWaiting(true); setFollowUps([]);
    let gotWords = false;
    abort.current = new AbortController();
    try {
      await api.streamAssistantMessage(content, {
        onMeta: (u) => setMessages((p) => p.map((m) => (m.id === tempUser.id ? u : m))),
        onToken: (t) => {
          gotWords = true; setWaiting(false);
          setMessages((p) => {
            const last = p[p.length - 1];
            if (last && last.id === STREAMING_ID) return [...p.slice(0, -1), { ...last, content: last.content + t }];
            return [...p, { id: STREAMING_ID, role: 'assistant', content: t, emergency: false, source: 'gemini', created_at: null }];
          });
        },
        onDone: (a, ideas) => {
          setMessages((p) => [...p.filter((m) => m.id !== STREAMING_ID), a]);
          setFollowUps(ideas);
        },
      }, abort.current.signal);
    } catch (e: any) {
      if (gotWords) {                                                   // it was cut short: keep what arrived
        setMessages((p) => p.map((m) => (m.id === STREAMING_ID ? { ...m, id: -Date.now() - 1, created_at: new Date().toISOString() } : m)));
      } else {
        try {                                                           // the stream could not start: ask for the whole answer instead
          const res = await api.sendAssistantMessage(content);
          setMessages((p) => [...p.filter((m) => m.id !== tempUser.id && m.id !== STREAMING_ID), res.user, res.assistant]);
          setFollowUps(res.suggestions || []);
        } catch (e2: any) {
          setMessages((p) => p.filter((m) => m.id !== tempUser.id && m.id !== STREAMING_ID));
          setText(content);
          Alert.alert('Message not sent', e2?.message || e?.message || 'Please try again.');
        }
      }
    } finally { setBusy(false); setWaiting(false); }
  }, [text, busy]);

  const clear = () => Alert.alert('Delete conversation?', 'This permanently removes your chat history with the assistant.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: async () => { await api.clearAssistantHistory(); setMessages([]); setFollowUps([]); } }]);

  const data = useMemo(() => [...messages].reverse(), [messages]);
  const lastIsAnswer = messages.length > 0 && messages[messages.length - 1].role === 'assistant' && !busy;
  const chips = lastIsAnswer ? followUps : [];

  return (
    <Screen scroll={false} keyboard
      header={<ScreenHeader title="Health assistant" subtitle={aiOn ? 'AI guidance from your own data. Not a diagnosis.' : 'Basic mode. Not a diagnosis.'}
        right={messages.length ? <IconButton icon="trash-outline" label="Delete conversation" onPress={clear} color={C.textSecondary} /> : undefined} />}
      footer={
        <View>
          {chips.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 8, gap: 8 }}>
              {chips.map((s) => <Chip key={s} label={s} onPress={() => send(s)} />)}
            </ScrollView>
          ) : null}
          <Composer value={text} onChange={setText} onSend={() => send()} sending={busy} placeholder="Ask about your health" />
        </View>
      }>
      <ChatWallpaper>
      {loading ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={C.primary} /></View> : (
        <FlatList
          inverted
          data={data}
          keyExtractor={(m) => String(m.id)}
          contentContainerStyle={{ padding: 16, flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          ListHeaderComponent={waiting ? (
            <View style={{ alignSelf: 'flex-start', marginVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator size="small" color={C.primary} /><T v="caption" color={C.textSecondary}>Thinking...</T>
            </View>) : undefined}
          ListEmptyComponent={
            <View style={{ transform: [{ scaleY: -1 }], paddingTop: 8 }}>
              <T v="title">How can I help today?</T>
              <T v="caption" color={C.textSecondary} style={{ marginTop: 4, marginBottom: 16 }}>
                Ask anything about your health, food, medicines, activity, sleep or how to use HEWAL3. I use your own readings to answer. For an emergency, call {EMERGENCY_NUMBER}.</T>
              <View style={{ gap: 8 }}>{starters.map((s) => <Chip key={s} label={s} onPress={() => send(s)} />)}</View>
            </View>}
          renderItem={({ item }) => item.role === 'user' ? (
            <Bubble text={item.content} mine time={item.id < 0 ? 'Sending...' : clock(item.created_at)} />
          ) : (
            <Bubble text={item.content} tone={item.emergency ? 'danger' : 'default'} time={item.id === STREAMING_ID ? '' : clock(item.created_at)}
              footer={
                <View>
                  {item.emergency ? <View style={{ marginTop: 12 }}><Button title={`Call ${EMERGENCY_NUMBER}`} icon="call" variant="danger" onPress={() => Linking.openURL(`tel:${EMERGENCY_NUMBER}`)} /></View> : null}
                  {item.id !== STREAMING_ID && !item.emergency ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 4 }}>
                      <ReadAloud text={item.content} label="Listen" />
                      <Pressable onPress={() => copy(item.content)} accessibilityRole="button" accessibilityLabel="Copy answer" hitSlop={8} style={{ minHeight: 44, justifyContent: 'center' }}>
                        <T v="label" color={C.primary}>Copy</T>
                      </Pressable>
                    </View>
                  ) : null}
                  {item.source === 'offline' ? <T v="caption" color={C.textTertiary} style={{ marginTop: 8, fontSize: 12 }}>Basic mode: the AI assistant is unavailable right now.</T> : null}
                </View>} />
          )}
        />
      )}
      </ChatWallpaper>
    </Screen>
  );
}
