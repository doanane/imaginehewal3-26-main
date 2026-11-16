import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useState } from 'react';
import { ago, usePull, useRealtimeReload } from '../../components/CareParts';
import ProtectedRoute from '../../components/ProtectedRoute';
import { Banner, Card, EmptyState, IconButton, Screen, ScreenHeader, Skeleton, T } from '../../components/ui';
import type { IconName } from '../../components/ui';
import { theme } from '../../constants/theme';
import api from '../../services/api';
import { Ionicons, RefreshControl, View } from '../../components/themed';

const C = theme.COLORS;
type Item = { id: number; notification_type: string; title: string; message: string; is_read: boolean; created_at: string };

const LOOK: Record<string, { icon: IconName; color: string; to?: string }> = {
  doctor: { icon: 'chatbubble-ellipses-outline', color: C.primary, to: '/(patient)/doctor-chat' },
  appointment: { icon: 'calendar-outline', color: C.info, to: '/(patient)/doctor-appointments' },
  prescription: { icon: 'medkit-outline', color: C.success, to: '/(patient)/doctor-care' },
  caregiver: { icon: 'people-outline', color: C.info, to: '/(patient)/caregivers' },
  emergency: { icon: 'alert-circle-outline', color: C.danger, to: '/(patient)/emergency' },
  risk_alert: { icon: 'warning-outline', color: C.warning },
  medication: { icon: 'medical-outline', color: C.info, to: '/(patient)/medications' },
  achievement: { icon: 'trophy-outline', color: C.success },
};
const look = (t: string) => LOOK[(t || '').toLowerCase()] || { icon: 'notifications-outline' as IconName, color: C.textSecondary };

/** Everything the app and the care team have told you, newest first. Tapping an item opens the screen it is about. */
export default function NotificationsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const g: any = await api.getNotifications();
      const all: Item[] = [...(g?.system || []), ...(g?.caregiver || []), ...(g?.doctor || [])];
      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setItems(all); setError(null);
    } catch (e: any) { setError(e?.message || 'Could not load your notifications.'); setItems((x) => x ?? []); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));
  useRealtimeReload(load, ['notification.new', 'doctor_message.new', 'appointment.update', 'prescription.update']);
  const onRefresh = usePull(load, setRefreshing);

  const open = async (n: Item) => {
    if (!n.is_read) {
      setItems((prev) => (prev || []).map((x) => (x.id === n.id ? { ...x, is_read: true } : x)));
      api.markNotificationRead(n.id).catch(() => {});
    }
    const to = look(n.notification_type).to;
    if (to) router.push(to as any);
  };
  const markAll = async () => {
    const unread = (items || []).filter((n) => !n.is_read);
    setItems((prev) => (prev || []).map((x) => ({ ...x, is_read: true })));
    await Promise.all(unread.map((n) => api.markNotificationRead(n.id).catch(() => {})));
  };
  const unreadCount = (items || []).filter((n) => !n.is_read).length;

  return (
    <ProtectedRoute>
      <Screen
        header={<ScreenHeader title="Notifications" subtitle={unreadCount ? `${unreadCount} unread` : 'All caught up'} onBack={() => router.back()}
          right={unreadCount ? <IconButton icon="checkmark-done-outline" label="Mark all as read" onPress={markAll} /> : undefined} />}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.primary} />} contentStyle={{ gap: 10, paddingBottom: 48 }}>
        {error ? <Banner tone="warning" text={error} action="Try again" onAction={load} /> : null}
        {items === null ? <><Skeleton height={76} /><Skeleton height={76} /><Skeleton height={76} /></> : items.length === 0 ? (
          <EmptyState icon="notifications-off-outline" title="Nothing yet" text="Messages from your doctor, appointment answers, new medicines and alerts appear here." />
        ) : items.map((n) => {
          const l = look(n.notification_type);
          return (
            <Card key={n.id} onPress={() => open(n)}>
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
                <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: `${l.color}1A`, alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name={l.icon} size={20} color={l.color} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}>
                    <T v={n.is_read ? 'body' : 'bodyStrong'} style={{ flex: 1 }} numberOfLines={2}>{n.title}</T>
                    <T v="caption" color={C.textTertiary}>{ago(n.created_at)}</T>
                  </View>
                  <T v="caption" color={C.textSecondary} numberOfLines={3}>{n.message}</T>
                </View>
              </View>
            </Card>
          );
        })}
      </Screen>
    </ProtectedRoute>
  );
}
