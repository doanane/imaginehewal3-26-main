// components/nutrition/MacroProgress.tsx
import React from 'react';
import { StyleSheet } from 'react-native';
import { Text, View } from '../themed';

interface MacroProgressProps {
  protein: number;
  carbs: number;
  fat: number;
  proteinGoal?: number;
  carbsGoal?: number;
  fatGoal?: number;
}

const MacroProgress: React.FC<MacroProgressProps> = ({ 
  protein, 
  carbs, 
  fat,
  proteinGoal = 100,
  carbsGoal = 100,
  fatGoal = 100
}) => {
  const proteinPercentage = Math.min((protein / proteinGoal) * 100, 100);
  const carbsPercentage = Math.min((carbs / carbsGoal) * 100, 100);
  const fatPercentage = Math.min((fat / fatGoal) * 100, 100);

  const renderProgressBar = (percentage: number, color: string, label: string, value: number, goal: number) => (
    <View style={styles.progressItem}>
      <View style={styles.progressHeader}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressValue}>{value}g / {goal}g</Text>
      </View>
      <View style={styles.progressBar}>
        <View style={[styles.progressFill, { width: `${percentage}%`, backgroundColor: color }]} />
      </View>
      <Text style={styles.progressPercentage}>{Math.round(percentage)}%</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Macronutrient Progress</Text>
      
      {renderProgressBar(proteinPercentage, '#10b981', 'Protein', protein, proteinGoal)}
      {renderProgressBar(carbsPercentage, '#3b82f6', 'Carbs', carbs, carbsGoal)}
      {renderProgressBar(fatPercentage, '#f59e0b', 'Fat', fat, fatGoal)}

      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#10b981' }]} />
          <Text style={styles.legendText}>Protein</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
          <Text style={styles.legendText}>Carbs</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendDot, { backgroundColor: '#f59e0b' }]} />
          <Text style={styles.legendText}>Fat</Text>
        </View>
      </View>
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
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 20,
  },
  progressItem: {
    marginBottom: 16,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  progressLabel: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  progressValue: {
    fontSize: 12,
    color: '#999',
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  progressPercentage: {
    fontSize: 12,
    color: '#666',
    textAlign: 'right',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 8,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 4,
  },
  legendText: {
    fontSize: 11,
    color: '#666',
  },
});

export default MacroProgress;