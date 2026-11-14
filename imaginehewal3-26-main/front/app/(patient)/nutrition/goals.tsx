// app/(patient)/nutrition/goals.tsx
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
import Slider from '@react-native-community/slider';
import { useNutrition } from '../../../contexts/NutritionContext';
import { useToast } from '../../../contexts/ToastContext';
import { theme } from '../../../constants/theme';

export default function NutritionGoalsScreen() {
  const router = useRouter();
  const { nutritionGoals, setNutritionGoals } = useNutrition();
  const { showToast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    dailyCalories: nutritionGoals.dailyCalories.toString(),
    dailyProtein: nutritionGoals.dailyProtein.toString(),
    dailyCarbs: nutritionGoals.dailyCarbs.toString(),
    dailyFat: nutritionGoals.dailyFat.toString(),
    dailyFiber: nutritionGoals.dailyFiber?.toString() || '25',
    dailySugar: nutritionGoals.dailySugar?.toString() || '50',
    dailySodium: nutritionGoals.dailySodium?.toString() || '2300',
    waterGoal: nutritionGoals.waterGoal.toString(),
  });

  const handleSave = async () => {
    if (
      !formData.dailyCalories ||
      !formData.dailyProtein ||
      !formData.dailyCarbs ||
      !formData.dailyFat ||
      !formData.waterGoal
    ) {
      Alert.alert('Missing Information', 'Please fill in all required fields');
      return;
    }

    setLoading(true);
    try {
      const goals = {
        dailyCalories: parseInt(formData.dailyCalories),
        dailyProtein: parseInt(formData.dailyProtein),
        dailyCarbs: parseInt(formData.dailyCarbs),
        dailyFat: parseInt(formData.dailyFat),
        dailyFiber: formData.dailyFiber ? parseInt(formData.dailyFiber) : undefined,
        dailySugar: formData.dailySugar ? parseInt(formData.dailySugar) : undefined,
        dailySodium: formData.dailySodium ? parseInt(formData.dailySodium) : undefined,
        waterGoal: parseInt(formData.waterGoal),
      };

      await setNutritionGoals(goals);

      showToast({
        message: 'Nutrition goals updated successfully!',
        type: 'success',
        duration: 3000,
      });

      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (error) {
      showToast({
        message: 'Failed to update goals. Please try again.',
        type: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateMacroPercentages = () => {
    const protein = parseInt(formData.dailyProtein) || 0;
    const carbs = parseInt(formData.dailyCarbs) || 0;
    const fat = parseInt(formData.dailyFat) || 0;
    const total = protein + carbs + fat;
    
    if (total === 0) return { protein: 0, carbs: 0, fat: 0 };
    
    return {
      protein: Math.round((protein / total) * 100),
      carbs: Math.round((carbs / total) * 100),
      fat: Math.round((fat / total) * 100),
    };
  };

  const percentages = calculateMacroPercentages();

  const renderInput = (
    label: string,
    value: string,
    placeholder: string,
    key: keyof typeof formData,
    unit: string = '',
    required: boolean = true
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>
        {label} {required && '*'}
      </Text>
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
          <Text style={styles.title}>Nutrition Goals</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Daily Calorie Goal</Text>
              <Text style={styles.sectionDescription}>
                Set your daily calorie target based on your goals (weight loss, maintenance, or gain)
              </Text>
              
              <View style={styles.calorieSlider}>
                <View style={styles.sliderHeader}>
                  <Text style={styles.sliderValue}>{formData.dailyCalories}</Text>
                  <Text style={styles.sliderUnit}>calories</Text>
                </View>
                <Slider
                  minimumValue={1200}
                  maximumValue={4000}
                  step={50}
                  value={parseInt(formData.dailyCalories) || 2000}
                  onValueChange={(value) => setFormData({ ...formData, dailyCalories: Math.round(value).toString() })}
                  minimumTrackTintColor={theme.COLORS.primary}
                  maximumTrackTintColor={theme.COLORS.border}
                  thumbTintColor={theme.COLORS.primary}
                  disabled={loading}
                />
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderLabel}>1200</Text>
                  <Text style={styles.sliderLabel}>2600</Text>
                  <Text style={styles.sliderLabel}>4000</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Macronutrient Goals</Text>
              <Text style={styles.sectionDescription}>
                Set your daily targets for protein, carbohydrates, and fat
              </Text>

              <View style={styles.macroGrid}>
                <View style={{ flex: 1 }}>
                  {renderInput('Protein', formData.dailyProtein, '50', 'dailyProtein', 'g')}
                </View>
                <View style={{ flex: 1 }}>
                  {renderInput('Carbs', formData.dailyCarbs, '250', 'dailyCarbs', 'g')}
                </View>
                <View style={{ flex: 1 }}>
                  {renderInput('Fat', formData.dailyFat, '65', 'dailyFat', 'g')}
                </View>
              </View>

              <View style={styles.macroSummary}>
                <Text style={styles.macroSummaryTitle}>Macronutrient Split</Text>
                <View style={styles.macroBars}>
                  <View style={[styles.macroBar, { 
                    flex: percentages.protein,
                    backgroundColor: theme.COLORS.info
                  }]}>
                    <Text style={styles.macroBarText}>{percentages.protein}% Protein</Text>
                  </View>
                  <View style={[styles.macroBar, { 
                    flex: percentages.carbs,
                    backgroundColor: theme.COLORS.success
                  }]}>
                    <Text style={styles.macroBarText}>{percentages.carbs}% Carbs</Text>
                  </View>
                  <View style={[styles.macroBar, { 
                    flex: percentages.fat,
                    backgroundColor: theme.COLORS.warning
                  }]}>
                    <Text style={styles.macroBarText}>{percentages.fat}% Fat</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Water Goal</Text>
              <Text style={styles.sectionDescription}>
                Set your daily water intake target (recommended: 2000-3000ml)
              </Text>

              <View style={styles.waterSlider}>
                <View style={styles.sliderHeader}>
                  <Text style={styles.sliderValue}>{formData.waterGoal}</Text>
                  <Text style={styles.sliderUnit}>ml</Text>
                </View>
                <Slider
                  minimumValue={1000}
                  maximumValue={4000}
                  step={100}
                  value={parseInt(formData.waterGoal) || 2000}
                  onValueChange={(value) => setFormData({ ...formData, waterGoal: Math.round(value).toString() })}
                  minimumTrackTintColor="#0ea5e9"
                  maximumTrackTintColor={theme.COLORS.border}
                  thumbTintColor="#0ea5e9"
                  disabled={loading}
                />
                <View style={styles.sliderLabels}>
                  <Text style={styles.sliderLabel}>1000ml</Text>
                  <Text style={styles.sliderLabel}>2500ml</Text>
                  <Text style={styles.sliderLabel}>4000ml</Text>
                </View>
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Additional Goals (Optional)</Text>
              
              <View style={styles.additionalGrid}>
                {renderInput('Fiber', formData.dailyFiber, '25', 'dailyFiber', 'g', false)}
                {renderInput('Sugar', formData.dailySugar, '50', 'dailySugar', 'g', false)}
                {renderInput('Sodium', formData.dailySodium, '2300', 'dailySodium', 'mg', false)}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.saveButton, loading && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[theme.COLORS.primary, theme.COLORS.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.saveGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="save" size={20} color="#fff" />
                    <Text style={styles.saveButtonText}>Save Goals</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.resetButton}
              onPress={() => {
                setFormData({
                  dailyCalories: '2000',
                  dailyProtein: '50',
                  dailyCarbs: '250',
                  dailyFat: '65',
                  dailyFiber: '25',
                  dailySugar: '50',
                  dailySodium: '2300',
                  waterGoal: '2000',
                });
              }}
              disabled={loading}
            >
              <Text style={styles.resetButtonText}>Reset to Defaults</Text>
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
    marginBottom: theme.SPACING.sm,
  },
  sectionDescription: {
    ...theme.TYPOGRAPHY.body,
    color: theme.COLORS.textSecondary,
    marginBottom: theme.SPACING.md,
  },
  calorieSlider: {
    marginBottom: 8,
  },
  waterSlider: {
    marginBottom: 8,
  },
  sliderHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  sliderValue: {
    fontSize: 28,
    fontWeight: '700',
    color: theme.COLORS.textPrimary,
    marginRight: 8,
  },
  sliderUnit: {
    fontSize: 16,
    color: theme.COLORS.textSecondary,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  sliderLabel: {
    fontSize: 12,
    color: theme.COLORS.textTertiary,
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
    minWidth: 30,
  },
  macroGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  additionalGrid: {
    gap: 12,
  },
  macroSummary: {
    marginTop: 8,
  },
  macroSummaryTitle: {
    ...theme.TYPOGRAPHY.label,
    fontWeight: '600',
    color: theme.COLORS.textPrimary,
    marginBottom: 8,
  },
  macroBars: {
    flexDirection: 'row',
    height: 32,
    borderRadius: 8,
    overflow: 'hidden',
  },
  macroBar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  macroBarText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  saveButton: {
    borderRadius: theme.LAYOUT.borderRadius.lg,
    marginBottom: theme.SPACING.md,
    ...theme.SHADOWS.medium,
  },
  saveGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    gap: 8,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resetButton: {
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
    borderWidth: 1,
    borderColor: theme.COLORS.border,
  },
  resetButtonText: {
    color: theme.COLORS.textSecondary,
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