// components/nutrition/DailySummary.tsx
import React from 'react';
import { StyleSheet, View, Text } from 'react-native';

interface DailySummaryProps {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  water: number;
}

const DailySummary: React.FC<DailySummaryProps> = ({ calories, protein, carbs, fat, water }) => {
  const totalGrams = protein + carbs + fat;
  const proteinPercentage = totalGrams > 0 ? (protein / totalGrams) * 100 : 0;
  const carbsPercentage = totalGrams > 0 ? (carbs / totalGrams) * 100 : 0;
  const fatPercentage = totalGrams > 0 ? (fat / totalGrams) * 100 : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Daily Summary</Text>
      
      <View style={styles.macroBreakdown}>
        <View style={styles.macroRow}>
          <View style={styles.macroLabelContainer}>
            <View style={[styles.macroDot, { backgroundColor: '#10b981' }]} />
            <Text style={styles.macroLabel}>Protein</Text>
          </View>
          <Text style={styles.macroValue}>{protein}g ({Math.round(proteinPercentage)}%)</Text>
        </View>
        
        <View style={styles.macroRow}>
          <View style={styles.macroLabelContainer}>
            <View style={[styles.macroDot, { backgroundColor: '#3b82f6' }]} />
            <Text style={styles.macroLabel}>Carbs</Text>
          </View>
          <Text style={styles.macroValue}>{carbs}g ({Math.round(carbsPercentage)}%)</Text>
        </View>
        
        <View style={styles.macroRow}>
          <View style={styles.macroLabelContainer}>
            <View style={[styles.macroDot, { backgroundColor: '#f59e0b' }]} />
            <Text style={styles.macroLabel}>Fat</Text>
          </View>
          <Text style={styles.macroValue}>{fat}g ({Math.round(fatPercentage)}%)</Text>
        </View>
      </View>

      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{calories}</Text>
          <Text style={styles.summaryLabel}>Calories</Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{water}ml</Text>
          <Text style={styles.summaryLabel}>Water</Text>
        </View>
        
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{totalGrams}g</Text>
          <Text style={styles.summaryLabel}>Total Macros</Text>
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
    marginBottom: 16,
  },
  macroBreakdown: {
    marginBottom: 20,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  macroLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  macroLabel: {
    fontSize: 14,
    color: '#666',
  },
  macroValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  summaryGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summaryItem: {
    alignItems: 'center',
    flex: 1,
  },
  summaryValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666',
  },
});

export default DailySummary;