// app/(patient)/fitness/index.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    StatusBar,
    Platform,
    KeyboardAvoidingView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNutrition } from '../../../contexts/NutritionContext';
import type { IoniconsName } from '../../../types/icons';
import { theme } from '../../../constants/theme';

// Define workout type
type WorkoutType = 'cardio' | 'strength' | 'flexibility' | 'balance';

export default function FitnessScreen() {
  const router = useRouter();
  const { todayActivity, updateActivity, addWorkout, workouts } = useNutrition();
  
  const [workoutForm, setWorkoutForm] = useState({
    name: '',
    type: 'cardio' as WorkoutType,
    duration: '',
    caloriesBurned: '',
  });

  const handleLogWorkout = async () => {
    if (!workoutForm.name || !workoutForm.duration || !workoutForm.caloriesBurned) {
      return;
    }

    await addWorkout({
      name: workoutForm.name,
      type: workoutForm.type,
      duration: parseFloat(workoutForm.duration),
      caloriesBurned: parseFloat(workoutForm.caloriesBurned),
      date: new Date().toISOString().split('T')[0],
    });

    await updateActivity({
      caloriesBurned: todayActivity.caloriesBurned + parseFloat(workoutForm.caloriesBurned),
      activeMinutes: todayActivity.activeMinutes + parseFloat(workoutForm.duration),
    });

    setWorkoutForm({
      name: '',
      type: 'cardio',
      duration: '',
      caloriesBurned: '',
    });
  };

  // Fix navigation
  const handleNavigateToWorkouts = () => {
    router.push('/(patient)/fitness/workouts' as any);
  };

  const handleNavigateToLogWorkout = () => {
    router.push('/(patient)/fitness/log-workout' as any);
  };

  const workoutTypes: Array<{ value: WorkoutType; label: string; icon: IoniconsName }> = [
    { value: 'cardio', label: 'Cardio', icon: 'walk-outline' },
    { value: 'strength', label: 'Strength', icon: 'barbell-outline' },
    { value: 'flexibility', label: 'Flexibility', icon: 'body-outline' },
    { value: 'balance', label: 'Balance', icon: 'footsteps-outline' },
  ] as const;

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
          <Text style={styles.title}>Fitness</Text>
          <TouchableOpacity onPress={handleNavigateToWorkouts} style={styles.iconButton}>
            <Ionicons name="list" size={24} color={theme.COLORS.primary} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Today's Activity</Text>
              <View style={styles.activityGrid}>
                <View style={styles.activityItem}>
                  <View style={[styles.activityIcon, { backgroundColor: theme.COLORS.infoLight }]}>
                    <Ionicons name="footsteps" size={24} color={theme.COLORS.info} />
                  </View>
                  <Text style={styles.activityValue}>{todayActivity.steps}</Text>
                  <Text style={styles.activityLabel}>Steps</Text>
                </View>
                <View style={styles.activityItem}>
                  <View style={[styles.activityIcon, { backgroundColor: theme.COLORS.successLight }]}>
                    <Ionicons name="time" size={24} color={theme.COLORS.success} />
                  </View>
                  <Text style={styles.activityValue}>{todayActivity.activeMinutes}</Text>
                  <Text style={styles.activityLabel}>Active Min</Text>
                </View>
                <View style={styles.activityItem}>
                  <View style={[styles.activityIcon, { backgroundColor: theme.COLORS.dangerLight }]}>
                    <Ionicons name="flame" size={24} color={theme.COLORS.danger} />
                  </View>
                  <Text style={styles.activityValue}>{todayActivity.caloriesBurned}</Text>
                  <Text style={styles.activityLabel}>Calories</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Log Workout</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Workout Name</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Morning Run, Weight Training"
                  placeholderTextColor={theme.COLORS.textTertiary}
                  value={workoutForm.name}
                  onChangeText={(text) => setWorkoutForm({ ...workoutForm, name: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Type</Text>
                <View style={styles.typeGrid}>
                  {workoutTypes.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.typeButton,
                        workoutForm.type === type.value && styles.typeButtonActive,
                      ]}
                      onPress={() => setWorkoutForm({ ...workoutForm, type: type.value })}
                    >
                      <Ionicons name={type.icon as any} size={20} color={workoutForm.type === type.value ? 'white' : theme.COLORS.primary} />
                      <Text style={[
                        styles.typeText,
                        workoutForm.type === type.value && styles.typeTextActive,
                      ]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.row}>
                <View style={[styles.inputGroup, { flex: 1, marginRight: 12 }]}>
                  <Text style={styles.label}>Duration (min)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="30"
                    placeholderTextColor={theme.COLORS.textTertiary}
                    value={workoutForm.duration}
                    onChangeText={(text) => setWorkoutForm({ ...workoutForm, duration: text })}
                    keyboardType="numeric"
                  />
                </View>
                <View style={[styles.inputGroup, { flex: 1 }]}>
                  <Text style={styles.label}>Calories Burned</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="250"
                    placeholderTextColor={theme.COLORS.textTertiary}
                    value={workoutForm.caloriesBurned}
                    onChangeText={(text) => setWorkoutForm({ ...workoutForm, caloriesBurned: text })}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <TouchableOpacity 
                style={styles.logButton} 
                onPress={handleLogWorkout}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[theme.COLORS.primary, theme.COLORS.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.logGradient}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.logButtonText}>Log Workout</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>

            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Workouts</Text>
                <TouchableOpacity onPress={handleNavigateToWorkouts}>
                  <Text style={styles.viewAll}>View All</Text>
                </TouchableOpacity>
              </View>
              
              {workouts.slice(-3).reverse().map((workout) => (
                <View key={workout.id} style={styles.workoutItem}>
                  <View style={styles.workoutIcon}>
                    <Ionicons 
                      name={
                        workout.type === 'cardio' ? 'walk-outline' :
                        workout.type === 'strength' ? 'barbell-outline' :
                        workout.type === 'flexibility' ? 'body-outline' : 'footsteps-outline'
                      } 
                      size={20} 
                      color={theme.COLORS.primary} 
                    />
                  </View>
                  <View style={styles.workoutInfo}>
                    <Text style={styles.workoutName}>{workout.name}</Text>
                    <Text style={styles.workoutDetails}>
                      {workout.type} • {workout.duration} min • {workout.caloriesBurned} cal
                    </Text>
                  </View>
                  <Text style={styles.workoutDate}>
                    {new Date(workout.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </Text>
                </View>
              ))}

              {workouts.length === 0 && (
                <View style={styles.emptyState}>
                  <View style={styles.emptyIconContainer}>
                    <Ionicons name="fitness-outline" size={48} color={theme.COLORS.textTertiary} />
                  </View>
                  <Text style={styles.emptyText}>No workouts logged yet</Text>
                  <TouchableOpacity 
                    style={styles.startButton}
                    onPress={handleNavigateToLogWorkout}
                  >
                    <Ionicons name="add" size={20} color="#fff" />
                    <Text style={styles.startButtonText}>Log First Workout</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <View style={{ height: 40 }} />
          </ScrollView>
        </KeyboardAvoidingView>
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
  section: {
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.lg,
    marginBottom: theme.SPACING.lg,
    ...theme.SHADOWS.small,
  },
  sectionTitle: {
    ...theme.TYPOGRAPHY.h3,
    fontSize: 18,
    color: theme.COLORS.textPrimary,
    marginBottom: theme.SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.SPACING.md,
  },
  viewAll: {
    ...theme.TYPOGRAPHY.body,
    fontSize: 14,
    color: theme.COLORS.primary,
    fontWeight: '600',
  },
  activityGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  activityItem: {
    alignItems: 'center',
    flex: 1,
  },
  activityIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.LAYOUT.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  activityValue: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.COLORS.textPrimary,
    marginTop: 4,
  },
  activityLabel: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textSecondary,
    marginTop: 2,
  },
  inputGroup: {
    marginBottom: theme.SPACING.md,
  },
  label: {
    ...theme.TYPOGRAPHY.label,
    color: theme.COLORS.textSecondary,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.COLORS.background,
    borderRadius: theme.LAYOUT.borderRadius.md,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.COLORS.textPrimary,
    borderWidth: 1,
    borderColor: theme.COLORS.border,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.COLORS.border,
    backgroundColor: theme.COLORS.background,
    gap: 6,
  },
  typeButtonActive: {
    backgroundColor: theme.COLORS.primary,
    borderColor: theme.COLORS.primary,
  },
  typeText: {
    fontSize: 13,
    fontWeight: '600',
    color: theme.COLORS.textSecondary,
  },
  typeTextActive: {
    color: 'white',
  },
  row: {
    flexDirection: 'row',
  },
  logButton: {
    marginTop: theme.SPACING.md,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    ...theme.SHADOWS.medium,
  },
  logGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    gap: 8,
  },
  logButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  workoutItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.COLORS.separator,
  },
  workoutIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.LAYOUT.borderRadius.full,
    backgroundColor: theme.COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
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
  workoutDate: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textTertiary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
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
  emptyText: {
    ...theme.TYPOGRAPHY.body,
    color: theme.COLORS.textSecondary,
    marginBottom: 16,
  },
  startButton: {
    backgroundColor: theme.COLORS.primary,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    ...theme.SHADOWS.small,
  },
  startButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});