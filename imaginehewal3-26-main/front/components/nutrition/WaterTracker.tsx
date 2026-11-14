// components/nutrition/WaterTracker.tsx
import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface WaterTrackerProps {
  current: number;
  goal: number;
  onAdd: () => void;
}

const WaterTracker: React.FC<WaterTrackerProps> = ({ current, goal, onAdd }) => {
  const percentage = goal > 0 ? Math.min((current / goal) * 100, 100) : 0;
  const glasses = Math.floor(current / 250);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Water Intake</Text>
        <View style={styles.waterAmount}>
          <Text style={styles.currentAmount}>{current}</Text>
          <Text style={styles.unit}>ml / {goal}ml</Text>
        </View>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill,
              { width: `${Math.min(percentage, 100)}%` }
            ]}
          />
        </View>
        <Text style={styles.percentage}>{Math.round(percentage)}%</Text>
      </View>

      <View style={styles.glassesContainer}>
        <Text style={styles.glassesLabel}>Glasses ({glasses}):</Text>
        <View style={styles.glassesRow}>
          {[1, 2, 3, 4, 5, 6, 7, 8].map((glass) => (
            <View 
              key={glass}
              style={[
                styles.glass,
                glass <= glasses && styles.glassFilled
              ]}
            />
          ))}
        </View>
      </View>

      <TouchableOpacity style={styles.addButton} onPress={onAdd}>
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.addButtonText}>Add Water</Text>
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
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  waterAmount: {
    alignItems: 'flex-end',
  },
  currentAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0ea5e9',
  },
  unit: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  progressBar: {
    flex: 1,
    height: 12,
    backgroundColor: '#e0e0e0',
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#0ea5e9',
    borderRadius: 6,
  },
  percentage: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    minWidth: 40,
  },
  glassesContainer: {
    marginBottom: 20,
  },
  glassesLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  glassesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  glass: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#e0e0e0',
    borderWidth: 2,
    borderColor: '#f0f0f0',
  },
  glassFilled: {
    backgroundColor: '#0ea5e9',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0ea5e9',
    padding: 12,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
});

export default WaterTracker;