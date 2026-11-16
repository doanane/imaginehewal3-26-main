import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { useRealtimeReload, usePull, ago } from '../../components/CareParts';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Avatar, Badge, Banner, Card, EmptyState, Screen, ScreenHeader, Section, Skeleton, T } from '../../components/ui';
import { theme } from '../../constants/theme';
import api, { AssignedPatient } from '../../services/api';
import messagingService, { Conversation } from '../../services/messaging';
import { RefreshControl, View } from '../../components/themed';

const C = theme.COLORS;

/** Real conversations with the people you care for. A new message arrives instantly; tap a name to open the chat or start one. */
export default function CaregiverMessaging() {
  const router = useRouter();
  const [chats, setChats] = useState<Conversation[] | null>(null);
  const [patients, setPatients] = useState<AssignedPatient[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [c, p] = await Promise.all([messagingService.getConversations(), api.getAssignedPatients().catch(() => [] as AssignedPatient[])]);
      setChats(c); setPatients(p); setError(null);
    } catch (e: any) { setError(e?.message || 'Could not load your messages.'); setChats((c) => c ?? []); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useRealtimeReload(load, ['message.new', 'presence']);
  const onRefresh = usePull(load, setRefreshing);

  const open = (userId: number, name: string) => router.push({ pathname: '/(patient)/thread', params: { userId: String(userId), name } });
  const talking = new Set((chats || []).map((c) => c.user_id));
  const fresh = patients.filter((p) => !talking.has(p.id));

  return (
    <ProtectedRoute>
      <Screen header={<ScreenHeader title="Messages" subtitle="Chat and call your patients" onBack={() => router.back()} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />} contentStyle={{ gap: 14, paddingBottom: 48 }}>
        {error ? <Banner tone="warning" text={error} action="Try again" onAction={load} /> : null}
        {chats === null ? <><Skeleton height={72} /><Skeleton height={72} /></> : (
          <>
            <Section title="Conversations">
              {chats.length === 0 ? <EmptyState icon="chatbubbles-outline" title="No conversations yet" text={patients.length ? 'Start one with a patient below.' : 'Link a patient first. You can message people who approved you as their caregiver.'} /> : chats.map((c) => (
                <Card key={c.user_id} onPress={() => open(c.user_id, c.user_name)} style={{ marginBottom: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Avatar name={c.user_name} online={c.is_online} />
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <T v="bodyStrong" numberOfLines={1}>{c.user_name}</T>
                      <T v="caption" color={C.textSecondary} numberOfLines={1}>{c.last_message || 'No messages yet'}</T>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      {c.last_message_time ? <T v="caption" color={C.textTertiary}>{ago(c.last_message_time)}</T> : null}
                      {c.unread_count > 0 ? <Badge label={String(c.unread_count)} tone="danger" /> : null}
                    </View>
                  </View>
                </Card>
              ))}
            </Section>
            {fresh.length > 0 ? (
              <Section title="Start a conversation">
                {fresh.map((p) => (
                  <Card key={p.id} onPress={() => open(p.id, p.patient_name)} style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                      <Avatar name={p.patient_name} />
                      <T v="bodyStrong" style={{ flex: 1 }} numberOfLines={1}>{p.patient_name}</T>
                    </View>
                  </Card>
                ))}
              </Section>
            ) : null}
          </>
        )}
      </Screen>
    </ProtectedRoute>
  );
}
