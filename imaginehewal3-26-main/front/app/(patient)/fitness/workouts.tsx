// app/(patient)/fitness/workouts.tsx - Fixed version
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNutrition } from '../../../contexts/NutritionContext';
import { useToast } from '../../../contexts/ToastContext';
import { theme } from '../../../constants/theme';

export default function WorkoutsScreen() {
  const router = useRouter();
  const { workouts, removeWorkout } = useNutrition();
  const { showToast } = useToast();
  
  const [refreshing, setRefreshing] = useState(false);

  const handleDeleteWorkout = (workoutId: string, workoutName: string) => {
    Alert.alert(
      'Delete Workout',
      `Are you sure you want to delete "${workoutName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeWorkout(workoutId);
              showToast({
                message: 'Workout deleted successfully',
                type: 'success',
                duration: 3000,
              });
            } catch (error) {
              showToast({
                message: 'Failed to delete workout',
                type: 'error',
                duration: 3000,
              });
            }
          },
        },
      ]
    );
  };

  const getWorkoutIcon = (type: string) => {
    switch (type) {
      case 'cardio': return 'walk-outline';
      case 'strength': return 'barbell-outline';
      case 'flexibility': return 'body-outline';
      case 'balance': return 'footsteps-outline';
      default: return 'fitness-outline';
    }
  };

  const getWorkoutColor = (type: string) => {
    switch (type) {
      case 'cardio': return theme.COLORS.danger;
      case 'strength': return theme.COLORS.info;
      case 'flexibility': return theme.COLORS.success;
      case 'balance': return theme.COLORS.warning;
      default: return theme.COLORS.textSecondary;
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    }
  };

  const groupWorkoutsByDate = () => {
    const groups: { [key: string]: any[] } = {};
    
    workouts.sort((a, b) => b.timestamp - a.timestamp).forEach(workout => {
      const dateKey = formatDate(workout.timestamp);
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(workout);
    });
    
    return Object.entries(groups);
  };

  const workoutGroups = groupWorkoutsByDate();

  const renderWorkoutItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.workoutItem}
      activeOpacity={0.7}
      onPress={() => {
        Alert.alert(
          item.name,
          `${item.type.charAt(0).toUpperCase() + item.type.slice(1)}\n` +
          `Duration: ${item.duration} minutes\n` +
          `Calories Burned: ${item.caloriesBurned}\n` +
          `Date: ${new Date(item.timestamp).toLocaleDateString()} ${new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
          [{ text: 'OK', style: 'default' }]
        );
      }}
    >
      <View style={styles.workoutLeft}>
        <View style={[styles.workoutIcon, { backgroundColor: `${getWorkoutColor(item.type)}20` }]}>
          <Ionicons name={getWorkoutIcon(item.type) as any} size={20} color={getWorkoutColor(item.type)} />
        </View>
        <View style={styles.workoutInfo}>
          <Text style={styles.workoutName}>{item.name}</Text>
          <Text style={styles.workoutDetails}>
            {item.type.charAt(0).toUpperCase() + item.type.slice(1)} • {item.duration} min • {item.caloriesBurned} cal
          </Text>
        </View>
      </View>
      <View style={styles.workoutRight}>
        <Text style={styles.workoutTime}>
          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
        <TouchableOpacity 
          style={styles.deleteButton}
          onPress={() => handleDeleteWorkout(item.id, item.name)}
        >
          <Ionicons name="trash-outline" size={18} color={theme.COLORS.textTertiary} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  const renderDateGroup = ([date, workouts]: [string, any[]]) => (
    <View key={date} style={styles.dateGroup}>
      <Text style={styles.dateHeader}>{date}</Text>
      {workouts.map(workout => (
        <View key={workout.id}>
          {renderWorkoutItem({ item: workout })}
        </View>
      ))}
    </View>
  );

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
          <Text style={styles.title}>Workout History</Text>
          <TouchableOpacity onPress={() => router.push('/(patient)/fitness/log-workout' as any)} style={styles.iconButton}>
            <Ionicons name="add" size={24} color={theme.COLORS.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {workouts.length > 0 ? (
            <View style={styles.workoutsList}>
              <View style={styles.statsCard}>
                <Text style={styles.statsTitle}>Workout Summary</Text>
                <View style={styles.statsGrid}>
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>{workouts.length}</Text>
                    <Text style={styles.statLabel}>Total Workouts</Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {Math.round(workouts.reduce((sum, w) => sum + w.duration, 0) / workouts.length) || 0}
                    </Text>
                    <Text style={styles.statLabel}>Avg Duration (min)</Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {workouts.reduce((sum, w) => sum + w.caloriesBurned, 0)}
                    </Text>
                    <Text style={styles.statLabel}>Total Calories</Text>
                  </View>
                </View>
              </View>

              {workoutGroups.map(renderDateGroup)}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="fitness-outline" size={48} color={theme.COLORS.textTertiary} />
              </View>
              <Text style={styles.emptyTitle}>No Workouts Yet</Text>
              <Text style={styles.emptyDescription}>
                Start tracking your workouts to see your progress here
              </Text>
              <TouchableOpacity 
                style={styles.startButton}
                onPress={() => router.push('/(patient)/fitness/log-workout' as any)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[theme.COLORS.primary, theme.COLORS.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.startGradient}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.startButtonText}>Log Your First Workout</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}
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
  iconButton: {
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
  workoutsList: {
    gap: 20,
  },
  statsCard: {
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.lg,
    marginBottom: theme.SPACING.md,
    ...theme.SHADOWS.small,
  },
  statsTitle: {
    ...theme.TYPOGRAPHY.h3,
    fontSize: 18,
    color: theme.COLORS.textPrimary,
    marginBottom: theme.SPACING.md,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  divider: {
    width: 1,
    height: '100%',
    backgroundColor: theme.COLORS.separator,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.COLORS.primary,
    marginBottom: 4,
  },
  statLabel: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textSecondary,
    textAlign: 'center',
  },
  dateGroup: {
    marginBottom: theme.SPACING.md,
  },
  dateHeader: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textSecondary,
    marginBottom: theme.SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '600',
  },
  workoutItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.md,
    marginBottom: theme.SPACING.sm,
    ...theme.SHADOWS.small,
  },
  workoutLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  workoutIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.LAYOUT.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  workoutInfo: {
    flex: 1,
  },
  workoutName: {
    ...theme.TYPOGRAPHY.bodyMedium,
    color: theme.COLORS.textPrimary,
    marginBottom: 2,
  },
  workoutDetails: {
    ...theme.TYPOGRAPHY.caption,
    color: theme.COLORS.textSecondary,
  },
  workoutRight: {
    alignItems: 'flex-end',
    gap: 8,
  },
  workoutTime: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textTertiary,
  },
  deleteButton: {
    padding: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: theme.LAYOUT.borderRadius.full,
    backgroundColor: theme.COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    ...theme.TYPOGRAPHY.h3,
    color: theme.COLORS.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyDescription: {
    ...theme.TYPOGRAPHY.body,
    color: theme.COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    maxWidth: 300,
  },
  startButton: {
    borderRadius: theme.LAYOUT.borderRadius.lg,
    ...theme.SHADOWS.medium,
  },
  startGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    gap: 8,
  },
  startButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});