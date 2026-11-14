// app/(patient)/fitness/log-workout.tsx
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNutrition } from '../../../contexts/NutritionContext';
import { useToast } from '../../../contexts/ToastContext';
import { theme } from '../../../constants/theme';

const WORKOUT_TYPES = [
  { value: 'cardio', label: 'Cardio', icon: 'walk-outline' },
  { value: 'strength', label: 'Strength', icon: 'barbell-outline' },
  { value: 'flexibility', label: 'Flexibility', icon: 'body-outline' },
  { value: 'balance', label: 'Balance', icon: 'footsteps-outline' },
];

const WORKOUT_EXERCISES = {
  cardio: ['Running', 'Cycling', 'Swimming', 'Walking', 'HIIT', 'Elliptical'],
  strength: ['Weight Training', 'Bodyweight', 'Resistance Bands', 'Kettlebell', 'CrossFit'],
  flexibility: ['Yoga', 'Stretching', 'Pilates', 'Tai Chi', 'Mobility Drills'],
  balance: ['Balance Board', 'Bosu Ball', 'Single-leg Exercises', 'Core Stability'],
};

export default function LogWorkoutScreen() {
  const router = useRouter();
  const { addWorkout, todayActivity, updateActivity } = useNutrition();
  const { showToast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'cardio' as 'cardio' | 'strength' | 'flexibility' | 'balance',
    duration: '',
    caloriesBurned: '',
    notes: '',
    exercises: [] as string[],
  });

  const handleSubmit = async () => {
    if (!formData.name.trim() || !formData.duration || !formData.caloriesBurned) {
      Alert.alert('Missing Information', 'Please enter workout name, duration, and calories burned');
      return;
    }

    setLoading(true);
    try {
      await addWorkout({
        name: formData.name.trim(),
        type: formData.type,
        duration: parseFloat(formData.duration),
        caloriesBurned: parseFloat(formData.caloriesBurned),
        date: new Date().toISOString().split('T')[0],
        exercises: formData.exercises.length > 0 ? formData.exercises.map(ex => ({ name: ex })) : undefined,
      });

      await updateActivity({
        caloriesBurned: todayActivity.caloriesBurned + parseFloat(formData.caloriesBurned),
        activeMinutes: todayActivity.activeMinutes + parseFloat(formData.duration),
      });

      showToast({
        message: 'Workout logged successfully!',
        type: 'success',
        duration: 3000,
      });

      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (error) {
      showToast({
        message: 'Failed to log workout. Please try again.',
        type: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleExercise = (exercise: string) => {
    setFormData(prev => ({
      ...prev,
      exercises: prev.exercises.includes(exercise)
        ? prev.exercises.filter(e => e !== exercise)
        : [...prev.exercises, exercise],
    }));
  };

  const renderInput = (
    label: string,
    value: string,
    placeholder: string,
    key: keyof typeof formData,
    unit: string = ''
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={theme.COLORS.textTertiary}
          value={value}
          onChangeText={(text) => setFormData({ ...formData, [key]: text })}
          keyboardType="numeric"
          editable={!loading}
        />
        {unit && <Text style={styles.inputUnit}>{unit}</Text>}
      </View>
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
          <TouchableOpacity onPress={() => router.back()} disabled={loading} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Log Workout</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Workout Details</Text>
              
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Workout Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., Morning Run, Weight Training"
                  placeholderTextColor={theme.COLORS.textTertiary}
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  editable={!loading}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Workout Type</Text>
                <View style={styles.typeGrid}>
                  {WORKOUT_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type.value}
                      style={[
                        styles.typeButton,
                        formData.type === type.value && styles.typeButtonActive,
                      ]}
                      onPress={() => setFormData({ ...formData, type: type.value as any })}
                      disabled={loading}
                    >
                      <Ionicons 
                        name={type.icon as any} 
                        size={20} 
                        color={formData.type === type.value ? '#fff' : theme.COLORS.primary} 
                      />
                      <Text style={[
                        styles.typeText,
                        formData.type === type.value && styles.typeTextActive,
                      ]}>
                        {type.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  {renderInput('Duration', formData.duration, '30', 'duration', 'min')}
                </View>
                <View style={{ flex: 1 }}>
                  {renderInput('Calories', formData.caloriesBurned, '250', 'caloriesBurned', 'cal')}
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Exercises (Optional)</Text>
              <Text style={styles.sectionDescription}>
                Select exercises you performed during this workout
              </Text>
              
              <View style={styles.exercisesGrid}>
                {WORKOUT_EXERCISES[formData.type].map((exercise) => (
                  <TouchableOpacity
                    key={exercise}
                    style={[
                      styles.exerciseButton,
                      formData.exercises.includes(exercise) && styles.exerciseButtonActive,
                    ]}
                    onPress={() => toggleExercise(exercise)}
                    disabled={loading}
                  >
                    <Text style={[
                      styles.exerciseText,
                      formData.exercises.includes(exercise) && styles.exerciseTextActive,
                    ]}>
                      {exercise}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Notes (Optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Add any notes about your workout..."
                placeholderTextColor={theme.COLORS.textTertiary}
                value={formData.notes}
                onChangeText={(text) => setFormData({ ...formData, notes: text })}
                multiline
                numberOfLines={4}
                editable={!loading}
              />
            </View>

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[theme.COLORS.primary, theme.COLORS.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.submitButtonText}>Log Workout</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => router.back()}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
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
  sectionDescription: {
    ...theme.TYPOGRAPHY.body,
    color: theme.COLORS.textSecondary,
    marginBottom: theme.SPACING.md,
  },
  inputGroup: {
    marginBottom: theme.SPACING.md,
  },
  label: {
    ...theme.TYPOGRAPHY.label,
    color: theme.COLORS.textSecondary,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.COLORS.background,
    borderRadius: theme.LAYOUT.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.COLORS.border,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.COLORS.textPrimary,
  },
  inputUnit: {
    fontSize: 16,
    color: theme.COLORS.textSecondary,
    marginLeft: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  typeButton: {
    flex: 1,
    minWidth: '45%',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: theme.LAYOUT.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.COLORS.border,
    backgroundColor: theme.COLORS.background,
  },
  typeButtonActive: {
    backgroundColor: theme.COLORS.primary,
    borderColor: theme.COLORS.primary,
  },
  typeText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: theme.COLORS.primary,
  },
  typeTextActive: {
    color: 'white',
  },
  exercisesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  exerciseButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.COLORS.border,
    backgroundColor: theme.COLORS.background,
  },
  exerciseButtonActive: {
    backgroundColor: theme.COLORS.primary,
    borderColor: theme.COLORS.primary,
  },
  exerciseText: {
    fontSize: 13,
    color: theme.COLORS.textSecondary,
  },
  exerciseTextActive: {
    color: 'white',
    fontWeight: '600',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    paddingTop: 12,
    backgroundColor: theme.COLORS.background,
    borderRadius: theme.LAYOUT.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.COLORS.border,
    paddingHorizontal: 16,
  },
  submitButton: {
    borderRadius: theme.LAYOUT.borderRadius.lg,
    marginBottom: theme.SPACING.md,
    ...theme.SHADOWS.medium,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: theme.COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
});