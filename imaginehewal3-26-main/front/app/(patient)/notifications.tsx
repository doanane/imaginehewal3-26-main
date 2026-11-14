import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    RefreshControl,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';
import api from '../../services/api';

export default function NotificationsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);

  const loadNotifications = async () => {
    try {
      const response = await api.getNotifications();
      // Flatten grouped notifications response into single array
      let allNotifications: any[] = [];
      if (response && typeof response === 'object') {
        const groups = (response as any);
        if (Array.isArray(groups.system)) allNotifications = [...allNotifications, ...groups.system];
        if (Array.isArray(groups.caregiver)) allNotifications = [...allNotifications, ...groups.caregiver];
        if (Array.isArray(groups.doctor)) allNotifications = [...allNotifications, ...groups.doctor];
        // Sort by created_at descending
        allNotifications.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      }
      setNotifications(allNotifications);
    } catch (error) {
      console.error('Error loading notifications:', error);
      Alert.alert('Error', 'Failed to load notifications');
      setNotifications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadNotifications();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadNotifications();
  };

  const handleMarkAsRead = async (notificationId: number) => {
    try {
      await api.markNotificationRead(notificationId);
      setNotifications(prev =>
        prev.map(notif =>
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const allNotifications = Array.isArray(notifications) ? notifications : [];
      const unreadNotifications = allNotifications.filter(n => !n.is_read);
      await Promise.all(
        unreadNotifications.map(notif => api.markNotificationRead(notif.id))
      );
      setNotifications(prev =>
        (Array.isArray(prev) ? prev : []).map(notif => ({ ...notif, is_read: true }))
      );
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  const renderNotification = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={[styles.notificationItem, !item.is_read && styles.unreadItem]}
      onPress={() => {
        handleMarkAsRead(item.id);
        if (item.notification_type === 'caregiver') {
          router.push('/(patient)/caregivers');
        }
      }}
      activeOpacity={0.7}
    >
      <View style={[styles.notificationIcon, { backgroundColor: `${getNotificationColor(item.notification_type)}15` }]}>
        <Ionicons 
          name={getNotificationIcon(item.notification_type)} 
          size={24} 
          color={getNotificationColor(item.notification_type)} 
        />
      </View>
      <View style={styles.notificationContent}>
        <View style={styles.notificationHeader}>
          <Text style={[styles.notificationTitle, !item.is_read && styles.unreadTitle]}>{item.title}</Text>
          <Text style={styles.notificationTime}>{formatTime(item.created_at)}</Text>
        </View>
        <Text style={styles.notificationMessage} numberOfLines={2}>
          {item.message}
        </Text>
      </View>
      {!item.is_read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );

  const getNotificationIcon = (type: string): any => {
    switch (type?.toLowerCase()) {
      case 'medication': return 'medical';
      case 'reminder': return 'alarm';
      case 'alert': return 'warning';
      case 'achievement': return 'trophy';
      case 'message': return 'chatbubble';
      default: return 'notifications';
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'medication': return theme.COLORS.info;
      case 'alert': return theme.COLORS.danger;
      case 'achievement': return theme.COLORS.success;
      case 'message': return '#8b5cf6';
      default: return theme.COLORS.textSecondary;
    }
  };

  const formatTime = (timestamp: string) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  const unreadCount = (notifications || []).filter(n => !n.is_read).length;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        colors={[theme.COLORS.background, '#E0F2FE', '#DBEAFE']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Notifications</Text>
          {unreadCount > 0 ? (
            <TouchableOpacity onPress={handleMarkAllAsRead}>
              <Text style={styles.markAllText}>Mark all read</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 80 }} /> // Placeholder to balance header
          )}
        </View>

        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{notifications.length}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: theme.COLORS.danger }]}>{unreadCount}</Text>
            <Text style={styles.statLabel}>Unread</Text>
          </View>
        </View>

        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.COLORS.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="notifications-off-outline" size={48} color={theme.COLORS.textTertiary} />
              </View>
              <Text style={styles.emptyTitle}>No notifications yet</Text>
              <Text style={styles.emptyText}>
                You're all caught up! Check back later for updates.
              </Text>
            </View>
          }
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.SPACING.lg,
    paddingVertical: theme.SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: theme.LAYOUT.borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.SHADOWS.small,
  },
  title: {
    ...theme.TYPOGRAPHY.h3,
    color: theme.COLORS.textPrimary,
  },
  markAllText: {
    ...theme.TYPOGRAPHY.captionMedium,
    color: theme.COLORS.primary,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: theme.COLORS.card,
    marginHorizontal: theme.SPACING.lg,
    marginBottom: theme.SPACING.md,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.lg,
    ...theme.SHADOWS.small,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.COLORS.textPrimary,
  },
  statLabel: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textSecondary,
    marginTop: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: '100%',
    backgroundColor: theme.COLORS.separator,
  },
  listContent: {
    paddingHorizontal: theme.SPACING.lg,
    paddingBottom: theme.SPACING.xl,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.md,
    marginBottom: theme.SPACING.sm,
    ...theme.SHADOWS.small,
  },
  unreadItem: {
    backgroundColor: '#F0F9FF', // Light blue tint
    borderLeftWidth: 4,
    borderLeftColor: theme.COLORS.primary,
  },
  notificationIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.LAYOUT.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.SPACING.md,
  },
  notificationContent: {
    flex: 1,
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    ...theme.TYPOGRAPHY.bodyMedium,
    color: theme.COLORS.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  unreadTitle: {
    fontWeight: '700',
    color: theme.COLORS.primary,
  },
  notificationMessage: {
    ...theme.TYPOGRAPHY.caption,
    color: theme.COLORS.textSecondary,
    lineHeight: 20,
  },
  notificationTime: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textTertiary,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.COLORS.primary,
    marginLeft: 8,
    marginTop: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: theme.SPACING.xxl,
    marginTop: theme.SPACING.xl,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: theme.LAYOUT.borderRadius.full,
    backgroundColor: theme.COLORS.separator,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.SPACING.md,
    opacity: 0.5,
  },
  emptyTitle: {
    ...theme.TYPOGRAPHY.h3,
    color: theme.COLORS.textSecondary,
    marginBottom: theme.SPACING.sm,
  },
  emptyText: {
    ...theme.TYPOGRAPHY.caption,
    color: theme.COLORS.textTertiary,
    textAlign: 'center',
    paddingHorizontal: theme.SPACING.xl,
    lineHeight: 20,
  },
});