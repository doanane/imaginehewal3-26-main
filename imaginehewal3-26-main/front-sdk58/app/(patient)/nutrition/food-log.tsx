// app/(patient)/nutrition/food-log.tsx
import React, { useState } from 'react';
import {
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useNutrition } from '../../../contexts/NutritionContext';
import { useToast } from '../../../contexts/ToastContext';
import { theme } from '../../../constants/theme';
import { FlatList, Ionicons, LinearGradient, SafeAreaView, ScrollView, StatusBar, Text, TouchableOpacity, View } from '../../../components/themed';

export default function FoodLogHistoryScreen() {
  const router = useRouter();
  const { todayNutrition, removeFood } = useNutrition();
  const { showToast } = useToast();

  const handleDeleteFood = (foodId: string, foodName: string) => {
    Alert.alert(
      'Delete Food',
      `Are you sure you want to delete "${foodName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await removeFood(foodId);
              showToast('Food deleted successfully');
            } catch (error) {
              showToast('Failed to delete food');
            }
          },
        },
      ]
    );
  };

  const renderFoodItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.foodItem}
      onPress={() => router.push({
        pathname: '/(patient)/nutrition/food-details',
        params: {
          name: item.name,
          calories: item.calories,
          protein: item.protein,
          carbs: item.carbs,
          fat: item.fat,
          image: item.image,
        }
      } as any)}
      activeOpacity={0.7}
    >
      <View style={styles.foodIcon}>
        <Ionicons name="restaurant" size={24} color={theme.COLORS.primary} />
      </View>
      <View style={styles.foodInfo}>
        <Text style={styles.foodName}>{item.name}</Text>
        <Text style={styles.foodDetails}>
          {item.calories} cal • {item.protein}g P • {item.carbs}g C • {item.fat}g F
        </Text>
        <Text style={styles.foodServing}>{item.servingSize}</Text>
      </View>
      <TouchableOpacity 
        style={styles.deleteButton}
        onPress={() => handleDeleteFood(item.id, item.name)}
      >
        <Ionicons name="trash-outline" size={20} color={theme.COLORS.textTertiary} />
      </TouchableOpacity>
    </TouchableOpacity>
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
          <Text style={styles.title}>Food History</Text>
          <TouchableOpacity 
            onPress={() => router.push('/(patient)/nutrition/log-food' as any)} 
            style={styles.iconButton}
          >
            <Ionicons name="add" size={24} color={theme.COLORS.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Today's Summary</Text>
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{todayNutrition.totalCalories}</Text>
              <Text style={styles.summaryLabel}>Calories</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: theme.COLORS.info }]}>
                {todayNutrition.totalProtein}g
              </Text>
              <Text style={styles.summaryLabel}>Protein</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: theme.COLORS.success }]}>
                {todayNutrition.totalCarbs}g
              </Text>
              <Text style={styles.summaryLabel}>Carbs</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.summaryItem}>
              <Text style={[styles.summaryValue, { color: theme.COLORS.warning }]}>
                {todayNutrition.totalFat}g
              </Text>
              <Text style={styles.summaryLabel}>Fat</Text>
            </View>
          </View>
        </View>

        <FlatList
          data={todayNutrition.foods.slice().reverse()}
          renderItem={renderFoodItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <View style={styles.emptyIconContainer}>
                <Ionicons name="restaurant-outline" size={48} color={theme.COLORS.textTertiary} />
              </View>
              <Text style={styles.emptyText}>No food logged today</Text>
              <TouchableOpacity 
                style={styles.startButton}
                onPress={() => router.push('/(patient)/nutrition/log-food' as any)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={[theme.COLORS.primary, theme.COLORS.primaryDark]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.startGradient}
                >
                  <Ionicons name="add" size={20} color="#fff" />
                  <Text style={styles.startButtonText}>Log First Meal</Text>
                </LinearGradient>
              </TouchableOpacity>
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
  summaryCard: {
    marginHorizontal: theme.SPACING.lg,
    marginBottom: theme.SPACING.lg,
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.lg,
    ...theme.SHADOWS.small,
  },
  summaryTitle: {
    ...theme.TYPOGRAPHY.h3,
    fontSize: 16,
    color: theme.COLORS.textPrimary,
    marginBottom: theme.SPACING.md,
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  divider: {
    width: 1,
    height: 30,
    backgroundColor: theme.COLORS.border,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.COLORS.textPrimary,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: theme.COLORS.textSecondary,
  },
  listContent: {
    paddingHorizontal: theme.SPACING.lg,
    paddingBottom: 40,
  },
  foodItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.md,
    marginBottom: theme.SPACING.sm,
    ...theme.SHADOWS.small,
  },
  foodIcon: {
    width: 48,
    height: 48,
    borderRadius: theme.LAYOUT.borderRadius.full,
    backgroundColor: theme.COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  foodInfo: {
    flex: 1,
  },
  foodName: {
    ...theme.TYPOGRAPHY.body,
    fontWeight: '600',
    color: theme.COLORS.textPrimary,
  },
  foodDetails: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textSecondary,
    marginTop: 2,
  },
  foodServing: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textTertiary,
    marginTop: 2,
  },
  deleteButton: {
    padding: 8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: theme.LAYOUT.borderRadius.full,
    backgroundColor: theme.COLORS.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    ...theme.SHADOWS.small,
  },
  emptyText: {
    ...theme.TYPOGRAPHY.h3,
    color: theme.COLORS.textPrimary,
    marginBottom: 16,
  },
  startButton: {
    borderRadius: theme.LAYOUT.borderRadius.lg,
    ...theme.SHADOWS.medium,
  },
  startGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    gap: 8,
  },
  startButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
