// front/app/(caregiver)/dashboard.tsx - Professional Healthcare Dashboard
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Image,
  Platform,
  RefreshControl,
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
import { useAuth } from '../../contexts/AuthContext';
import api, { AssignedPatient, CaregiverDashboardData } from '../../services/api';

const { width } = Dimensions.get('window');

// Types
interface PatientCardData {
  id: string;
  name: string;
  patient_id: string;
  status: string;
  health_score: number;
  image: string;
  conditions: string[];
  last_checkup?: string;
  age?: number;
  gender?: string;
}

interface QuickAction {
  id: number;
  title: string;
  icon: string;
  color: string;
  screen: string;
}

// Stat Card Component
const StatCard: React.FC<{
  title: string;
  value: number;
  icon: string;
  color: string;
  index: number;
}> = ({ title, value, icon, color, index }) => (
  <Animated.View 
    entering={FadeInDown.delay(index * 50)} 
    style={styles.statCard}
  >
    <View style={[styles.statIconContainer, { backgroundColor: color + '15' }]}>
      <Ionicons name={icon as any} size={22} color={color} />
    </View>
    <View style={styles.statTextContainer}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{title}</Text>
    </View>
  </Animated.View>
);

// Quick Action Component
const QuickActionButton: React.FC<{
  action: QuickAction;
  index: number;
  onPress: (screen: string) => void;
}> = ({ action, index, onPress }) => (
  <Animated.View entering={FadeInDown.delay(100 + (index * 30))}>
    <TouchableOpacity 
      style={styles.quickActionButton}
      onPress={() => onPress(action.screen)}
      activeOpacity={0.7}
    >
      <View style={[styles.quickActionIcon, { backgroundColor: action.color + '15' }]}>
        <Ionicons name={action.icon as any} size={24} color={action.color} />
      </View>
      <Text style={styles.quickActionTitle}>{action.title}</Text>
    </TouchableOpacity>
  </Animated.View>
);

// Patient Card Component
const PatientCard: React.FC<{
  patient: PatientCardData;
  index: number;
  onPress: (patient: PatientCardData) => void;
}> = ({ patient, index, onPress }) => {
  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'critical': return theme.COLORS.danger;
      case 'stable': return theme.COLORS.success;
      case 'active': return theme.COLORS.success;
      case 'pending': return theme.COLORS.warning;
      case 'needs attention': return theme.COLORS.warning;
      default: return theme.COLORS.textTertiary;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'critical': return 'warning';
      case 'stable': return 'checkmark-circle';
      case 'active': return 'pulse';
      case 'pending': return 'time';
      default: return 'help-circle';
    }
  };

  return (
    <Animated.View 
      entering={FadeInDown.delay(200 + (index * 50))}
      style={styles.patientCard}
    >
      <TouchableOpacity 
        onPress={() => onPress(patient)}
        style={styles.patientCardInner}
        activeOpacity={0.7}
      >
        <View style={styles.patientHeader}>
          <View style={styles.patientAvatarContainer}>
            <Image 
              source={{ uri: patient.image }} 
              style={styles.patientAvatar}
            />
            <View style={[
              styles.patientStatusIndicator, 
              { backgroundColor: getStatusColor(patient.status) }
            ]} />
          </View>
          
          <View style={styles.patientInfo}>
            <View style={styles.patientNameRow}>
              <Text style={styles.patientName} numberOfLines={1}>
                {patient.name}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusColor(patient.status) + '15' }]}>
                <Ionicons 
                  name={getStatusIcon(patient.status) as any} 
                  size={12} 
                  color={getStatusColor(patient.status)} 
                  style={styles.statusIcon}
                />
                <Text style={[styles.statusText, { color: getStatusColor(patient.status) }]}>
                  {patient.status.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.patientId}>Patient ID: {patient.patient_id}</Text>
            
            {patient.age && patient.gender && (
              <Text style={styles.patientDetails}>
                {patient.age}y • {patient.gender}
              </Text>
            )}
          </View>
        </View>
        
        {/* Health Score */}
        <View style={styles.healthScoreContainer}>
          <Text style={styles.healthScoreLabel}>Health Score</Text>
          <View style={styles.scoreRow}>
            <View style={styles.scoreBarContainer}>
              <View style={styles.scoreBarBackground}>
                <View 
                  style={[
                    styles.scoreBarFill,
                    { 
                      width: `${patient.health_score}%`,
                      backgroundColor: patient.health_score > 75 ? theme.COLORS.success : 
                                     patient.health_score > 50 ? theme.COLORS.warning : 
                                     theme.COLORS.danger
                    }
                  ]}
                />
              </View>
              <Text style={[
                styles.scoreValue,
                { 
                  color: patient.health_score > 75 ? theme.COLORS.success : 
                         patient.health_score > 50 ? theme.COLORS.warning : 
                         theme.COLORS.danger
                }
              ]}>
                {patient.health_score}%
              </Text>
            </View>
          </View>
        </View>
        
        {/* Conditions */}
        {patient.conditions && patient.conditions.length > 0 && (
          <View style={styles.conditionsContainer}>
            <Text style={styles.conditionsLabel}>Conditions:</Text>
            <View style={styles.conditionsList}>
              {patient.conditions.slice(0, 2).map((condition, idx) => (
                <View key={idx} style={styles.conditionTag}>
                  <Text style={styles.conditionText}>{condition}</Text>
                </View>
              ))}
              {patient.conditions.length > 2 && (
                <Text style={styles.moreConditions}>+{patient.conditions.length - 2} more</Text>
              )}
            </View>
          </View>
        )}
        
        {/* Last Checkup */}
        {patient.last_checkup && (
          <View style={styles.lastCheckupContainer}>
            <Ionicons name="calendar-outline" size={14} color={theme.COLORS.textTertiary} />
            <Text style={styles.lastCheckupText}>
              Last checkup: {new Date(patient.last_checkup).toLocaleDateString('en-US', { 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
              })}
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// Main Dashboard Component
export default function ProfessionalCaregiverDashboard() {
  const router = useRouter();
  const { user, refreshUserData } = useAuth();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  
  const [dashboardData, setDashboardData] = useState<CaregiverDashboardData | null>(null);
  const [patients, setPatients] = useState<PatientCardData[]>([]);
  const [stats, setStats] = useState({
    totalPatients: 0,
    criticalPatients: 0,
    pendingTasks: 0,
    todaysAppointments: 0,
    avgHealthScore: 0
  });

  const [quickActions] = useState<QuickAction[]>([
    { id: 1, title: 'Patients', icon: 'people', color: theme.COLORS.primary, screen: 'patients' },
    { id: 2, title: 'Schedule', icon: 'calendar', color: theme.COLORS.info, screen: 'schedule' },
    { id: 3, title: 'Tasks', icon: 'list', color: theme.COLORS.warning, screen: 'tasks' },
    { id: 4, title: 'Medications', icon: 'medical', color: theme.COLORS.danger, screen: 'medications' },
    { id: 5, title: 'Analytics', icon: 'analytics', color: theme.COLORS.medicalTeal, screen: 'analytics' },
    { id: 6, title: 'Messages', icon: 'chatbubbles', color: theme.COLORS.stable, screen: 'messaging' },
    { id: 7, title: 'Vitals', icon: 'pulse', color: theme.COLORS.success, screen: 'vital-monitoring' },
    { id: 8, title: 'Reports', icon: 'document-text', color: theme.COLORS.medicalPurple, screen: 'reports' },
    { id: 9, title: 'Care Plan', icon: 'clipboard', color: theme.COLORS.medicalCyan, screen: 'care-plan' },
    { id: 10, title: 'Care Team', icon: 'people-circle', color: theme.COLORS.info, screen: 'care-team' },
    { id: 11, title: 'Documents', icon: 'folder', color: theme.COLORS.warning, screen: 'document-library' },
    { id: 12, title: 'Alerts', icon: 'notifications', color: theme.COLORS.danger, screen: 'alerts' },
    { id: 13, title: 'Verify', icon: 'shield-checkmark', color: theme.COLORS.success, screen: 'verify' },
  ]);

  // Load data on mount
  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [dashboard, patientsData] = await Promise.all([
        api.getCaregiverDashboard(),
        api.getAssignedPatients()
      ]);

      if (dashboard) {
        setDashboardData(dashboard);
        setStats({
          totalPatients: dashboard.stats?.total_patients || 0,
          criticalPatients: dashboard.stats?.critical_patients || 0,
          pendingTasks: dashboard.stats?.pending_tasks || 0,
          todaysAppointments: dashboard.stats?.todays_appointments || 0,
          avgHealthScore: dashboard.stats?.avg_health_score || 0
        });
      }

      if (patientsData && Array.isArray(patientsData)) {
        const mappedPatients: PatientCardData[] = patientsData.map((p: AssignedPatient) => ({
          id: p.id.toString(),
          name: p.patient_name || 'Patient',
          patient_id: p.patient_id || 'N/A',
          status: p.status || 'pending',
          health_score: p.health_score || 0,
          image: `https://ui-avatars.com/api/?name=${p.patient_name || 'Patient'}&background=${theme.COLORS.primary.replace('#', '')}&color=fff&size=128`,
          conditions: p.conditions || [],
          last_checkup: p.last_checkup,
          age: p.age,
          gender: p.gender
        }));
        setPatients(mappedPatients);
      }

      await refreshUserData();
    } catch (error: any) {
      console.error('Dashboard fetch error:', error);
      
      // Handle authentication errors
      if (error.status === 401 || error.message?.includes('session has expired')) {
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please log in again.',
          [
            {
              text: 'OK',
              onPress: () => {
                // Navigate to login
                router.replace('/(auth)/login');
              }
            }
          ]
        );
        return;
      }
      
      // Handle other errors
      if (!patients.length) {
        const errorMsg = error.message || 'Unable to load dashboard data. Please check your connection.';
        Alert.alert('Connection Error', errorMsg);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchDashboardData();
  }, []);

  const handleQuickAction = (screen: string) => {
    router.push(`/(caregiver)/${screen}` as any);
  };

  const handlePatientPress = (patient: PatientCardData) => {
    router.push({
      pathname: '/(caregiver)/patient-detail',
      params: { 
        id: patient.id, 
        name: patient.name,
        patient_id: patient.patient_id
      }
    });
  };

  const handleAddPatient = () => {
    router.push('/(caregiver)/patients' as any);
  };

  const filteredPatients = patients.filter(patient => {
    if (activeFilter === 'all') return true;
    if (activeFilter === 'critical') return patient.status.toLowerCase() === 'critical';
    if (activeFilter === 'stable') return patient.status.toLowerCase() === 'stable';
    if (activeFilter === 'pending') return patient.status.toLowerCase() === 'pending';
    return true;
  });

  // Loading state
  if (loading && patients.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.COLORS.primary} />
        <Text style={styles.loadingText}>Loading Care Dashboard...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={theme.COLORS.background} />
      
      {/* Professional Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View>
            <Text style={styles.caregiverName}>{user?.full_name || 'Caregiver'}</Text>
            <Text style={styles.caregiverId}>
              {user?.caregiver_id ? `ID: ${user.caregiver_id}` : 'Professional Caregiver'}
            </Text>
          </View>
        </View>
        
        <View style={styles.headerRight}>
          <TouchableOpacity 
            style={styles.headerIconButton}
            onPress={() => router.push('/(caregiver)/alerts')}
          >
            <Ionicons name="notifications-outline" size={24} color={theme.COLORS.textPrimary} />
            {stats.criticalPatients > 0 && (
              <View style={styles.alertBadge}>
                <Text style={styles.alertCount}>{stats.criticalPatients}</Text>
              </View>
            )}
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.profileButton}
            onPress={() => router.push('/(caregiver)/caregiver-profile')}
          >
            {user?.profile_image ? (
              <Image source={{ uri: user.profile_image }} style={styles.profileImage} />
            ) : (
              <View style={styles.profileInitials}>
                <Text style={styles.profileInitialsText}>
                  {user?.full_name?.charAt(0) || user?.username?.charAt(0) || 'C'}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[theme.COLORS.primary]}
            tintColor={theme.COLORS.primary}
          />
        }
        style={styles.scrollView}
      >
        {/* Stats Overview */}
        <View style={styles.statsSection}>
          <Text style={styles.sectionTitle}>Overview</Text>
          <View style={styles.statsGrid}>
            <StatCard 
              title="Total Patients" 
              value={stats.totalPatients} 
              icon="people" 
              color={theme.COLORS.primary} 
              index={0} 
            />
            <StatCard 
              title="Critical" 
              value={stats.criticalPatients} 
              icon="warning" 
              color={theme.COLORS.danger} 
              index={1} 
            />
            <StatCard 
              title="Pending Tasks" 
              value={stats.pendingTasks} 
              icon="list" 
              color={theme.COLORS.warning} 
              index={2} 
            />
            <StatCard 
              title="Today's Appointments" 
              value={stats.todaysAppointments} 
              icon="calendar" 
              color={theme.COLORS.info} 
              index={3} 
            />
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActionsSection}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActionsGrid}>
            {quickActions.map((action, index) => (
              <QuickActionButton 
                key={action.id}
                action={action}
                index={index}
                onPress={handleQuickAction}
              />
            ))}
          </View>
        </View>

        {/* Patients Section */}
        <View style={styles.patientsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>My Patients</Text>
            <TouchableOpacity onPress={() => router.push('/(caregiver)/patients')}>
              <Text style={styles.seeAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {/* Filter Chips */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.filterContainer}
            contentContainerStyle={styles.filterContent}
          >
            {['all', 'critical', 'stable', 'pending'].map((filter) => (
              <TouchableOpacity
                key={filter}
                style={[
                  styles.filterChip,
                  activeFilter === filter && styles.filterChipActive
                ]}
                onPress={() => setActiveFilter(filter)}
              >
                <Text style={[
                  styles.filterText,
                  activeFilter === filter && styles.filterTextActive
                ]}>
                  {filter.charAt(0).toUpperCase() + filter.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          
          {/* Add Patient Card */}
          <TouchableOpacity 
            style={styles.addPatientCard}
            onPress={handleAddPatient}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={GRADIENTS.primary}
              style={styles.addPatientGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <View style={styles.addPatientContent}>
                <View style={styles.addIconContainer}>
                  <Ionicons name="person-add" size={24} color={theme.COLORS.textOnPrimary} />
                </View>
                <View style={styles.addTextContainer}>
                  <Text style={styles.addPatientTitle}>Add New Patient</Text>
                  <Text style={styles.addPatientSubtitle}>Connect with patient using ID</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.COLORS.textOnPrimary} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
          
          {/* Patients List */}
          {filteredPatients.length > 0 ? (
            <FlatList
              data={filteredPatients.slice(0, 4)}
              renderItem={({ item, index }) => (
                <PatientCard 
                  patient={item}
                  index={index}
                  onPress={handlePatientPress}
                />
              )}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.patientsList}
            />
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="group" size={64} color={theme.COLORS.textTertiary} />
              <Text style={styles.emptyTitle}>No Patients Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? 'Try adjusting your search' : 'Add your first patient to get started'}
              </Text>
              <TouchableOpacity 
                style={styles.emptyActionButton}
                onPress={handleAddPatient}
              >
                <Text style={styles.emptyActionText}>Add Patient</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Recent Alerts */}
        {dashboardData?.recent_alerts && dashboardData.recent_alerts.length > 0 && (
          <View style={styles.alertsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Alerts</Text>
              <TouchableOpacity onPress={() => router.push('/(caregiver)/alerts')}>
                <Text style={styles.seeAllText}>View All</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.alertsList}>
              {dashboardData.recent_alerts.slice(0, 3).map((alert, index) => (
                <Animated.View
                  key={alert.id}
                  entering={FadeInDown.delay(300 + (index * 50))}
                  style={styles.alertItem}
                >
                  <View style={[
                    styles.alertIconContainer,
                    { backgroundColor: alert.type === 'critical' ? theme.COLORS.danger + '15' : theme.COLORS.warning + '15' }
                  ]}>
                    <Ionicons 
                      name={alert.type === 'critical' ? 'warning' : 'notifications'} 
                      size={18} 
                      color={alert.type === 'critical' ? theme.COLORS.danger : theme.COLORS.warning} 
                    />
                  </View>
                  <View style={styles.alertContent}>
                    <Text style={styles.alertTitle} numberOfLines={1}>{alert.title}</Text>
                    <Text style={styles.alertDescription} numberOfLines={2}>
                      {alert.description}
                    </Text>
                    <Text style={styles.alertTime}>
                      {new Date(alert.created_at).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </Text>
                  </View>
                  {!alert.is_read && (
                    <View style={styles.unreadDot} />
                  )}
                </Animated.View>
              ))}
            </View>
          </View>
        )}

        {/* Bottom Spacer */}
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.COLORS.background,
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
    fontSize: 16,
  },
  
  // Header Styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight || 0) + 20,
    paddingBottom: theme.SPACING.md,
    backgroundColor: theme.COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.COLORS.separator,
  },
  headerLeft: {
    flex: 1,
  },
  caregiverName: {
    ...theme.TYPOGRAPHY.h2,
    color: theme.COLORS.textPrimary,
    marginBottom: 4,
  },
  caregiverId: {
    ...theme.TYPOGRAPHY.caption,
    color: theme.COLORS.textTertiary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.SPACING.md,
  },
  headerIconButton: {
    padding: theme.SPACING.xs,
    position: 'relative',
  },
  alertBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: theme.COLORS.danger,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.COLORS.background,
  },
  alertCount: {
    color: theme.COLORS.textOnPrimary,
    fontSize: 10,
    fontWeight: '700',
  },
  profileButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  profileInitials: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitialsText: {
    color: theme.COLORS.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  
  // Scroll View
  scrollView: {
    flex: 1,
  },
  
  // Stats Section
  statsSection: {
    paddingHorizontal: theme.SPACING.lg,
    paddingTop: theme.SPACING.lg,
  },
  sectionTitle: {
    ...theme.TYPOGRAPHY.h3,
    color: theme.COLORS.textPrimary,
    marginBottom: theme.SPACING.md,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.SPACING.md,
  },
  statCard: {
    flex: 1,
    minWidth: (width - theme.SPACING.lg * 2 - theme.SPACING.md) / 2,
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.md,
    ...theme.SHADOWS.medium,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.LAYOUT.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.SPACING.sm,
  },
  statTextContainer: {
    alignItems: 'flex-start',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.COLORS.textPrimary,
    marginBottom: 2,
  },
  statLabel: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textSecondary,
    fontWeight: '500',
  },
  
  // Quick Actions
  quickActionsSection: {
    paddingHorizontal: theme.SPACING.lg,
    paddingTop: theme.SPACING.xl,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.SPACING.md,
    marginTop: theme.SPACING.sm,
  },
  quickActionButton: {
    width: (width - theme.SPACING.lg * 2 - theme.SPACING.md * 3) / 4,
    alignItems: 'center',
    marginBottom: theme.SPACING.sm,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.SPACING.sm,
    ...theme.SHADOWS.small,
  },
  quickActionTitle: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },
  
  // Patients Section
  patientsSection: {
    paddingHorizontal: theme.SPACING.lg,
    paddingTop: theme.SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.SPACING.md,
  },
  seeAllText: {
    ...theme.TYPOGRAPHY.captionMedium,
    color: theme.COLORS.primary,
    fontWeight: '600',
  },
  filterContainer: {
    marginBottom: theme.SPACING.md,
  },
  filterContent: {
    paddingRight: theme.SPACING.lg,
  },
  filterChip: {
    paddingHorizontal: theme.SPACING.md,
    paddingVertical: theme.SPACING.sm,
    borderRadius: 20,
    backgroundColor: theme.COLORS.card,
    marginRight: theme.SPACING.sm,
    borderWidth: 1,
    borderColor: theme.COLORS.border,
    ...theme.SHADOWS.small,
  },
  filterChipActive: {
    backgroundColor: theme.COLORS.primary,
    borderColor: theme.COLORS.primary,
  },
  filterText: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textSecondary,
    fontWeight: '500',
  },
  filterTextActive: {
    color: theme.COLORS.textOnPrimary,
  },
  
  // Add Patient Card
  addPatientCard: {
    marginBottom: theme.SPACING.lg,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    overflow: 'hidden',
    ...theme.SHADOWS.medium,
  },
  addPatientGradient: {
    padding: theme.SPACING.lg,
  },
  addPatientContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.SPACING.md,
  },
  addTextContainer: {
    flex: 1,
  },
  addPatientTitle: {
    ...theme.TYPOGRAPHY.bodyMedium,
    color: theme.COLORS.textOnPrimary,
    fontWeight: '600',
    marginBottom: 2,
  },
  addPatientSubtitle: {
    ...theme.TYPOGRAPHY.caption,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  
  // Patients List
  patientsList: {
    gap: theme.SPACING.md,
  },
  patientCard: {
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    ...theme.SHADOWS.medium,
    overflow: 'hidden',
  },
  patientCardInner: {
    padding: theme.SPACING.lg,
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.SPACING.md,
  },
  patientAvatarContainer: {
    position: 'relative',
    marginRight: theme.SPACING.md,
  },
  patientAvatar: {
    width: 56,
    height: 56,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    backgroundColor: theme.COLORS.background,
  },
  patientStatusIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.COLORS.card,
  },
  patientInfo: {
    flex: 1,
  },
  patientNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  patientName: {
    ...theme.TYPOGRAPHY.bodyMedium,
    color: theme.COLORS.textPrimary,
    fontWeight: '600',
    flex: 1,
    marginRight: theme.SPACING.sm,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.SPACING.sm,
    paddingVertical: 4,
    borderRadius: theme.LAYOUT.borderRadius.sm,
  },
  statusIcon: {
    marginRight: 4,
  },
  statusText: {
    ...theme.TYPOGRAPHY.small,
    fontWeight: '700',
  },
  patientId: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textSecondary,
    marginBottom: 2,
  },
  patientDetails: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textTertiary,
  },
  
  // Health Score
  healthScoreContainer: {
    marginBottom: theme.SPACING.md,
  },
  healthScoreLabel: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textSecondary,
    marginBottom: theme.SPACING.xs,
    fontWeight: '500',
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  scoreBarContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: theme.SPACING.sm,
  },
  scoreBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: theme.COLORS.background,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: theme.SPACING.sm,
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  scoreValue: {
    ...theme.TYPOGRAPHY.captionMedium,
    fontWeight: '700',
    minWidth: 40,
  },
  
  // Conditions
  conditionsContainer: {
    marginBottom: theme.SPACING.md,
  },
  conditionsLabel: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textSecondary,
    marginBottom: theme.SPACING.xs,
    fontWeight: '500',
  },
  conditionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.SPACING.xs,
  },
  conditionTag: {
    backgroundColor: theme.COLORS.background,
    paddingHorizontal: theme.SPACING.sm,
    paddingVertical: 4,
    borderRadius: theme.LAYOUT.borderRadius.sm,
  },
  conditionText: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textSecondary,
  },
  moreConditions: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.primary,
    fontWeight: '500',
    alignSelf: 'center',
  },
  
  // Last Checkup
  lastCheckupContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.SPACING.xs,
  },
  lastCheckupText: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textTertiary,
  },
  
  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.SPACING.xxl,
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    marginTop: theme.SPACING.sm,
  },
  emptyTitle: {
    ...theme.TYPOGRAPHY.h3,
    color: theme.COLORS.textPrimary,
    marginTop: theme.SPACING.md,
    marginBottom: theme.SPACING.xs,
  },
  emptySubtitle: {
    ...theme.TYPOGRAPHY.caption,
    color: theme.COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: theme.SPACING.lg,
    paddingHorizontal: theme.SPACING.lg,
  },
  emptyActionButton: {
    backgroundColor: theme.COLORS.primary,
    paddingHorizontal: theme.SPACING.xl,
    paddingVertical: theme.SPACING.md,
    borderRadius: theme.LAYOUT.borderRadius.md,
  },
  emptyActionText: {
    ...theme.TYPOGRAPHY.button,
    color: theme.COLORS.textOnPrimary,
  },
  
  // Alerts Section
  alertsSection: {
    paddingHorizontal: theme.SPACING.lg,
    paddingTop: theme.SPACING.xl,
  },
  alertsList: {
    gap: theme.SPACING.md,
  },
  alertItem: {
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.md,
    flexDirection: 'row',
    ...theme.SHADOWS.small,
    position: 'relative',
  },
  alertIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.SPACING.md,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    ...theme.TYPOGRAPHY.bodyMedium,
    color: theme.COLORS.textPrimary,
    fontWeight: '600',
    marginBottom: 4,
  },
  alertDescription: {
    ...theme.TYPOGRAPHY.caption,
    color: theme.COLORS.textSecondary,
    marginBottom: 4,
    lineHeight: 18,
  },
  alertTime: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textTertiary,
  },
  unreadDot: {
    position: 'absolute',
    top: theme.SPACING.md,
    right: theme.SPACING.md,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.COLORS.primary,
  },
});