// components/nutrition/RecentFoods.tsx
import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FoodItem } from '../../contexts/NutritionContext';

interface RecentFoodsProps {
  foods: FoodItem[];
  onAddFood: () => void;
  onViewAll: () => void;
}

const RecentFoods: React.FC<RecentFoodsProps> = ({ foods, onAddFood, onViewAll }) => {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderFoodItem = ({ item }: { item: FoodItem }) => (
    <View style={styles.foodItem}>
      <View style={styles.foodInfo}>
        <Text style={styles.foodName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.foodDetails}>
          {item.calories} cal • {item.servingSize}
        </Text>
      </View>
      <View style={styles.foodRight}>
        <Text style={styles.foodTime}>{formatTime(item.timestamp)}</Text>
        <Text style={styles.mealType}>{item.mealType}</Text>
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Recent Foods</Text>
        <TouchableOpacity onPress={onViewAll}>
          <Text style={styles.viewAll}>View All</Text>
        </TouchableOpacity>
      </View>

      {foods.length > 0 ? (
        <FlatList
          data={foods}
          renderItem={renderFoodItem}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          contentContainerStyle={styles.listContent}
        />
      ) : (
        <View style={styles.emptyState}>
          <Ionicons name="fast-food-outline" size={48} color="#ccc" />
          <Text style={styles.emptyText}>No foods logged today</Text>
          <TouchableOpacity style={styles.addButton} onPress={onAddFood}>
            <Text style={styles.addButtonText}>Add First Food</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.logButton} onPress={onAddFood}>
        <Ionicons name="add" size={20} color="#007bff" />
        <Text style={styles.logButtonText}>Log Food</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  viewAll: {
    fontSize: 14,
    color: '#007bff',
    fontWeight: '500',
  },
  listContent: {
    paddingVertical: 4,
  },
  foodItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  foodInfo: {
    flex: 1,
    marginRight: 12,
  },
  foodName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  foodDetails: {
    fontSize: 14,
    color: '#666',
  },
  foodRight: {
    alignItems: 'flex-end',
  },
  foodTime: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },
  mealType: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
    marginBottom: 20,
  },
  addButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f0f7ff',
    padding: 12,
    borderRadius: 8,
    marginTop: 16,
  },
  logButtonText: {
    color: '#007bff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default RecentFoods;