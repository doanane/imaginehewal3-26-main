// app/(patient)/nutrition/food-details.tsx
import React from 'react';
import {
  StyleSheet,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useNutrition } from '../../../contexts/NutritionContext';
import { useToast } from '../../../contexts/ToastContext';
import { theme } from '../../../constants/theme';
import { Image, Ionicons, LinearGradient, SafeAreaView, ScrollView, StatusBar, Text, TouchableOpacity, View } from '../../../components/themed';

export default function FoodDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  // Mock data if params are missing (for preview)
  const imageParam = Array.isArray(params.image) ? params.image[0] : params.image;
  const descriptionParam = Array.isArray(params.description) ? params.description[0] : params.description;
  const vitaminsParam = Array.isArray(params.vitamins) ? params.vitamins[0] : params.vitamins;

  const food = {
    name: params.name || 'Grilled Chicken Salad',
    calories: params.calories || 350,
    protein: params.protein || 35,
    carbs: params.carbs || 12,
    fat: params.fat || 18,
    image: imageParam || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
    description: descriptionParam || 'A healthy mix of grilled chicken breast, fresh greens, cherry tomatoes, and balsamic vinaigrette.',
    vitamins: vitaminsParam || ['Vitamin A', 'Vitamin C', 'Iron'],
  };

  const renderMacro = (label: string, value: any, color: string, icon: any) => (
    <View style={styles.macroItem}>
      <View style={[styles.macroIcon, { backgroundColor: `${color}20` }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.macroValue}>{value}g</Text>
      <Text style={styles.macroLabel}>{label}</Text>
    </View>
  );

  const { addFood } = useNutrition();
  const { showToast } = useToast();
  const [logging, setLogging] = React.useState(false);

  const handleLogFood = async () => {
    setLogging(true);
    try {
      const foodItem = {
        name: Array.isArray(food.name) ? food.name[0] : food.name,
        calories: Number(food.calories),
        protein: Number(food.protein),
        carbs: Number(food.carbs),
        fat: Number(food.fat),
        servingSize: '1 serving', // Default or from params if available
        mealType: (params.mealType as any) || 'snack',
        date: new Date().toISOString().split('T')[0],
        image: Array.isArray(food.image) ? food.image[0] : (food.image as string),
      };

      await addFood(foodItem);
      
      showToast(`Logged ${foodItem.name}!`);
      
      // Navigate back to history or dashboard
      router.dismissAll();
      router.push('/(patient)/nutrition/food-log');
    } catch (error) {
      showToast('Failed to log food');
    } finally {
      setLogging(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <ScrollView style={styles.content} bounces={false}>
        <View style={styles.imageContainer}>
          <Image source={{ uri: food.image as string }} style={styles.image} />
          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.7)']}
            style={styles.imageOverlay}
          />
          <SafeAreaView style={styles.header} edges={['top']}>
            <TouchableOpacity 
              onPress={() => router.back()} 
              style={styles.backButton}
            >
              <Ionicons name="arrow-back" size={24} color="#fff" />
            </TouchableOpacity>
          </SafeAreaView>
          <View style={styles.titleContainer}>
            <Text style={styles.foodName}>{food.name}</Text>
            <Text style={styles.calories}>{food.calories} Calories</Text>
          </View>
        </View>

        <View style={styles.detailsContainer}>
          <Text style={styles.sectionTitle}>Macronutrients</Text>
          <View style={styles.macroGrid}>
            {renderMacro('Protein', food.protein, theme.COLORS.info, 'nutrition')}
            {renderMacro('Carbs', food.carbs, theme.COLORS.success, 'leaf')}
            {renderMacro('Fat', food.fat, theme.COLORS.warning, 'water')}
          </View>

          <Text style={styles.sectionTitle}>Description</Text>
          <Text style={styles.description}>{food.description}</Text>

          <Text style={styles.sectionTitle}>Vitamins & Minerals</Text>
          <View style={styles.tagsContainer}>
            {(typeof food.vitamins === 'string' ? JSON.parse(food.vitamins) : food.vitamins).map((vitamin: string, index: number) => (
              <View key={index} style={styles.tag}>
                <Text style={styles.tagText}>{vitamin}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>

      <SafeAreaView style={styles.footer} edges={['bottom']}>
        <TouchableOpacity 
          style={[styles.logButton, logging && { opacity: 0.7 }]}
          onPress={handleLogFood}
          disabled={logging}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={[theme.COLORS.primary, theme.COLORS.primaryDark]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.logGradient}
          >
            <Ionicons name="add-circle" size={24} color="#fff" />
            <Text style={styles.logButtonText}>{logging ? 'Logging...' : 'Add to Log'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.COLORS.background,
  },
  content: {
    flex: 1,
  },
  imageContainer: {
    height: 300,
    width: '100%',
    position: 'relative',
  },
  image: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFill,
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  titleContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
  },
  foodName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 4,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  calories: {
    fontSize: 18,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
  },
  detailsContainer: {
    flex: 1,
    backgroundColor: theme.COLORS.background,
    marginTop: -20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
  },
  sectionTitle: {
    ...theme.TYPOGRAPHY.h3,
    fontSize: 18,
    color: theme.COLORS.textPrimary,
    marginBottom: 16,
    marginTop: 24,
  },
  macroGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: 20,
    ...theme.SHADOWS.small,
  },
  macroItem: {
    alignItems: 'center',
  },
  macroIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  macroValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.COLORS.textPrimary,
  },
  macroLabel: {
    fontSize: 12,
    color: theme.COLORS.textSecondary,
    marginTop: 2,
  },
  description: {
    ...theme.TYPOGRAPHY.body,
    color: theme.COLORS.textSecondary,
    lineHeight: 24,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: theme.COLORS.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: theme.COLORS.border,
  },
  tagText: {
    fontSize: 12,
    color: theme.COLORS.textSecondary,
    fontWeight: '500',
  },
  footer: {
    padding: 20,
    backgroundColor: theme.COLORS.background,
    borderTopWidth: 1,
    borderTopColor: theme.COLORS.border,
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
  logButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
