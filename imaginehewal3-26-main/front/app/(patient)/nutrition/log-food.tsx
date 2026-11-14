// app/(patient)/nutrition/log-food.tsx
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
  KeyboardAvoidingView,
  Platform,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNutrition } from '../../../contexts/NutritionContext';
import { useToast } from '../../../contexts/ToastContext';
import { theme } from '../../../constants/theme';

// Mock food database
const COMMON_FOODS = [
  { id: '1', name: 'Banana', calories: 105, protein: 1.3, carbs: 27, fat: 0.3, serving: '1 medium' },
  { id: '2', name: 'Chicken Breast', calories: 165, protein: 31, carbs: 0, fat: 3.6, serving: '100g' },
  { id: '3', name: 'Oatmeal', calories: 150, protein: 5, carbs: 27, fat: 3, serving: '1 cup cooked' },
  { id: '4', name: 'Greek Yogurt', calories: 100, protein: 10, carbs: 6, fat: 0, serving: '1 container' },
  { id: '5', name: 'Almonds', calories: 164, protein: 6, carbs: 6, fat: 14, serving: '1 oz' },
  { id: '6', name: 'Salmon', calories: 208, protein: 20, carbs: 0, fat: 13, serving: '100g' },
  { id: '7', name: 'Rice (White)', calories: 130, protein: 2.7, carbs: 28, fat: 0.3, serving: '100g cooked' },
  { id: '8', name: 'Broccoli', calories: 55, protein: 3.7, carbs: 11, fat: 0.6, serving: '1 cup chopped' },
  { id: '9', name: 'Egg', calories: 78, protein: 6, carbs: 0.6, fat: 5, serving: '1 large' },
  { id: '10', name: 'Avocado', calories: 240, protein: 3, carbs: 12, fat: 22, serving: '1 medium' },
];

export default function LogFoodScreen() {
  const router = useRouter();
  const { addFood, todayNutrition, updateNutrition } = useNutrition();
  const { showToast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedFood, setSelectedFood] = useState<any | null>(null);
  const [servings, setServings] = useState('1');

  const filteredFoods = COMMON_FOODS.filter(food => 
    food.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleLogFood = async () => {
    if (!selectedFood) return;
    
    const numServings = parseFloat(servings);
    if (isNaN(numServings) || numServings <= 0) {
      Alert.alert('Invalid Servings', 'Please enter a valid number of servings');
      return;
    }

    setLoading(true);
    try {
      const foodItem = {
        name: selectedFood.name,
        calories: Math.round(selectedFood.calories * numServings),
        protein: Math.round(selectedFood.protein * numServings),
        carbs: Math.round(selectedFood.carbs * numServings),
        fat: Math.round(selectedFood.fat * numServings),
        servingSize: `${numServings} x ${selectedFood.serving}`,
        timestamp: Date.now(),
      };

      await addFood(foodItem);
      
      // Update daily totals
      await updateNutrition({
        totalCalories: todayNutrition.totalCalories + foodItem.calories,
        totalProtein: todayNutrition.totalProtein + foodItem.protein,
        totalCarbs: todayNutrition.totalCarbs + foodItem.carbs,
        totalFat: todayNutrition.totalFat + foodItem.fat,
      });

      showToast(`Logged ${foodItem.name}!`);

      setSelectedFood(null);
      setServings('1');
      setSearchQuery('');
      
      // Optional: Go back after logging
      // router.back();
    } catch (error) {
      showToast('Failed to log food. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderFoodItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.foodItem}
      onPress={() => setSelectedFood(item)}
      activeOpacity={0.7}
    >
      <View style={styles.foodIcon}>
        <Ionicons name="restaurant-outline" size={24} color={theme.COLORS.primary} />
      </View>
      <View style={styles.foodInfo}>
        <Text style={styles.foodName}>{item.name}</Text>
        <Text style={styles.foodDetails}>
          {item.calories} cal • {item.protein}g P • {item.carbs}g C • {item.fat}g F
        </Text>
        <Text style={styles.foodServing}>{item.serving}</Text>
      </View>
      <Ionicons name="add-circle-outline" size={24} color={theme.COLORS.primary} />
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
          <TouchableOpacity onPress={() => router.back()} disabled={loading} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Log Food</Text>
          <TouchableOpacity 
            onPress={() => router.push('/(patient)/nutrition/scan-food' as any)}
            style={styles.iconButton}
          >
            <Ionicons name="camera-outline" size={24} color={theme.COLORS.primary} />
          </TouchableOpacity>
        </View>

        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={20} color={theme.COLORS.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for food..."
              placeholderTextColor={theme.COLORS.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color={theme.COLORS.textTertiary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <View style={styles.content}>
          <FlatList
            data={filteredFoods}
            renderItem={renderFoodItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="search-outline" size={48} color={theme.COLORS.textTertiary} />
                <Text style={styles.emptyText}>No foods found</Text>
                <Text style={styles.emptySubtext}>Try searching for something else</Text>
              </View>
            }
          />
        </View>

        {/* Food Selection Modal/Sheet */}
        {selectedFood && (
          <View style={styles.selectionSheet}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={styles.sheetTitle}>{selectedFood.name}</Text>
                <Text style={styles.sheetSubtitle}>
                  {Math.round(selectedFood.calories * parseFloat(servings || '0'))} cal • {selectedFood.serving}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedFood(null)}>
                <Ionicons name="close" size={24} color={theme.COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.servingInputContainer}>
              <Text style={styles.servingLabel}>Number of Servings:</Text>
              <View style={styles.servingInputWrapper}>
                <TouchableOpacity 
                  onPress={() => setServings(Math.max(0.5, parseFloat(servings) - 0.5).toString())}
                  style={styles.servingBtn}
                >
                  <Ionicons name="remove" size={20} color={theme.COLORS.primary} />
                </TouchableOpacity>
                <TextInput
                  style={styles.servingInput}
                  value={servings}
                  onChangeText={setServings}
                  keyboardType="numeric"
                  textAlign="center"
                />
                <TouchableOpacity 
                  onPress={() => setServings((parseFloat(servings) + 0.5).toString())}
                  style={styles.servingBtn}
                >
                  <Ionicons name="add" size={20} color={theme.COLORS.primary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.macroPreview}>
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>{Math.round(selectedFood.protein * parseFloat(servings || '0'))}g</Text>
                <Text style={styles.macroLabel}>Protein</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>{Math.round(selectedFood.carbs * parseFloat(servings || '0'))}g</Text>
                <Text style={styles.macroLabel}>Carbs</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>{Math.round(selectedFood.fat * parseFloat(servings || '0'))}g</Text>
                <Text style={styles.macroLabel}>Fat</Text>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.logButton, loading && styles.logButtonDisabled]}
              onPress={handleLogFood}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[theme.COLORS.primary, theme.COLORS.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.logGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="add-circle" size={20} color="#fff" />
                    <Text style={styles.logButtonText}>Log Food</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
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
  searchContainer: {
    paddingHorizontal: theme.SPACING.lg,
    paddingBottom: theme.SPACING.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...theme.SHADOWS.small,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: theme.COLORS.textPrimary,
  },
  content: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: theme.SPACING.lg,
    paddingBottom: 100, // Space for bottom sheet
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
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 60,
  },
  emptyText: {
    ...theme.TYPOGRAPHY.h3,
    color: theme.COLORS.textSecondary,
    marginTop: 16,
  },
  emptySubtext: {
    ...theme.TYPOGRAPHY.body,
    color: theme.COLORS.textTertiary,
    marginTop: 8,
  },
  selectionSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: theme.COLORS.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: theme.SPACING.lg,
    ...theme.SHADOWS.large,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.SPACING.lg,
  },
  sheetTitle: {
    ...theme.TYPOGRAPHY.h3,
    color: theme.COLORS.textPrimary,
  },
  sheetSubtitle: {
    ...theme.TYPOGRAPHY.body,
    color: theme.COLORS.textSecondary,
    marginTop: 4,
  },
  servingInputContainer: {
    marginBottom: theme.SPACING.lg,
  },
  servingLabel: {
    ...theme.TYPOGRAPHY.label,
    color: theme.COLORS.textSecondary,
    marginBottom: 8,
  },
  servingInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  servingBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.COLORS.background,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.COLORS.border,
  },
  servingInput: {
    width: 80,
    height: 40,
    backgroundColor: theme.COLORS.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: theme.COLORS.border,
    fontSize: 18,
    fontWeight: '600',
    color: theme.COLORS.textPrimary,
  },
  macroPreview: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: theme.SPACING.lg,
    paddingVertical: 16,
    backgroundColor: theme.COLORS.background,
    borderRadius: theme.LAYOUT.borderRadius.md,
  },
  macroItem: {
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.COLORS.textPrimary,
  },
  macroLabel: {
    fontSize: 12,
    color: theme.COLORS.textSecondary,
    marginTop: 4,
  },
  logButton: {
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
  logButtonDisabled: {
    opacity: 0.7,
  },
  logButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
