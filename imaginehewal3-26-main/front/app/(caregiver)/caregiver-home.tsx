// front/app/(caregiver)/caregiver-home.tsx - FIXED VERSION
import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  SafeAreaView,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Platform,
  StatusBar,
  Image,
  FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { FadeInDown, SlideInRight } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import api, { CaregiverDashboardData, AssignedPatient } from '../../services/api';
import { theme } from '../../constants/theme';

const { width } = Dimensions.get('window');

// Professional Color Extensions
const PREMIUM_COLORS = {
  ...theme.COLORS,
  glassWhite: 'rgba(255, 255, 255, 0.95)',
  glassDark: 'rgba(30, 41, 59, 0.95)',
  gradientPrimary: ['#667eea', '#764ba2'] as const,
  gradientSecondary: ['#f093fb', '#f5576c'] as const,
};

// Local types to match your API
interface PatientCardData {
  id: string;
  name: string;
  patient_id: string;
  status: string;
  health_score: number;
  image: string;
  conditions: string[];
  last_checkup?: string;
  email?: string;
  isConfirmed?: boolean;
  isPinned?: boolean;
  lastActive?: string;
}

interface QuickAction {
  id: number;
  title: string;
  icon: string;
  color: string;
  screen: string;
}

// Professional Stat Card Component
const StatCard: React.FC<{
  title: string;
  value: number;
  icon: string;
  color: string;
  index: number;
}> = ({ title, value, icon, color, index }) => (
  <Animated.View 
    entering={FadeInDown.delay(index * 100)} 
    style={[styles.statCard, { borderLeftColor: color }]}
  >
    <View style={[styles.statIconContainer, { backgroundColor: color + '20' }]}>
      <Ionicons name={icon as any} size={24} color={color} />
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
  <Animated.View 
    entering={FadeInDown.delay(100 + (index * 50))}
  >
    <TouchableOpacity 
      style={styles.quickActionButton}
      onPress={() => onPress(action.screen)}
    >
      <LinearGradient
        colors={[action.color, action.color + 'DD']}
        style={styles.quickActionIcon}
      >
        <Ionicons name={action.icon as any} size={24} color={PREMIUM_COLORS.glassWhite} />
      </LinearGradient>
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
      case 'critical': return PREMIUM_COLORS.danger;
      case 'stable': return PREMIUM_COLORS.success;
      case 'active': return PREMIUM_COLORS.success;
      case 'pending': return PREMIUM_COLORS.warning;
      default: return PREMIUM_COLORS.textTertiary;
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
              styles.patientStatusDot, 
              { backgroundColor: getStatusColor(patient.status) }
            ]} />
          </View>
          <View style={styles.patientInfo}>
            <Text style={styles.patientName} numberOfLines={1}>
              {patient.name}
            </Text>
            <Text style={styles.patientId}>ID: {patient.patient_id}</Text>
          </View>
          <View style={[
            styles.statusBadge, 
            { backgroundColor: getStatusColor(patient.status) + '20' }
          ]}>
            <Text style={[
              styles.statusText, 
              { color: getStatusColor(patient.status) }
            ]}>
              {patient.status.toUpperCase()}
            </Text>
          </View>
        </View>
        
        {patient.health_score > 0 && (
          <View style={styles.healthScoreContainer}>
            <Text style={styles.healthScoreLabel}>Health Score</Text>
            <View style={styles.scoreBarContainer}>
              <View style={styles.scoreBarBackground}>
                <View 
                  style={[
                    styles.scoreBarFill,
                    { 
                      width: `${patient.health_score}%`,
                      backgroundColor: patient.health_score > 70 ? PREMIUM_COLORS.success : 
                                     patient.health_score > 40 ? PREMIUM_COLORS.warning : 
                                     PREMIUM_COLORS.danger
                    }
                  ]}
                />
              </View>
              <Text style={[
                styles.scoreValue,
                { 
                  color: patient.health_score > 70 ? PREMIUM_COLORS.success : 
                         patient.health_score > 40 ? PREMIUM_COLORS.warning : 
                         PREMIUM_COLORS.danger
                }
              ]}>
                {patient.health_score}/100
              </Text>
            </View>
          </View>
        )}
        
        {patient.conditions && patient.conditions.length > 0 && (
          <View style={styles.conditionsContainer}>
            {patient.conditions.slice(0, 2).map((condition, idx) => (
              <View key={idx} style={styles.conditionTag}>
                <Text style={styles.conditionText}>{condition}</Text>
              </View>
            ))}
            {patient.conditions.length > 2 && (
              <Text style={styles.moreConditions}>+{patient.conditions.length - 2}</Text>
            )}
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
};

// Main Dashboard Component
export default function PremiumCaregiverDashboard() {
  const router = useRouter();
  const { user, refreshUserData } = useAuth();
  
  const [greeting, setGreeting] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('all');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const [dashboardData, setDashboardData] = useState<CaregiverDashboardData | null>(null);
  const [patients, setPatients] = useState<PatientCardData[]>([]);
  const [stats, setStats] = useState({
    totalPatients: 0,
    activePatients: 0,
    criticalAlerts: 0,
    pendingTasks: 0,
    todayAppointments: 0,
    healthScoreAvg: 0
  });

  const [quickActions] = useState<QuickAction[]>([
    { id: 1, title: 'Analytics', icon: 'analytics', color: PREMIUM_COLORS.info, screen: 'analytics' },
    { id: 2, title: 'Schedule', icon: 'calendar', color: PREMIUM_COLORS.success, screen: 'schedule' },
    { id: 3, title: 'Tasks', icon: 'list', color: PREMIUM_COLORS.warning, screen: 'tasks' },
    { id: 4, title: 'Reports', icon: 'document-text', color: PREMIUM_COLORS.primary, screen: 'reports' },
    { id: 5, title: 'Medications', icon: 'medical', color: PREMIUM_COLORS.danger, screen: 'medications' },
    { id: 6, title: 'Messages', icon: 'chatbubbles', color: PREMIUM_COLORS.info, screen: 'messaging' },
  ]);

  useEffect(() => {
    updateGreeting();
    fetchDashboardData();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(interval);
  }, []);

  const updateGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('🌤 Good Morning');
    else if (hour < 17) setGreeting('☀️ Good Afternoon');
    else if (hour < 21) setGreeting('🌙 Good Evening');
    else setGreeting('🌙 Good Night');
  };

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
          activePatients: dashboard.stats?.active_patients || 0,
          criticalAlerts: dashboard.stats?.critical_patients || 0,
          pendingTasks: dashboard.stats?.pending_tasks || 0,
          todayAppointments: dashboard.stats?.todays_appointments || 0,
          healthScoreAvg: dashboard.stats?.avg_health_score || 0
        });
      }

      if (patientsData) {
        const mappedPatients: PatientCardData[] = (patientsData as AssignedPatient[]).map((p) => ({
          id: p.id.toString(),
          name: p.patient_name || 'Unknown Patient',
          patient_id: p.patient_id || 'N/A',
          status: p.status || 'pending',
          health_score: p.health_score || 0,
          image: `https://ui-avatars.com/api/?name=${p.patient_name || 'Patient'}&background=${theme.COLORS.primary.replace('#', '')}&color=fff&size=128`,
          conditions: p.conditions || [],
          last_checkup: p.last_checkup,
          email: p.email,
          isConfirmed: p.status?.toLowerCase() !== 'pending',
          isPinned: false,
          lastActive: p.last_checkup ? new Date(p.last_checkup).toLocaleDateString() : 'Never'
        }));
        setPatients(mappedPatients);
      }

      await refreshUserData();
    } catch (error) {
      console.error('Dashboard fetch error:', error);
      Alert.alert('Connection Error', 'Unable to sync with server');
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
    // Use proper type-safe navigation
    const routes = {
      analytics: '/(caregiver)/analytics',
      schedule: '/(caregiver)/schedule',
      tasks: '/(caregiver)/tasks',
      reports: '/(caregiver)/reports',
      medications: '/(caregiver)/medications',
      messaging: '/(caregiver)/messaging',
    } as const;
    
    const route = routes[screen as keyof typeof routes];
    if (route) {
      router.push(route);
    }
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
    router.push({ pathname: '/(caregiver)/patients', params: { action: 'add' } });
  };

  const filteredPatients = patients.filter(patient => {
    if (activeFilter === 'all') return true;
    return patient.status.toLowerCase() === activeFilter;
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={PREMIUM_COLORS.gradientPrimary}
          style={styles.loadingGradient}
        >
          <ActivityIndicator size="large" color={PREMIUM_COLORS.glassWhite} />
          <Text style={styles.loadingText}>Loading...</Text>
        </LinearGradient>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={PREMIUM_COLORS.gradientPrimary[0]} />
      
      {/* Premium Header */}
      <LinearGradient
        colors={PREMIUM_COLORS.gradientPrimary}
        style={styles.headerGradient}
      >
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <TouchableOpacity 
              onPress={() => router.push('/(caregiver)/caregiver-profile')}
              style={styles.profileButton}
            >
              <View style={styles.profileImageContainer}>
                {user?.profile_image ? (
                  <Image source={{ uri: user.profile_image }} style={styles.profileImage} />
                ) : (
                  <View style={styles.profileInitials}>
                    <Text style={styles.profileInitialsText}>
                      {user?.full_name?.charAt(0) || user?.username?.charAt(0) || 'C'}
                    </Text>
                  </View>
                )}
                <View style={styles.onlineIndicator} />
              </View>
            </TouchableOpacity>
            
            <View style={styles.greetingContainer}>
              <Text style={styles.greetingText}>{greeting}</Text>
              <Text style={styles.userName}>{user?.full_name || 'Caregiver'}</Text>
              {user?.caregiver_id && (
                <Text style={styles.userId}>ID: {user.caregiver_id}</Text>
              )}
            </View>
            
            <View style={styles.headerActions}>
              <TouchableOpacity 
                style={styles.headerActionButton}
                onPress={() => setShowNotifications(true)}
              >
                <Ionicons name="notifications" size={24} color={PREMIUM_COLORS.glassWhite} />
                {stats.criticalAlerts > 0 && (
                  <View style={styles.notificationBadge}>
                    <Text style={styles.notificationCount}>{stats.criticalAlerts}</Text>
                  </View>
                )}
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.headerActionButton}
                onPress={() => setShowSettings(true)}
              >
                <Ionicons name="settings" size={24} color={PREMIUM_COLORS.glassWhite} />
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={PREMIUM_COLORS.glassWhite} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search patients, tasks, or reports..."
              placeholderTextColor="rgba(255, 255, 255, 0.7)"
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <Ionicons name="close-circle" size={20} color="rgba(255, 255, 255, 0.7)" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </LinearGradient>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh}
            colors={[PREMIUM_COLORS.primary]}
            tintColor={PREMIUM_COLORS.primary}
          />
        }
        style={styles.scrollView}
      >
        {/* Stats Overview */}
        <View style={styles.statsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Overview</Text>
            <TouchableOpacity onPress={() => router.push('/(caregiver)/analytics')}>
              <Text style={styles.seeAllText}>Details →</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.statsScroll}
          >
            <StatCard title="Total Patients" value={stats.totalPatients} icon="people" color={PREMIUM_COLORS.info} index={0} />
            <StatCard title="Active Now" value={stats.activePatients} icon="pulse" color={PREMIUM_COLORS.success} index={1} />
            <StatCard title="Critical Alerts" value={stats.criticalAlerts} icon="warning" color={PREMIUM_COLORS.danger} index={2} />
            <StatCard title="Pending Tasks" value={stats.pendingTasks} icon="list" color={PREMIUM_COLORS.warning} index={3} />
            <StatCard title="Today Appointments" value={stats.todayAppointments} icon="calendar" color={PREMIUM_COLORS.primary} index={4} />
          </ScrollView>
        </View>

        {/* Quick Actions Grid */}
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
            <Text style={styles.sectionTitle}>Recent Patients</Text>
            <TouchableOpacity onPress={() => router.push('/(caregiver)/patients')}>
              <Text style={styles.seeAllText}>View All →</Text>
            </TouchableOpacity>
          </View>
          
          {/* Filter Chips */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
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
          >
            <LinearGradient
              colors={PREMIUM_COLORS.gradientSecondary}
              style={styles.addPatientGradient}
            >
              <View style={styles.addPatientContent}>
                <View style={styles.addIconContainer}>
                  <Ionicons name="person-add" size={28} color={PREMIUM_COLORS.glassWhite} />
                </View>
                <View style={styles.addTextContainer}>
                  <Text style={styles.addPatientTitle}>Connect New Patient</Text>
                  <Text style={styles.addPatientSubtitle}>Add patient by ID or invitation</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color={PREMIUM_COLORS.glassWhite} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
          
          {/* Patients List */}
          {filteredPatients.length > 0 ? (
            <FlatList
              data={filteredPatients.slice(0, 5)}
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
              <Ionicons name="people-outline" size={64} color={PREMIUM_COLORS.textTertiary} />
              <Text style={styles.emptyTitle}>No Patients Found</Text>
              <Text style={styles.emptySubtitle}>
                {searchQuery ? 'Try a different search' : 'Add your first patient to get started'}
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

        {/* Recent Activity */}
        {dashboardData?.recent_alerts && dashboardData.recent_alerts.length > 0 && (
          <View style={styles.activitySection}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <View style={styles.activityList}>
              {dashboardData.recent_alerts.slice(0, 3).map((alert, index) => (
                <Animated.View
                  key={alert.id}
                  entering={FadeInDown.delay(300 + (index * 50))}
                  style={styles.activityItem}
                >
                  <View style={styles.activityIconContainer}>
                    <Ionicons 
                      name={alert.type === 'critical' ? 'warning' : 'information-circle'} 
                      size={20} 
                      color={alert.type === 'critical' ? PREMIUM_COLORS.danger : PREMIUM_COLORS.info} 
                    />
                  </View>
                  <View style={styles.activityContent}>
                    <Text style={styles.activityTitle}>{alert.title}</Text>
                    <Text style={styles.activityDescription}>{alert.description}</Text>
                    <Text style={styles.activityTime}>
                      {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Text>
                  </View>
                </Animated.View>
              ))}
            </View>
          </View>
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Notifications Modal */}
      <Modal
        visible={showNotifications}
        animationType="slide"
        transparent
        onRequestClose={() => setShowNotifications(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={80} tint="dark" style={styles.modalBlur}>
            <Animated.View entering={SlideInRight} style={styles.notificationsModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Notifications</Text>
                <TouchableOpacity onPress={() => setShowNotifications(false)}>
                  <Ionicons name="close" size={24} color={PREMIUM_COLORS.textPrimary} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalContent}>
                <Text style={styles.modalEmptyText}>No new notifications</Text>
              </View>
            </Animated.View>
          </BlurView>
        </View>
      </Modal>

      {/* Settings Modal */}
      <Modal
        visible={showSettings}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSettings(false)}
      >
        <View style={styles.modalOverlay}>
          <BlurView intensity={80} tint="dark" style={styles.modalBlur}>
            <Animated.View entering={SlideInRight} style={styles.settingsModal}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Settings</Text>
                <TouchableOpacity onPress={() => setShowSettings(false)}>
                  <Ionicons name="close" size={24} color={PREMIUM_COLORS.textPrimary} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalContent}>
                <Text style={styles.modalEmptyText}>Settings content here</Text>
              </View>
            </Animated.View>
          </BlurView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: PREMIUM_COLORS.background,
  },
  loadingContainer: {
    flex: 1,
  },
  loadingGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: PREMIUM_COLORS.glassWhite,
    fontSize: 16,
    fontWeight: '600',
    marginTop: 16,
  },
  headerGradient: {
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    ...theme.SHADOWS.large,
  },
  header: {
    paddingHorizontal: theme.SPACING.lg,
    paddingBottom: theme.SPACING.lg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.SPACING.lg,
  },
  profileButton: {
    marginRight: theme.SPACING.md,
  },
  profileImageContainer: {
    position: 'relative',
  },
  profileImage: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  profileInitials: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PREMIUM_COLORS.glassWhite,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  profileInitialsText: {
    fontSize: 20,
    fontWeight: '700',
    color: PREMIUM_COLORS.primary,
  },
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: PREMIUM_COLORS.success,
    borderWidth: 2,
    borderColor: PREMIUM_COLORS.glassWhite,
  },
  greetingContainer: {
    flex: 1,
  },
  greetingText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: PREMIUM_COLORS.glassWhite,
    marginTop: 2,
  },
  userId: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: theme.SPACING.sm,
  },
  headerActionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: PREMIUM_COLORS.danger,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: PREMIUM_COLORS.glassWhite,
  },
  notificationCount: {
    color: PREMIUM_COLORS.glassWhite,
    fontSize: 10,
    fontWeight: '700',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: theme.LAYOUT.borderRadius.lg,
    paddingHorizontal: theme.SPACING.md,
    paddingVertical: theme.SPACING.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: theme.SPACING.sm,
    fontSize: 16,
    color: PREMIUM_COLORS.glassWhite,
    paddingVertical: theme.SPACING.sm,
  },
  scrollView: {
    flex: 1,
  },
  statsSection: {
    marginTop: theme.SPACING.lg,
    paddingHorizontal: theme.SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.SPACING.md,
  },
  sectionTitle: {
    ...theme.TYPOGRAPHY.h2,
    color: PREMIUM_COLORS.textPrimary,
  },
  seeAllText: {
    ...theme.TYPOGRAPHY.captionMedium,
    color: PREMIUM_COLORS.primary,
  },
  statsScroll: {
    paddingRight: theme.SPACING.lg,
  },
  statCard: {
    width: 140,
    backgroundColor: PREMIUM_COLORS.glassWhite,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.md,
    marginRight: theme.SPACING.md,
    borderLeftWidth: 4,
    ...theme.SHADOWS.medium,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.SPACING.sm,
  },
  statTextContainer: {
    alignItems: 'flex-start',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    color: PREMIUM_COLORS.textPrimary,
  },
  statLabel: {
    fontSize: 12,
    color: PREMIUM_COLORS.textTertiary,
    marginTop: 4,
    fontWeight: '500',
  },
  quickActionsSection: {
    paddingHorizontal: theme.SPACING.lg,
    marginTop: theme.SPACING.xl,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickActionButton: {
    width: (width - theme.SPACING.lg * 2 - theme.SPACING.md) / 3,
    alignItems: 'center',
    marginBottom: theme.SPACING.lg,
  },
  quickActionIcon: {
    width: 60,
    height: 60,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.SPACING.sm,
    ...theme.SHADOWS.medium,
  },
  quickActionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: PREMIUM_COLORS.textSecondary,
    textAlign: 'center',
  },
  patientsSection: {
    paddingHorizontal: theme.SPACING.lg,
    marginTop: theme.SPACING.lg,
  },
  filterScroll: {
    marginBottom: theme.SPACING.md,
  },
  filterChip: {
    paddingHorizontal: theme.SPACING.lg,
    paddingVertical: theme.SPACING.sm,
    borderRadius: 20,
    backgroundColor: PREMIUM_COLORS.glassWhite,
    marginRight: theme.SPACING.sm,
    borderWidth: 1,
    borderColor: PREMIUM_COLORS.border,
  },
  filterChipActive: {
    backgroundColor: PREMIUM_COLORS.primary,
    borderColor: PREMIUM_COLORS.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: PREMIUM_COLORS.textSecondary,
  },
  filterTextActive: {
    color: PREMIUM_COLORS.glassWhite,
  },
  addPatientCard: {
    marginBottom: theme.SPACING.lg,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    overflow: 'hidden',
    ...theme.SHADOWS.large,
  },
  addPatientGradient: {
    padding: theme.SPACING.lg,
  },
  addPatientContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.SPACING.md,
  },
  addTextContainer: {
    flex: 1,
  },
  addPatientTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: PREMIUM_COLORS.glassWhite,
    marginBottom: 2,
  },
  addPatientSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  patientsList: {
    gap: theme.SPACING.md,
  },
  patientCard: {
    backgroundColor: PREMIUM_COLORS.glassWhite,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    ...theme.SHADOWS.medium,
    overflow: 'hidden',
  },
  patientCardInner: {
    padding: theme.SPACING.md,
  },
  patientHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.SPACING.md,
  },
  patientAvatarContainer: {
    position: 'relative',
    marginRight: theme.SPACING.md,
  },
  patientAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  patientStatusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: PREMIUM_COLORS.glassWhite,
  },
  patientInfo: {
    flex: 1,
  },
  patientName: {
    fontSize: 16,
    fontWeight: '700',
    color: PREMIUM_COLORS.textPrimary,
    marginBottom: 2,
  },
  patientId: {
    fontSize: 12,
    color: PREMIUM_COLORS.textTertiary,
  },
  statusBadge: {
    paddingHorizontal: theme.SPACING.sm,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  healthScoreContainer: {
    marginBottom: theme.SPACING.md,
  },
  healthScoreLabel: {
    fontSize: 12,
    color: PREMIUM_COLORS.textSecondary,
    marginBottom: theme.SPACING.xs,
    fontWeight: '500',
  },
  scoreBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: PREMIUM_COLORS.border,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: theme.SPACING.sm,
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  scoreValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  conditionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.SPACING.xs,
  },
  conditionTag: {
    backgroundColor: PREMIUM_COLORS.background,
    paddingHorizontal: theme.SPACING.sm,
    paddingVertical: 4,
    borderRadius: 6,
  },
  conditionText: {
    fontSize: 11,
    color: PREMIUM_COLORS.textSecondary,
  },
  moreConditions: {
    fontSize: 11,
    color: PREMIUM_COLORS.primary,
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: theme.SPACING.xxl,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: PREMIUM_COLORS.textPrimary,
    marginTop: theme.SPACING.md,
    marginBottom: theme.SPACING.xs,
  },
  emptySubtitle: {
    fontSize: 14,
    color: PREMIUM_COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: theme.SPACING.lg,
  },
  emptyActionButton: {
    backgroundColor: PREMIUM_COLORS.primary,
    paddingHorizontal: theme.SPACING.xl,
    paddingVertical: theme.SPACING.md,
    borderRadius: theme.LAYOUT.borderRadius.md,
  },
  emptyActionText: {
    color: PREMIUM_COLORS.glassWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  activitySection: {
    paddingHorizontal: theme.SPACING.lg,
    marginTop: theme.SPACING.xl,
  },
  activityList: {
    gap: theme.SPACING.md,
  },
  activityItem: {
    backgroundColor: PREMIUM_COLORS.glassWhite,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.md,
    flexDirection: 'row',
    ...theme.SHADOWS.small,
  },
  activityIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: PREMIUM_COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.SPACING.md,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: PREMIUM_COLORS.textPrimary,
    marginBottom: 4,
  },
  activityDescription: {
    fontSize: 14,
    color: PREMIUM_COLORS.textSecondary,
    marginBottom: 4,
  },
  activityTime: {
    fontSize: 12,
    color: PREMIUM_COLORS.textTertiary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalBlur: {
    flex: 1,
  },
  notificationsModal: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: width * 0.85,
    backgroundColor: PREMIUM_COLORS.glassWhite,
    borderTopLeftRadius: 30,
    borderBottomLeftRadius: 30,
    padding: theme.SPACING.lg,
    ...theme.SHADOWS.large,
  },
  settingsModal: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: width * 0.85,
    backgroundColor: PREMIUM_COLORS.glassWhite,
    borderTopLeftRadius: 30,
    borderBottomLeftRadius: 30,
    padding: theme.SPACING.lg,
    ...theme.SHADOWS.large,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.SPACING.lg,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: PREMIUM_COLORS.textPrimary,
  },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.SPACING.lg,
  },
  modalEmptyText: {
    fontSize: 16,
    color: PREMIUM_COLORS.textTertiary,
    textAlign: 'center',
  },
});