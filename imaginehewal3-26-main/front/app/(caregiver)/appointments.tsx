// front/app/(caregiver)/appointments.tsx
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GRADIENTS, theme } from '../../constants/theme';

const { width } = Dimensions.get('window');

interface Appointment {
  id: number;
  patient_name: string;
  patient_id: string;
  type: 'checkup' | 'consultation' | 'procedure' | 'follow-up';
  date: string;
  time: string;
  duration: number;
  status: 'upcoming' | 'completed' | 'cancelled';
  location: string;
  notes?: string;
}

export default function AppointmentsScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedView, setSelectedView] = useState<'day' | 'week' | 'month'>('day');

  const appointments: Appointment[] = [
    {
      id: 1,
      patient_name: 'John Smith',
      patient_id: 'P001',
      type: 'checkup',
      date: new Date().toISOString(),
      time: '09:00 AM',
      duration: 30,
      status: 'upcoming',
      location: 'Room 101',
      notes: 'Regular checkup'
    },
    {
      id: 2,
      patient_name: 'Jane Doe',
      patient_id: 'P002',
      type: 'consultation',
      date: new Date().toISOString(),
      time: '11:30 AM',
      duration: 45,
      status: 'upcoming',
      location: 'Room 205',
      notes: 'Discuss medication changes'
    },
    {
      id: 3,
      patient_name: 'Robert Johnson',
      patient_id: 'P003',
      type: 'follow-up',
      date: new Date().toISOString(),
      time: '02:00 PM',
      duration: 20,
      status: 'upcoming',
      location: 'Room 103'
    }
  ];

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'checkup': return theme.COLORS.info;
      case 'consultation': return theme.COLORS.primary;
      case 'procedure': return theme.COLORS.danger;
      case 'follow-up': return theme.COLORS.success;
      default: return theme.COLORS.textSecondary;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'checkup': return 'fitness';
      case 'consultation': return 'chatbubbles';
      case 'procedure': return 'medical';
      case 'follow-up': return 'refresh';
      default: return 'calendar';
    }
  };

  const renderAppointmentCard = (appointment: Appointment, index: number) => (
    <Animated.View
      key={appointment.id}
      entering={FadeInDown.delay(index * 50)}
      style={styles.appointmentCard}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.typeIcon, { backgroundColor: getTypeColor(appointment.type) + '15' }]}>
          <Ionicons name={getTypeIcon(appointment.type) as any} size={24} color={getTypeColor(appointment.type)} />
        </View>
        <View style={styles.cardHeaderText}>
          <Text style={styles.patientName}>{appointment.patient_name}</Text>
          <Text style={styles.patientId}>ID: {appointment.patient_id}</Text>
        </View>
        <View style={[styles.typeBadge, { backgroundColor: getTypeColor(appointment.type) }]}>
          <Text style={styles.typeBadgeText}>
            {appointment.type.charAt(0).toUpperCase() + appointment.type.slice(1)}
          </Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.infoRow}>
          <Ionicons name="time-outline" size={16} color={theme.COLORS.textSecondary} />
          <Text style={styles.infoText}>{appointment.time} ({appointment.duration} min)</Text>
        </View>
        <View style={styles.infoRow}>
          <Ionicons name="location-outline" size={16} color={theme.COLORS.textSecondary} />
          <Text style={styles.infoText}>{appointment.location}</Text>
        </View>
        {appointment.notes && (
          <View style={styles.infoRow}>
            <Ionicons name="document-text-outline" size={16} color={theme.COLORS.textSecondary} />
            <Text style={styles.infoText}>{appointment.notes}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="call" size={18} color={theme.COLORS.primary} />
          <Text style={styles.actionText}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="videocam" size={18} color={theme.COLORS.success} />
          <Text style={styles.actionText}>Video</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionButton}>
          <Ionicons name="document-text" size={18} color={theme.COLORS.info} />
          <Text style={styles.actionText}>Notes</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <LinearGradient colors={GRADIENTS.primary} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Appointments</Text>
            <Text style={styles.headerSubtitle}>Today • {appointments.length} scheduled</Text>
          </View>
          <TouchableOpacity style={styles.addButton}>
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* View Selector */}
        <View style={styles.viewSelector}>
          {(['day', 'week', 'month'] as const).map((view) => (
            <TouchableOpacity
              key={view}
              style={[styles.viewButton, selectedView === view && styles.viewButtonActive]}
              onPress={() => setSelectedView(view)}
            >
              <Text style={[styles.viewText, selectedView === view && styles.viewTextActive]}>
                {view.charAt(0).toUpperCase() + view.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </LinearGradient>

      {/* Stats Cards */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{appointments.length}</Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.COLORS.success }]}>12</Text>
          <Text style={styles.statLabel}>This Week</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: theme.COLORS.info }]}>45</Text>
          <Text style={styles.statLabel}>This Month</Text>
        </View>
      </View>

      {/* Appointments List */}
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.appointmentsList}>
        <Text style={styles.sectionTitle}>Today's Schedule</Text>
        {loading ? (
          <ActivityIndicator size="large" color={theme.COLORS.primary} style={styles.loader} />
        ) : appointments.length > 0 ? (
          appointments.map((appointment, index) => renderAppointmentCard(appointment, index))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={64} color={theme.COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>No Appointments</Text>
            <Text style={styles.emptySubtitle}>You have no appointments scheduled for today</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.COLORS.background,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : StatusBar.currentHeight ? StatusBar.currentHeight + 20 : 40,
    paddingHorizontal: theme.SPACING.lg,
    paddingBottom: theme.SPACING.lg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.SPACING.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewSelector: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 25,
    padding: 4,
  },
  viewButton: {
    flex: 1,
    paddingVertical: theme.SPACING.sm,
    alignItems: 'center',
    borderRadius: 20,
  },
  viewButtonActive: {
    backgroundColor: '#FFFFFF',
  },
  viewText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  viewTextActive: {
    color: theme.COLORS.primary,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: theme.SPACING.lg,
    paddingVertical: theme.SPACING.md,
    gap: theme.SPACING.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.md,
    alignItems: 'center',
    ...theme.SHADOWS.small,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.COLORS.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: theme.COLORS.textSecondary,
  },
  scrollView: {
    flex: 1,
  },
  appointmentsList: {
    padding: theme.SPACING.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.COLORS.textPrimary,
    marginBottom: theme.SPACING.md,
  },
  appointmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.lg,
    marginBottom: theme.SPACING.md,
    ...theme.SHADOWS.medium,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.SPACING.md,
  },
  typeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.SPACING.md,
  },
  cardHeaderText: {
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.COLORS.textPrimary,
  },
  patientId: {
    fontSize: 12,
    color: theme.COLORS.textTertiary,
    marginTop: 2,
  },
  typeBadge: {
    paddingHorizontal: theme.SPACING.sm,
    paddingVertical: 4,
    borderRadius: theme.LAYOUT.borderRadius.sm,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  cardBody: {
    gap: theme.SPACING.sm,
    marginBottom: theme.SPACING.md,
    paddingBottom: theme.SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.COLORS.border,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.SPACING.sm,
  },
  infoText: {
    fontSize: 14,
    color: theme.COLORS.textSecondary,
  },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.SPACING.xs,
    paddingVertical: theme.SPACING.sm,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.COLORS.textSecondary,
  },
  loader: {
    marginTop: theme.SPACING.xxl,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.SPACING.xxl * 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.COLORS.textPrimary,
    marginTop: theme.SPACING.md,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.COLORS.textSecondary,
    marginTop: theme.SPACING.xs,
    textAlign: 'center',
  },
});
