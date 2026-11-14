import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
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

export default function CaregiversScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [caregivers, setCaregivers] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  const loadData = async () => {
    try {
      const [approvedData, pendingData] = await Promise.all([
        api.getAssignedPatients(), // This is actually "get my caregivers" for patients in the backend if called by patient
        api.getIncomingCaregiverRequests()
      ]);
      
      // Note: The backend 'getAssignedPatients' logic for patients returns their caregivers
      setCaregivers(approvedData || []);
      setPendingRequests(pendingData || []);
    } catch (error) {
      console.error('Error loading caregivers:', error);
      Alert.alert('Error', 'Failed to load caregivers');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleRespond = async (requestId: number, action: 'approve' | 'reject') => {
    try {
      await api.respondCaregiverRequest(requestId, action);
      Alert.alert('Success', `Request ${action}ed successfully`);
      loadData();
    } catch (error: any) {
      console.error(`Error ${action}ing request:`, error);
      Alert.alert('Error', error.message || `Failed to ${action} request`);
    }
  };

  const renderPendingRequest = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.avatarContainer}>
          <Text style={styles.avatarText}>{item.caregiver_name?.charAt(0) || 'C'}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.name}>{item.caregiver_name}</Text>
          <Text style={styles.email}>{item.caregiver_email}</Text>
          <Text style={styles.type}>{item.relationship_type}</Text>
        </View>
      </View>
      <View style={styles.actionRow}>
        <TouchableOpacity 
          style={[styles.actionButton, styles.rejectButton]} 
          onPress={() => handleRespond(item.request_id, 'reject')}
        >
          <Text style={styles.rejectButtonText}>Reject</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.actionButton, styles.approveButton]} 
          onPress={() => handleRespond(item.request_id, 'approve')}
        >
          <Text style={styles.approveButtonText}>Approve</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderCaregiver = ({ item }: { item: any }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={[styles.avatarContainer, { backgroundColor: theme.COLORS.successLight }]}>
          <Text style={[styles.avatarText, { color: theme.COLORS.success }]}>{item.username?.charAt(0) || 'C'}</Text>
        </View>
        <View style={styles.cardInfo}>
          <Text style={styles.name}>{item.username || item.email}</Text>
          <Text style={styles.email}>{item.email}</Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>APPROVED</Text>
          </View>
        </View>
      </View>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.COLORS.primary} />
      </View>
    );
  }

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
          <Text style={styles.title}>My Caregivers</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView 
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.COLORS.primary} />
          }
        >
          {pendingRequests.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Pending Requests</Text>
              {pendingRequests.map((item) => (
                <View key={item.request_id}>{renderPendingRequest({ item })}</View>
              ))}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Approved Caregivers</Text>
            {caregivers.length > 0 ? (
              caregivers.map((item, index) => (
                <View key={index}>{renderCaregiver({ item })}</View>
              ))
            ) : (
              <View style={styles.emptyState}>
                <Ionicons name="people-outline" size={48} color={theme.COLORS.textTertiary} />
                <Text style={styles.emptyText}>No approved caregivers yet.</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.SHADOWS.small,
  },
  title: {
    ...theme.TYPOGRAPHY.h3,
    color: theme.COLORS.textPrimary,
  },
  scrollContent: {
    paddingHorizontal: theme.SPACING.lg,
    paddingBottom: theme.SPACING.xl,
  },
  section: {
    marginTop: theme.SPACING.lg,
  },
  sectionTitle: {
    ...theme.TYPOGRAPHY.label,
    color: theme.COLORS.textTertiary,
    marginBottom: theme.SPACING.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  card: {
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.md,
    marginBottom: theme.SPACING.md,
    ...theme.SHADOWS.small,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: theme.COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.SPACING.md,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.COLORS.primary,
  },
  cardInfo: {
    flex: 1,
  },
  name: {
    ...theme.TYPOGRAPHY.bodyMedium,
    color: theme.COLORS.textPrimary,
    fontWeight: '700',
  },
  email: {
    ...theme.TYPOGRAPHY.caption,
    color: theme.COLORS.textSecondary,
  },
  type: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.primary,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: theme.SPACING.md,
    gap: theme.SPACING.md,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: theme.LAYOUT.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  approveButton: {
    backgroundColor: theme.COLORS.primary,
  },
  approveButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  rejectButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: theme.COLORS.danger,
  },
  rejectButtonText: {
    color: theme.COLORS.danger,
    fontWeight: '600',
  },
  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: theme.COLORS.successLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    marginTop: 4,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
    color: theme.COLORS.success,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.SPACING.xl,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: theme.LAYOUT.borderRadius.lg,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: theme.COLORS.separator,
  },
  emptyText: {
    ...theme.TYPOGRAPHY.caption,
    color: theme.COLORS.textTertiary,
    marginTop: theme.SPACING.sm,
  },
});
