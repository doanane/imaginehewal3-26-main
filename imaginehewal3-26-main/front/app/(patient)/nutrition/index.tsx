// app/(patient)/nutrition/index.tsx
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, StatusBar } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import RecentFoods from '../../../components/nutrition/RecentFoods';
import WaterTracker from '../../../components/nutrition/WaterTracker';
import { useNutrition } from '../../../contexts/NutritionContext';
import { theme } from '../../../constants/theme';

// MacroProgress Component
const MacroProgress = ({ protein, carbs, fat }: any) => {
  const getMacroColor = (value: number) => {
    if (value >= 100) return theme.COLORS.success;
    if (value >= 75) return theme.COLORS.warning;
    return theme.COLORS.danger;
  };

  const renderMacro = (label: string, value: number, color: string) => (
    <View style={styles.macroItem}>
      <View style={styles.macroHeader}>
        <Text style={styles.macroLabel}>{label}</Text>
        <Text style={styles.macroPercent}>{Math.round(value)}%</Text>
      </View>
      <View style={styles.macroBar}>
        <View
          style={[
            styles.macroBarFill,
            { width: `${Math.min(value, 100)}%`, backgroundColor: color }
          ]}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Macronutrients</Text>
      <View style={styles.macroCard}>
        {renderMacro('Protein', protein, theme.COLORS.info)}
        {renderMacro('Carbs', carbs, theme.COLORS.success)}
        {renderMacro('Fat', fat, theme.COLORS.warning)}
      </View>
    </View>
  );
};

// DailySummary Component
const DailySummary = ({ calories, protein, carbs, fat, water }: any) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Daily Summary</Text>
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <View style={[styles.summaryIcon, { backgroundColor: theme.COLORS.dangerLight }]}>
              <Ionicons name="flame" size={20} color={theme.COLORS.danger} />
            </View>
            <Text style={styles.summaryLabel}>Calories</Text>
            <Text style={styles.summaryValue}>{calories}</Text>
          </View>
          <View style={styles.summaryItem}>
            <View style={[styles.summaryIcon, { backgroundColor: theme.COLORS.infoLight }]}>
              <Ionicons name="nutrition" size={20} color={theme.COLORS.info} />
            </View>
            <Text style={styles.summaryLabel}>Protein</Text>
            <Text style={styles.summaryValue}>{Math.round(protein)}g</Text>
          </View>
        </View>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <View style={[styles.summaryIcon, { backgroundColor: theme.COLORS.successLight }]}>
              <Ionicons name="layers" size={20} color={theme.COLORS.success} />
            </View>
            <Text style={styles.summaryLabel}>Carbs</Text>
            <Text style={styles.summaryValue}>{Math.round(carbs)}g</Text>
          </View>
          <View style={styles.summaryItem}>
            <View style={[styles.summaryIcon, { backgroundColor: '#E0F2FE' }]}>
              <Ionicons name="water" size={20} color="#0ea5e9" />
            </View>
            <Text style={styles.summaryLabel}>Water</Text>
            <Text style={styles.summaryValue}>{water}ml</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

export default function NutritionDashboard() {
  const router = useRouter();
  const { todayNutrition, nutritionGoals } = useNutrition();

  const calorieProgress = (todayNutrition.totalCalories / nutritionGoals.dailyCalories) * 100;
  const proteinProgress = (todayNutrition.totalProtein / nutritionGoals.dailyProtein) * 100;
  const carbProgress = (todayNutrition.totalCarbs / nutritionGoals.dailyCarbs) * 100;
  const fatProgress = (todayNutrition.totalFat / nutritionGoals.dailyFat) * 100;

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
          <TouchableOpacity 
            onPress={() => router.push('/(patient)/home')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerButton}
          >
            <Ionicons name="arrow-back" size={24} color={theme.COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Nutrition</Text>
          <TouchableOpacity 
            onPress={() => router.push('/(patient)/nutrition/goals' as any)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            style={styles.headerButton}
          >
            <Ionicons name="settings-outline" size={24} color={theme.COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Calories</Text>
            <LinearGradient
              colors={[theme.COLORS.card, '#F8FAFC']}
              style={styles.calorieCard}
            >
              <View style={styles.calorieLeft}>
                <Text style={styles.calorieValue}>{todayNutrition.totalCalories}</Text>
                <Text style={styles.calorieLabel}>calories eaten</Text>
              </View>
              <View style={styles.calorieRight}>
                <Text style={styles.calorieGoal}>{nutritionGoals.dailyCalories} goal</Text>
                <View style={styles.progressBar}>
                  <LinearGradient
                    colors={[theme.COLORS.primary, theme.COLORS.primaryLight]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[
                      styles.progressFill,
                      { width: `${Math.min(calorieProgress, 100)}%` }
                    ]}
                  />
                </View>
              </View>
            </LinearGradient>
          </View>

          <MacroProgress 
            protein={proteinProgress}
            carbs={carbProgress}
            fat={fatProgress}
          />

          <WaterTracker 
            current={todayNutrition.waterIntake}
            goal={todayNutrition.waterGoal}
            onAdd={() => router.push('/(patient)/nutrition/log-water' as any)}
          />

          <RecentFoods 
            foods={todayNutrition.foods.slice(-5).reverse()}
            onAddFood={() => router.push('/(patient)/nutrition/log-food' as any)}
            onViewAll={() => router.push('/(patient)/nutrition/food-log' as any)}
          />

          <DailySummary 
            calories={todayNutrition.totalCalories}
            protein={todayNutrition.totalProtein}
            carbs={todayNutrition.totalCarbs}
            fat={todayNutrition.totalFat}
            water={todayNutrition.waterIntake}
          />

          <View style={styles.quickActions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/(patient)/nutrition/log-food' as any)}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[theme.COLORS.primary, theme.COLORS.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.actionGradient}
              >
                <Ionicons name="restaurant" size={24} color="#fff" />
                <Text style={styles.actionText}>Log Food</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.secondaryAction}
              onPress={() => router.push('/(patient)/nutrition/scan-food' as any)}
              activeOpacity={0.7}
            >
              <Ionicons name="camera" size={24} color={theme.COLORS.primary} />
              <Text style={styles.secondaryActionText}>Scan Food</Text>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.SPACING.lg,
    paddingVertical: theme.SPACING.md,
  },
  headerButton: {
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
  calorieCard: {
    flexDirection: 'row',
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.lg,
    ...theme.SHADOWS.small,
  },
  calorieLeft: {
    flex: 1,
  },
  calorieValue: {
    fontSize: 32,
    fontWeight: '700',
    color: theme.COLORS.textPrimary,
  },
  calorieLabel: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textSecondary,
    marginTop: 4,
  },
  calorieRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flex: 1,
  },
  calorieGoal: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textSecondary,
    marginBottom: 8,
  },
  progressBar: {
    width: '100%',
    height: 8,
    backgroundColor: theme.COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  macroCard: {
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.lg,
    ...theme.SHADOWS.small,
  },
  macroItem: {
    marginBottom: 16,
  },
  macroHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  macroLabel: {
    ...theme.TYPOGRAPHY.body,
    fontWeight: '600',
    color: theme.COLORS.textPrimary,
  },
  macroPercent: {
    ...theme.TYPOGRAPHY.body,
    fontWeight: '700',
    color: theme.COLORS.textPrimary,
  },
  macroBar: {
    height: 8,
    backgroundColor: theme.COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  macroBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  summaryCard: {
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.lg,
    ...theme.SHADOWS.small,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryIcon: {
    width: 40,
    height: 40,
    borderRadius: theme.LAYOUT.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  summaryLabel: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textSecondary,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.COLORS.textPrimary,
    marginTop: 4,
  },
  quickActions: {
    marginTop: theme.SPACING.md,
    marginBottom: theme.SPACING.xl,
    gap: 12,
  },
  actionButton: {
    borderRadius: theme.LAYOUT.borderRadius.lg,
    ...theme.SHADOWS.medium,
  },
  actionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    gap: 8,
  },
  actionText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    backgroundColor: theme.COLORS.card,
    borderWidth: 1,
    borderColor: theme.COLORS.border,
    gap: 8,
  },
  secondaryActionText: {
    color: theme.COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});