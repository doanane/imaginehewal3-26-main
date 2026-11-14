import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { LineChart } from 'react-native-chart-kit';
import { theme, GRADIENTS } from '../../constants/theme';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PatientVital {
  id: number;
  name: string;
  patient_id: string;
  latest_vitals: {
    heart_rate?: number;
    blood_pressure?: string;
    blood_glucose?: number;
    temperature?: number;
    oxygen_saturation?: number;
    timestamp: string;
  };
  status: 'normal' | 'warning' | 'critical';
  trend: 'up' | 'down' | 'stable';
}

interface VitalHistory {
  timestamp: string;
  heart_rate?: number;
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  blood_glucose?: number;
  temperature?: number;
  oxygen_saturation?: number;
}

export default function VitalMonitoringScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [patients, setPatients] = useState<PatientVital[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<PatientVital | null>(null);
  const [vitalHistory, setVitalHistory] = useState<VitalHistory[]>([]);
  const [selectedMetric, setSelectedMetric] = useState<string>('heart_rate');
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('24h');

  const metrics = [
    { key: 'heart_rate', label: 'Heart Rate', unit: 'bpm', color: '#FF6B6B' },
    { key: 'blood_pressure', label: 'Blood Pressure', unit: 'mmHg', color: '#4ECDC4' },
    { key: 'blood_glucose', label: 'Blood Glucose', unit: 'mg/dL', color: '#FFD166' },
    { key: 'temperature', label: 'Temperature', unit: '°C', color: '#06D6A0' },
    { key: 'oxygen_saturation', label: 'O₂ Saturation', unit: '%', color: '#118AB2' },
  ];

  const fetchVitalData = async () => {
    try {
      setLoading(true);
      
      // TODO: Replace with actual API calls
      // For now, using mock data
      const mockPatients: PatientVital[] = [
        {
          id: 1,
          name: 'John Doe',
          patient_id: 'PAT001',
          latest_vitals: {
            heart_rate: 72,
            blood_pressure: '120/80',
            blood_glucose: 110,
            temperature: 36.8,
            oxygen_saturation: 98,
            timestamp: new Date().toISOString(),
          },
          status: 'normal',
          trend: 'stable',
        },
        {
          id: 2,
          name: 'Jane Smith',
          patient_id: 'PAT002',
          latest_vitals: {
            heart_rate: 92,
            blood_pressure: '140/90',
            blood_glucose: 180,
            temperature: 37.2,
            oxygen_saturation: 94,
            timestamp: new Date().toISOString(),
          },
          status: 'warning',
          trend: 'up',
        },
        {
          id: 3,
          name: 'Robert Johnson',
          patient_id: 'PAT003',
          latest_vitals: {
            heart_rate: 112,
            blood_pressure: '160/100',
            blood_glucose: 240,
            temperature: 38.1,
            oxygen_saturation: 89,
            timestamp: new Date().toISOString(),
          },
          status: 'critical',
          trend: 'up',
        },
      ];

      setPatients(mockPatients);
      
      // Mock vital history data
      const mockHistory: VitalHistory[] = Array.from({ length: 10 }, (_, i) => ({
        timestamp: new Date(Date.now() - i * 3600000).toISOString(),
        heart_rate: 70 + Math.random() * 20,
        blood_pressure_systolic: 110 + Math.random() * 30,
        blood_pressure_diastolic: 70 + Math.random() * 15,
        blood_glucose: 100 + Math.random() * 50,
        temperature: 36.5 + Math.random() * 1.5,
        oxygen_saturation: 95 + Math.random() * 3,
      }));

      setVitalHistory(mockHistory);
      
      if (!selectedPatient && mockPatients.length > 0) {
        setSelectedPatient(mockPatients[0]);
      }
    } catch (error) {
      console.error('Error fetching vital data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVitalData();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchVitalData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'critical': return theme.COLORS.danger;
      case 'warning': return theme.COLORS.warning;
      case 'normal': return theme.COLORS.success;
      default: return theme.COLORS.textTertiary;
    }
  };

  const getStatusBg = (status: string) => {
    switch (status) {
      case 'critical': return theme.COLORS.dangerLight;
      case 'warning': return theme.COLORS.warningLight;
      case 'normal': return theme.COLORS.successLight;
      default: return theme.COLORS.background;
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return 'trending-up';
      case 'down': return 'trending-down';
      default: return 'remove';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return theme.COLORS.danger;
      case 'down': return theme.COLORS.success;
      default: return theme.COLORS.textTertiary;
    }
  };

  const prepareChartData = () => {
    const metricData = vitalHistory.map(h => {
      const value = h[selectedMetric as keyof VitalHistory];
      return typeof value === 'number' ? value : 0;
    }).reverse();

    const labels = vitalHistory.map((h, i) => {
      const date = new Date(h.timestamp);
      if (timeRange === '24h') {
        return date.getHours().toString().padStart(2, '0');
      } else {
        return date.getDate().toString();
      }
    }).reverse();

    return {
      labels: labels,
      datasets: [{
        data: metricData,
        color: (opacity = 1) => metrics.find(m => m.key === selectedMetric)?.color || '#4A90E2',
        strokeWidth: 2,
      }],
    };
  };

  const chartConfig = {
    backgroundColor: theme.COLORS.card,
    backgroundGradientFrom: theme.COLORS.card,
    backgroundGradientTo: theme.COLORS.card,
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
    style: {
      borderRadius: 16,
    },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: '#fff',
    },
  };

  const formatTime = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  if (loading && patients.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.COLORS.primary} />
        <Text style={styles.loadingText}>Loading vital data...</Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={GRADIENTS.authBackground}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={theme.COLORS.textOnDark} />
            </TouchableOpacity>
            <Text style={styles.title}>Vital Monitoring</Text>
            <TouchableOpacity style={styles.settingsButton}>
              <Ionicons name="settings-outline" size={24} color={theme.COLORS.textOnDark} />
            </TouchableOpacity>
          </View>

          {/* Patient Selector */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.patientSelector}
            contentContainerStyle={styles.patientSelectorContent}
          >
            {patients.map((patient) => (
              <TouchableOpacity
                key={patient.id}
                style={[
                  styles.patientButton,
                  selectedPatient?.id === patient.id && styles.patientButtonActive
                ]}
                onPress={() => setSelectedPatient(patient)}
              >
                <View style={styles.patientButtonHeader}>
                  <View style={styles.patientInitials}>
                    <Text style={styles.patientInitialsText}>
                      {patient.name.split(' ').map(n => n[0]).join('')}
                    </Text>
                  </View>
                  <View style={[styles.statusDot, { backgroundColor: getStatusColor(patient.status) }]} />
                </View>
                <Text style={styles.patientButtonName}>{patient.name.split(' ')[0]}</Text>
                <Text style={styles.patientButtonId}>{patient.patient_id}</Text>
                <View style={styles.trendContainer}>
                  <Ionicons 
                    name={getTrendIcon(patient.trend)} 
                    size={14} 
                    color={getTrendColor(patient.trend)} 
                  />
                  <Text style={[styles.trendText, { color: getTrendColor(patient.trend) }]}>
                    {patient.trend}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Selected Patient Vitals */}
          {selectedPatient && (
            <View style={styles.vitalCard}>
              <View style={styles.vitalCardHeader}>
                <View>
                  <Text style={styles.patientName}>{selectedPatient.name}</Text>
                  <Text style={styles.patientId}>ID: {selectedPatient.patient_id}</Text>
                </View>
                <View style={[styles.statusBadge, { backgroundColor: getStatusBg(selectedPatient.status) }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(selectedPatient.status) }]}>
                    {selectedPatient.status.toUpperCase()}
                  </Text>
                </View>
              </View>

              <Text style={styles.lastUpdated}>
                Last updated: {formatTime(selectedPatient.latest_vitals.timestamp)}
              </Text>

              <View style={styles.vitalsGrid}>
                {Object.entries(selectedPatient.latest_vitals)
                  .filter(([key]) => key !== 'timestamp')
                  .map(([key, value]) => {
                    const metric = metrics.find(m => m.key === key);
                    if (!metric || value === undefined) return null;

                    return (
                      <View key={key} style={styles.vitalItem}>
                        <Text style={styles.vitalLabel}>{metric.label}</Text>
                        <Text style={styles.vitalValue}>{value}</Text>
                        <Text style={styles.vitalUnit}>{metric.unit}</Text>
                      </View>
                    );
                  })}
              </View>
            </View>
          )}

          {/* Metric Selector */}
          <View style={styles.metricSelector}>
            {metrics.map((metric) => (
              <TouchableOpacity
                key={metric.key}
                style={[
                  styles.metricButton,
                  selectedMetric === metric.key && styles.metricButtonActive
                ]}
                onPress={() => setSelectedMetric(metric.key)}
              >
                <View style={[styles.metricIcon, { backgroundColor: `${metric.color}20` }]}>
                  <Ionicons 
                    name="pulse" 
                    size={20} 
                    color={metric.color} 
                  />
                </View>
                <Text style={[
                  styles.metricLabel,
                  selectedMetric === metric.key && styles.metricLabelActive
                ]}>
                  {metric.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Time Range Selector */}
          <View style={styles.timeRangeSelector}>
            {(['24h', '7d', '30d'] as const).map((range) => (
              <TouchableOpacity
                key={range}
                style={[
                  styles.timeRangeButton,
                  timeRange === range && styles.timeRangeButtonActive
                ]}
                onPress={() => setTimeRange(range)}
              >
                <Text style={[
                  styles.timeRangeText,
                  timeRange === range && styles.timeRangeTextActive
                ]}>
                  {range}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Chart */}
          {vitalHistory.length > 0 && (
            <View style={styles.chartContainer}>
              <Text style={styles.chartTitle}>
                {metrics.find(m => m.key === selectedMetric)?.label} Trend
              </Text>
              <LineChart
                data={prepareChartData()}
                width={SCREEN_WIDTH - 48}
                height={220}
                chartConfig={chartConfig}
                bezier
                style={styles.chart}
                withVerticalLines={false}
                withHorizontalLines={false}
                withInnerLines={false}
                withOuterLines={false}
              />
            </View>
          )}

          {/* Vital History */}
          <View style={styles.historySection}>
            <Text style={styles.sectionTitle}>Recent Readings</Text>
            <View style={styles.historyList}>
              {vitalHistory.slice(0, 5).map((reading, index) => (
                <View key={index} style={styles.historyItem}>
                  <Text style={styles.historyTime}>
                    {formatTime(reading.timestamp)}
                  </Text>
                  <View style={styles.historyValues}>
                    {reading.heart_rate && (
                      <View style={styles.historyValue}>
                        <Ionicons name="heart" size={12} color="#FF6B6B" />
                        <Text style={styles.historyValueText}>{reading.heart_rate}</Text>
                      </View>
                    )}
                    {reading.blood_pressure_systolic && reading.blood_pressure_diastolic && (
                      <View style={styles.historyValue}>
                        <Ionicons name="speedometer" size={12} color="#4ECDC4" />
                        <Text style={styles.historyValueText}>
                          {reading.blood_pressure_systolic}/{reading.blood_pressure_diastolic}
                        </Text>
                      </View>
                    )}
                    {reading.blood_glucose && (
                      <View style={styles.historyValue}>
                        <Ionicons name="water" size={12} color="#FFD166" />
                        <Text style={styles.historyValueText}>{reading.blood_glucose}</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>

          {/* Alerts */}
          <View style={styles.alertsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Critical Alerts</Text>
              <TouchableOpacity>
                <Text style={styles.seeAllText}>See All</Text>
              </TouchableOpacity>
            </View>
            {patients.filter(p => p.status === 'critical').map((patient) => (
              <TouchableOpacity key={patient.id} style={styles.alertCard}>
                <View style={styles.alertHeader}>
                  <View style={styles.alertPatient}>
                    <View style={[styles.alertDot, { backgroundColor: theme.COLORS.danger }]} />
                    <Text style={styles.alertPatientName}>{patient.name}</Text>
                  </View>
                  <Text style={styles.alertTime}>Just now</Text>
                </View>
                <Text style={styles.alertMessage}>
                  Critical readings detected in multiple vital signs
                </Text>
                <View style={styles.alertActions}>
                  <TouchableOpacity style={styles.alertActionButton}>
                    <Text style={styles.alertActionText}>Acknowledge</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.alertActionButton, styles.primaryAction]}>
                    <Text style={[styles.alertActionText, { color: theme.COLORS.textOnPrimary }]}>
                      Take Action
                    </Text>
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: theme.SPACING.lg,
    paddingTop: theme.SPACING.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.COLORS.background,
  },
  loadingText: {
    marginTop: theme.SPACING.md,
    color: theme.COLORS.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.SPACING.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.COLORS.textOnDark,
  },
  settingsButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientSelector: {
    marginBottom: theme.SPACING.xl,
  },
  patientSelectorContent: {
    paddingHorizontal: 4,
    gap: theme.SPACING.md,
  },
  patientButton: {
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.md,
    width: 120,
    alignItems: 'center',
    ...theme.SHADOWS.small,
  },
  patientButtonActive: {
    backgroundColor: theme.COLORS.primaryMuted,
    borderWidth: 2,
    borderColor: theme.COLORS.primary,
  },
  patientButtonHeader: {
    position: 'relative',
    marginBottom: theme.SPACING.sm,
  },
  patientInitials: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientInitialsText: {
    color: theme.COLORS.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.COLORS.card,
  },
  patientButtonName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.COLORS.textOnDark,
    marginBottom: 2,
  },
  patientButtonId: {
    fontSize: 12,
    color: theme.COLORS.textSecondary,
    marginBottom: theme.SPACING.sm,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '500',
  },
  vitalCard: {
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.lg,
    marginBottom: theme.SPACING.xl,
    ...theme.SHADOWS.medium,
  },
  vitalCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.SPACING.md,
  },
  patientName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.COLORS.textOnDark,
  },
  patientId: {
    fontSize: 14,
    color: theme.COLORS.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: theme.SPACING.sm,
    paddingVertical: 4,
    borderRadius: theme.LAYOUT.borderRadius.sm,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  lastUpdated: {
    fontSize: 12,
    color: theme.COLORS.textSecondary,
    marginBottom: theme.SPACING.lg,
  },
  vitalsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -theme.SPACING.sm,
  },
  vitalItem: {
    width: '50%',
    paddingHorizontal: theme.SPACING.sm,
    marginBottom: theme.SPACING.lg,
    alignItems: 'center',
  },
  vitalLabel: {
    fontSize: 12,
    color: theme.COLORS.textSecondary,
    marginBottom: 4,
    textAlign: 'center',
  },
  vitalValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.COLORS.textOnDark,
    marginBottom: 2,
  },
  vitalUnit: {
    fontSize: 12,
    color: theme.COLORS.textTertiary,
  },
  metricSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -theme.SPACING.xs,
    marginBottom: theme.SPACING.xl,
  },
  metricButton: {
    paddingHorizontal: theme.SPACING.md,
    paddingVertical: theme.SPACING.sm,
    borderRadius: theme.LAYOUT.borderRadius.md,
    backgroundColor: theme.COLORS.card,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: theme.SPACING.xs,
    marginBottom: theme.SPACING.xs,
    gap: theme.SPACING.xs,
    ...theme.SHADOWS.small,
  },
  metricButtonActive: {
    backgroundColor: theme.COLORS.primaryMuted,
    borderWidth: 1,
    borderColor: theme.COLORS.primary,
  },
  metricIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricLabel: {
    fontSize: 14,
    color: theme.COLORS.textSecondary,
    fontWeight: '500',
  },
  metricLabelActive: {
    color: theme.COLORS.primary,
    fontWeight: '600',
  },
  timeRangeSelector: {
    flexDirection: 'row',
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.md,
    padding: 4,
    marginBottom: theme.SPACING.xl,
    ...theme.SHADOWS.small,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: theme.SPACING.sm,
    borderRadius: theme.LAYOUT.borderRadius.sm,
    alignItems: 'center',
  },
  timeRangeButtonActive: {
    backgroundColor: theme.COLORS.primary,
  },
  timeRangeText: {
    fontSize: 14,
    color: theme.COLORS.textSecondary,
    fontWeight: '500',
  },
  timeRangeTextActive: {
    color: theme.COLORS.textOnPrimary,
    fontWeight: '600',
  },
  chartContainer: {
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.lg,
    marginBottom: theme.SPACING.xl,
    ...theme.SHADOWS.medium,
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.COLORS.textOnDark,
    marginBottom: theme.SPACING.lg,
  },
  chart: {
    marginVertical: 8,
    borderRadius: 16,
  },
  historySection: {
    marginBottom: theme.SPACING.xl,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.COLORS.textOnDark,
    marginBottom: theme.SPACING.md,
  },
  historyList: {
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    overflow: 'hidden',
    ...theme.SHADOWS.medium,
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  historyTime: {
    fontSize: 14,
    color: theme.COLORS.textSecondary,
  },
  historyValues: {
    flexDirection: 'row',
    gap: theme.SPACING.md,
  },
  historyValue: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyValueText: {
    fontSize: 14,
    color: theme.COLORS.textOnDark,
    fontWeight: '500',
  },
  alertsSection: {
    marginBottom: theme.SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.SPACING.md,
  },
  seeAllText: {
    fontSize: 14,
    color: theme.COLORS.primary,
    fontWeight: '500',
  },
  alertCard: {
    backgroundColor: theme.COLORS.dangerLight,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.lg,
    marginBottom: theme.SPACING.md,
    ...theme.SHADOWS.medium,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.SPACING.sm,
  },
  alertPatient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.SPACING.sm,
  },
  alertDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  alertPatientName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.COLORS.textOnDark,
  },
  alertTime: {
    fontSize: 12,
    color: theme.COLORS.danger,
  },
  alertMessage: {
    fontSize: 14,
    color: theme.COLORS.textOnDark,
    marginBottom: theme.SPACING.md,
    lineHeight: 20,
  },
  alertActions: {
    flexDirection: 'row',
    gap: theme.SPACING.md,
  },
  alertActionButton: {
    flex: 1,
    padding: theme.SPACING.sm,
    borderRadius: theme.LAYOUT.borderRadius.md,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
  },
  primaryAction: {
    backgroundColor: theme.COLORS.danger,
  },
  alertActionText: {
    fontSize: 14,
    color: theme.COLORS.textOnDark,
    fontWeight: '500',
  },
});