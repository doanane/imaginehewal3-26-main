import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import api from '../../../services/api';
import { theme } from '../../../constants/theme';

export default function HealthScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [healthData, setHealthData] = useState<any>(null);
  const [weeklyProgress, setWeeklyProgress] = useState<any>(null);

  const loadHealthData = async () => {
    try {
      const [health, progress] = await Promise.all([
        api.getHealthSnapshot(),
        api.getWeeklyProgress(),
      ]);
      setHealthData(health);
      setWeeklyProgress(progress);
    } catch (error) {
      console.error('Error loading health data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadHealthData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadHealthData();
  };

  if (loading) {
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
          <Text style={styles.title}>Health Metrics</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.COLORS.primary} />
          }
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Metrics</Text>
            <View style={styles.metricsGrid}>
              <View style={styles.metricCard}>
                <View style={[styles.iconCircle, { backgroundColor: theme.COLORS.infoLight }]}>
                  <MaterialCommunityIcons name="walk" size={24} color={theme.COLORS.info} />
                </View>
                <Text style={styles.metricValue}>{healthData?.steps || 0}</Text>
                <Text style={styles.metricLabel}>Steps</Text>
              </View>

              <View style={styles.metricCard}>
                <View style={[styles.iconCircle, { backgroundColor: '#E0F2FE' }]}>
                  <Ionicons name="water-outline" size={24} color="#0ea5e9" />
                </View>
                <Text style={styles.metricValue}>{healthData?.water_intake || 0}</Text>
                <Text style={styles.metricLabel}>ml Water</Text>
              </View>

              <View style={styles.metricCard}>
                <View style={[styles.iconCircle, { backgroundColor: theme.COLORS.warningLight }]}>
                  <Ionicons name="bed-outline" size={24} color={theme.COLORS.warning} />
                </View>
                <Text style={styles.metricValue}>{healthData?.sleep_time || 0}</Text>
                <Text style={styles.metricLabel}>Hours Sleep</Text>
              </View>

              <View style={styles.metricCard}>
                <View style={[styles.iconCircle, { backgroundColor: theme.COLORS.dangerLight }]}>
                  <MaterialCommunityIcons name="heart-pulse" size={24} color={theme.COLORS.danger} />
                </View>
                <Text style={styles.metricValue}>{healthData?.heart_rate || 0}</Text>
                <Text style={styles.metricLabel}>BPM</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Weekly Progress</Text>
            <View style={styles.progressCard}>
              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>Avg Steps</Text>
                <Text style={styles.progressValue}>{weeklyProgress?.avg_steps || 0}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>Avg Sleep</Text>
                <Text style={styles.progressValue}>{weeklyProgress?.avg_sleep || 0}h</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.progressItem}>
                <Text style={styles.progressLabel}>Water Intake</Text>
                <Text style={styles.progressValue}>{weeklyProgress?.total_water || 0}L</Text>
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Actions</Text>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => router.push('/(patient)/nutrition/food-log')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[theme.COLORS.primary, theme.COLORS.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionGradient}
              >
                <Ionicons name="restaurant-outline" size={24} color="white" />
                <Text style={styles.actionButtonText}>Log Meal</Text>
                <Ionicons name="chevron-forward" size={20} color="white" style={{ marginLeft: 'auto' }} />
              </LinearGradient>
            </TouchableOpacity>
            
            <TouchableOpacity
              style={[styles.actionButton, { marginTop: 12 }]}
              onPress={() => router.push('/(patient)/health/log-health')}
              activeOpacity={0.8}
            >
              <View style={styles.secondaryAction}>
                <Ionicons name="add-circle-outline" size={24} color={theme.COLORS.primary} />
                <Text style={styles.secondaryActionText}>Log Health Metrics</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.COLORS.textTertiary} style={{ marginLeft: 'auto' }} />
              </View>
            </TouchableOpacity>
          </View>
          
          <View style={{ height: 40 }} />
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
  content: {
    flex: 1,
    paddingHorizontal: theme.SPACING.lg,
  },
  section: {
    marginBottom: theme.SPACING.xl,
  },
  sectionTitle: {
    ...theme.TYPOGRAPHY.h3,
    fontSize: 18,
    color: theme.COLORS.textPrimary,
    marginBottom: theme.SPACING.md,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: theme.SPACING.md,
  },
  metricCard: {
    width: '47%',
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.md,
    alignItems: 'center',
    ...theme.SHADOWS.small,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: theme.LAYOUT.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.SPACING.sm,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.COLORS.textPrimary,
    marginBottom: 2,
  },
  metricLabel: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textSecondary,
  },
  progressCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.lg,
    ...theme.SHADOWS.small,
  },
  progressItem: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    height: '100%',
    backgroundColor: theme.COLORS.separator,
  },
  progressLabel: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textSecondary,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.COLORS.primary,
  },
  actionButton: {
    borderRadius: theme.LAYOUT.borderRadius.lg,
    ...theme.SHADOWS.small,
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.SPACING.md,
    paddingHorizontal: theme.SPACING.lg,
    borderRadius: theme.LAYOUT.borderRadius.lg,
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.COLORS.card,
    paddingVertical: theme.SPACING.md,
    paddingHorizontal: theme.SPACING.lg,
    borderRadius: theme.LAYOUT.borderRadius.lg,
  },
  secondaryActionText: {
    color: theme.COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
});
