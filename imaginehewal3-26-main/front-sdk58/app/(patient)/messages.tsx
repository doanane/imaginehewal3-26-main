import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { Avatar, Badge, EmptyState, IconButton, Screen, ScreenHeader, T } from '../../components/ui';
import { theme } from '../../constants/theme';
import { useMessaging } from '../../contexts/MessagingContext';
import api from '../../services/api';
import { FlatList, Pressable, RefreshControl, View } from '../../components/themed';

const C = theme.COLORS;

function when(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso), now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

/** Every conversation: your linked doctor, caregivers and family. A normal screen (not a tab), so it opens from anywhere and Back returns you. */
export default function Messages() {
  const router = useRouter();
  const { conversations, refreshConversations, isConnected, isLoading } = useMessaging();
  const [refreshing, setRefreshing] = useState(false);
  const [doctor, setDoctor] = useState<{ full_name: string; specialization: string | null } | null>(null);
  useFocusEffect(useCallback(() => { refreshConversations(); api.getMyDoctor().then((r) => setDoctor(r.doctor)).catch(() => {}); }, []));

  return (
    <Screen scroll={false}
      header={<ScreenHeader title="Messages" subtitle={isConnected ? 'Connected' : 'Reconnecting...'} onBack={() => (router.canGoBack() ? router.back() : router.replace('/(patient)/(tabs)/today' as any))}
        right={<IconButton icon="person-add-outline" label="Add a caregiver" onPress={() => router.push('/(patient)/caregivers' as any)} />} />}>
      <FlatList
        data={conversations}
        ListHeaderComponent={doctor ? (
          <Pressable onPress={() => router.push('/(patient)/doctor-chat' as any)} accessibilityRole="button" accessibilityLabel={`Open chat with ${doctor.full_name}`}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}>
            <Avatar name={doctor.full_name} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <T v="bodyStrong" numberOfLines={1}>{doctor.full_name}</T>
              <T v="caption" color={C.textSecondary} numberOfLines={1}>{doctor.specialization || 'Your doctor'}. Chat or call.</T>
            </View>
            <Badge label="My doctor" tone="info" />
          </Pressable>) : undefined}
        keyExtractor={(c) => String(c.user_id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 }}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={C.primary}
          onRefresh={async () => { setRefreshing(true); await refreshConversations(); setRefreshing(false); }} />}
        ListEmptyComponent={!isLoading && !doctor ? (
          <EmptyState icon="people-outline" title="No care team yet"
            text="Add a family member, caregiver or doctor. Once they approve, you can message them here and they can look out for you."
            action="Add a caregiver" onAction={() => router.push('/(patient)/caregivers' as any)} />
        ) : undefined}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: C.separator, marginLeft: 60 }} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push({ pathname: '/(patient)/thread' as any, params: { userId: String(item.user_id), name: item.user_name } })}
            accessibilityRole="button" accessibilityLabel={`Open conversation with ${item.user_name}`}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, opacity: pressed ? 0.7 : 1 })}>
            <Avatar name={item.user_name} online={item.is_online} />
            <View style={{ flex: 1, minWidth: 0 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <T v="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>{item.user_name}</T>
                <T v="caption" color={C.textTertiary}>{when(item.last_message_time)}</T>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <T v="caption" color={item.unread_count ? C.textPrimary : C.textSecondary} numberOfLines={1} style={{ flex: 1, fontWeight: item.unread_count ? '600' : '400' }}>
                  {item.last_message || 'Say hello'}</T>
                {item.unread_count ? <Badge label={String(item.unread_count)} tone="danger" /> : null}
              </View>
              <T v="caption" color={C.textTertiary} style={{ textTransform: 'capitalize' }}>{item.user_type}</T>
            </View>
          </Pressable>
        )}
      />
    </Screen>
  );
}
