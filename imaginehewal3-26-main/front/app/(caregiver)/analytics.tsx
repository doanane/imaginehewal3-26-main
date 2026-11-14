import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Dimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';

export default function AnalyticsScreen() {
  const router = useRouter();
  const brandColor = 'rgb(173, 0, 35)';
  const screenWidth = Dimensions.get('window').width;
  
  const [timeRange, setTimeRange] = useState('week');
  
  const healthScoreData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [{
      data: [65, 70, 68, 72, 75, 78, 82],
      color: (opacity = 1) => brandColor,
      strokeWidth: 2
    }]
  };

  const medicationData = {
    labels: ['Alex', 'Sarah', 'Robert', 'Mary', 'John'],
    datasets: [{
      data: [95, 88, 72, 90, 85]
    }]
  };

  const conditionDistribution = [
    { name: 'Hypertension', population: 35, color: '#FF6384', legendFontColor: '#7F7F7F' },
    { name: 'Diabetes', population: 25, color: '#36A2EB', legendFontColor: '#7F7F7F' },
    { name: 'Arthritis', population: 20, color: '#FFCE56', legendFontColor: '#7F7F7F' },
    { name: 'Asthma', population: 15, color: '#4BC0C0', legendFontColor: '#7F7F7F' },
    { name: 'Others', population: 5, color: '#9966FF', legendFontColor: '#7F7F7F' }
  ];

  const stats = {
    avgHealthScore: 76,
    medicationAdherence: 86,
    criticalAlerts: 3,
    completedTasks: 42,
    pendingTasks: 8,
    patientSatisfaction: 92
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics Dashboard</Text>
        <TouchableOpacity style={styles.filterButton}>
          <Ionicons name="filter" size={24} color={brandColor} />
        </TouchableOpacity>
      </View>

      <View style={styles.timeRangeContainer}>
        {['day', 'week', 'month', 'year'].map((range) => (
          <TouchableOpacity
            key={range}
            style={[styles.timeRangeButton, timeRange === range && styles.timeRangeActive]}
            onPress={() => setTimeRange(range)}
          >
            <Text style={[styles.timeRangeText, timeRange === range && styles.timeRangeActiveText]}>
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="heart-pulse" size={24} color={brandColor} />
            <Text style={styles.statValue}>{stats.avgHealthScore}</Text>
            <Text style={styles.statLabel}>Avg Health Score</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialCommunityIcons name="pill" size={24} color="#10B981" />
            <Text style={styles.statValue}>{stats.medicationAdherence}%</Text>
            <Text style={styles.statLabel}>Medication Adherence</Text>
          </View>
        </View>
        <View style={styles.statRow}>
          <View style={styles.statCard}>
            <Ionicons name="alert-circle" size={24} color="#EF4444" />
            <Text style={styles.statValue}>{stats.criticalAlerts}</Text>
            <Text style={styles.statLabel}>Critical Alerts</Text>
          </View>
          <View style={styles.statCard}>
            <Ionicons name="checkmark-done-circle" size={24} color="#3B82F6" />
            <Text style={styles.statValue}>{stats.completedTasks}</Text>
            <Text style={styles.statLabel}>Completed Tasks</Text>
          </View>
        </View>
      </View>

      <View style={styles.chartSection}>
        <Text style={styles.sectionTitle}>Health Score Trend</Text>
        <LineChart
          data={healthScoreData}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 0,
            color: (opacity = 1) => brandColor,
            labelColor: (opacity = 1) => '#666',
            style: { borderRadius: 16 },
            propsForDots: { r: '6', strokeWidth: '2', stroke: brandColor }
          }}
          bezier
          style={styles.chart}
        />
      </View>

      <View style={styles.chartSection}>
        <Text style={styles.sectionTitle}>Medication Adherence by Patient</Text>
        <BarChart
          data={medicationData}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 0,
            color: (opacity = 1) => brandColor,
            labelColor: (opacity = 1) => '#666'
          }}
          style={styles.chart}
          showValuesOnTopOfBars
          yAxisLabel=""
          yAxisSuffix="%"
        />
      </View>

      <View style={styles.chartSection}>
        <Text style={styles.sectionTitle}>Condition Distribution</Text>
        <PieChart
          data={conditionDistribution}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`
          }}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15"
          absolute
        />
      </View>

      <View style={styles.insightsSection}>
        <Text style={styles.sectionTitle}>Key Insights</Text>
        <View style={styles.insightCard}>
          <Ionicons name="trending-up" size={20} color="#10B981" />
          <Text style={styles.insightText}>
            Average health score improved by 8% this week
          </Text>
        </View>
        <View style={styles.insightCard}>
          <Ionicons name="alert-circle" size={20} color="#EF4444" />
          <Text style={styles.insightText}>
            3 critical alerts need immediate attention
          </Text>
        </View>
        <View style={styles.insightCard}>
          <Ionicons name="medical" size={20} color="#3B82F6" />
          <Text style={styles.insightText}>
            Medication adherence highest in morning doses
          </Text>
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: 'white' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  filterButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  
  timeRangeContainer: { flexDirection: 'row', backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 15, gap: 10 },
  timeRangeButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6' },
  timeRangeActive: { backgroundColor: 'rgb(173, 0, 35)' },
  timeRangeText: { fontSize: 14, color: '#666', fontWeight: '500' },
  timeRangeActiveText: { color: 'white' },
  
  statsContainer: { backgroundColor: 'white', padding: 20, marginTop: 1 },
  statRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  statCard: { flex: 1, backgroundColor: '#F8F9FA', padding: 16, borderRadius: 12, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A', marginTop: 8, marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#666', textAlign: 'center' },
  
  chartSection: { backgroundColor: 'white', padding: 20, marginTop: 10 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 15 },
  chart: { borderRadius: 16, marginTop: 10 },
  
  insightsSection: { backgroundColor: 'white', padding: 20, marginTop: 10 },
  insightCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#F8F9FA', padding: 16, borderRadius: 12, marginBottom: 10 },
  insightText: { flex: 1, fontSize: 14, color: '#1A1A1A', lineHeight: 20 }
});