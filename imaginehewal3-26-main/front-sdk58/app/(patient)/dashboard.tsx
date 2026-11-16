import { resolveBaseUrl } from '../../services/baseUrl';
import {
  Feather,
  FontAwesome5,
} from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Animated,
  Dimensions,
  Modal,
  Platform,
  StyleSheet,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useNutrition } from '../../contexts/NutritionContext';
import api, {
  DailyTipResponse,
  DashboardData,
  HealthCategory,
  HealthTrend
} from '../../services/api';
import { Image, Ionicons, LinearGradient, MaterialCommunityIcons, RefreshControl, SafeAreaView, ScrollView, StatusBar, Text, TouchableOpacity, View } from '../../components/themed';



const { width, height } = Dimensions.get('window');
const BASE_URL = resolveBaseUrl();

const THEME = {
  primary: '#007AFF',
  primaryLight: 'rgba(0, 122, 255, 0.1)',
  secondary: '#5856D6',
  success: '#34C759',
  successLight: 'rgba(52, 199, 89, 0.1)',
  warning: '#FF9500',
  warningLight: 'rgba(255, 149, 0, 0.1)',
  danger: '#FF3B30',
  dangerLight: 'rgba(255, 59, 48, 0.1)',
  info: '#5AC8FA',
  infoLight: 'rgba(90, 200, 250, 0.1)',
  background: '#F8F9FA',
  card: '#FFFFFF',
  textPrimary: '#000000',
  textSecondary: '#8E8E93',
  textTertiary: '#C7C7CC',
  separator: '#E5E5EA',
  border: '#E9ECEF',
  ringMove: '#FF2D55',
  ringExercise: '#32D74B',
  ringStand: '#5AC8FA',
};

const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

// Skeleton Loader Component
const SkeletonLoader = () => (
  <View style={styles.skeletonContainer}>
    <View style={styles.skeletonHeader}>
      <View style={[styles.skeletonLine, { width: 120, height: 16 }]} />
      <View style={[styles.skeletonLine, { width: 200, height: 34, marginTop: 8 }]} />
    </View>
    
    <View style={styles.skeletonCard}>
      <View style={[styles.skeletonLine, { width: '60%', height: 20 }]} />
      <View style={[styles.skeletonLine, { width: '40%', height: 16, marginTop: 12 }]} />
      <View style={[styles.skeletonLine, { width: '100%', height: 60, marginTop: 16, borderRadius: 30 }]} />
    </View>
    
    <View style={styles.skeletonGrid}>
      {[1, 2, 3, 4].map((item) => (
        <View key={item} style={styles.skeletonGridItem} />
      ))}
    </View>
  </View>
);

// Header Component
const Header = ({ user, unreadCount, onProfilePress, onNotificationPress }: any) => {
  const getProfileImage = () => {
    if (user?.profile_image) {
      if (user.profile_image.startsWith('http')) return { uri: user.profile_image };
      return { uri: `${BASE_URL}${user.profile_image}` };
    }
    return { uri: `https://ui-avatars.com/api/?name=${user?.full_name || 'User'}&background=0D8ABC&color=fff&size=256` };
  };

  const profileImg = getProfileImage();
  const greeting = getGreeting();

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }

  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.greeting}>{greeting}</Text>
        <Text style={styles.userName}>{user?.full_name || user?.username || 'User'}</Text>
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity
          style={styles.notificationButton}
          onPress={onNotificationPress}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={24} color={THEME.textPrimary} />
          {unreadCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationCount}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity onPress={onProfilePress} activeOpacity={0.7}>
          <Image source={profileImg} style={styles.profileImage} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// HealthScoreCard Component
const HealthScoreCard = ({ score, message, onPress }: any) => {
  const getScoreColor = () => {
    if (score >= 80) return THEME.success;
    if (score >= 50) return THEME.warning;
    return THEME.danger;
  };

  const scoreColor = getScoreColor();
  const percentage = score;

  return (
    <TouchableOpacity style={styles.healthScoreCard} onPress={onPress} activeOpacity={0.9}>
      <LinearGradient
        colors={['#FFFFFF', '#F8F9FA']}
        style={styles.healthScoreGradient}
      >
        <View style={styles.healthScoreContent}>
          <View style={styles.healthScoreLeft}>
            <Text style={styles.healthScoreLabel}>Health Score</Text>
            <Text style={[styles.healthScoreValue, { color: scoreColor }]}>
              {score}
              <Text style={styles.healthScorePercent}>/100</Text>
            </Text>
            <Text style={styles.healthScoreMessage} numberOfLines={2}>
              {message}
            </Text>
          </View>
          <View style={styles.healthScoreRight}>
            <View style={styles.circularProgressContainer}>
              <View style={[styles.circularProgress, { borderColor: scoreColor }]}>
                <Text style={[styles.circularProgressText, { color: scoreColor }]}>
                  {percentage}%
                </Text>
              </View>
            </View>
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

// ActivityRings Component
const ActivityRings = ({ rings }: any) => {
  const renderRing = (value: number, goal: number, color: string, label: string, unit: string) => {
    const percentage = Math.min((value / goal) * 100, 100);
    
    return (
      <View style={styles.activityRingContainer}>
        <View style={styles.ringVisual}>
          <View style={[styles.ringBackground, { borderColor: `${color}20` }]} />
          <View style={styles.ringCenter}>
            <Text style={[styles.ringValue, { color }]}>{value}</Text>
            <Text style={styles.ringUnit}>{unit}</Text>
          </View>
        </View>
        <Text style={styles.ringLabel}>{label}</Text>
      </View>
    );
  };

  return (
    <View style={styles.activityRingsCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Activity Rings</Text>
        <TouchableOpacity>
          <Text style={styles.sectionAction}>Details</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.ringsContainer}>
        {renderRing(
          rings?.move || 0,
          rings?.move_goal || 500,
          THEME.ringMove,
          'Move',
          'kcal'
        )}
        {renderRing(
          rings?.exercise || 0,
          rings?.exercise_goal || 30,
          THEME.ringExercise,
          'Exercise',
          'min'
        )}
        {renderRing(
          rings?.stand || 0,
          rings?.stand_goal || 12,
          THEME.ringStand,
          'Stand',
          'hr'
        )}
      </View>
    </View>
  );
};

// HealthTrends Component
const HealthTrends = ({ trends }: { trends: HealthTrend[] }) => {
  if (!trends || trends.length === 0) return null;

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <Feather name="trending-up" size={16} color={THEME.success} />;
      case 'down': return <Feather name="trending-down" size={16} color={THEME.danger} />;
      default: return <Feather name="minus" size={16} color={THEME.textSecondary} />;
    }
  };

  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'walk':
      case 'walking':
        return <FontAwesome5 name="walking" size={16} color="#FFF" />;
      case 'flame':
        return <Ionicons name="flame" size={16} color="#FFF" />;
      case 'bed':
        return <Ionicons name="bed" size={16} color="#FFF" />;
      case 'water':
        return <Ionicons name="water" size={16} color="#FFF" />;
      case 'heart':
        return <FontAwesome5 name="heartbeat" size={14} color="#FFF" />;
      default:
        return <MaterialCommunityIcons name={iconName as any} size={16} color="#FFF" />;
    }
  };

  return (
    <View style={styles.trendsCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Health Trends</Text>
        <TouchableOpacity>
          <Text style={styles.sectionAction}>View All</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.trendsScroll}
      >
        {trends.slice(0, 3).map((trend, index) => (
          <View key={index} style={styles.trendItem}>
            <View style={styles.trendHeader}>
              <View style={[styles.trendIcon, { backgroundColor: getTrendColor(trend.trend) + '20' }]}>
                {getCategoryIcon(trend.icon)}
              </View>
              {getTrendIcon(trend.trend)}
            </View>
            <Text style={styles.trendValue}>{trend.value}</Text>
            <Text style={styles.trendCategory}>{trend.category}</Text>
            <Text style={styles.trendMessage} numberOfLines={2}>
              {trend.message}
            </Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const getTrendColor = (trend: string) => {
  switch (trend) {
    case 'up': return THEME.success;
    case 'down': return THEME.danger;
    default: return THEME.textSecondary;
  }
};

// HealthCategories Component
const HealthCategories = ({ categories, title, onItemPress }: any) => {
  if (!categories || categories.length === 0) return null;

  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'walk':
      case 'walking':
        return <FontAwesome5 name="walking" size={16} color="#FFF" />;
      case 'flame':
        return <Ionicons name="flame" size={16} color="#FFF" />;
      case 'bed':
        return <Ionicons name="bed" size={16} color="#FFF" />;
      default:
        return <MaterialCommunityIcons name={iconName as any} size={16} color="#FFF" />;
    }
  };

  return (
    <View style={styles.categoriesCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <TouchableOpacity onPress={() => onItemPress && onItemPress()}>
          <Text style={styles.sectionAction}>See All</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.categoriesGrid}>
        {categories.slice(0, 4).map((category: HealthCategory, index: number) => (
          <TouchableOpacity
            key={category.id || index}
            style={styles.categoryItem}
            onPress={() => onItemPress && onItemPress(category)}
            activeOpacity={0.7}
          >
            <View style={[styles.categoryIcon, { backgroundColor: category.color || THEME.primary }]}>
              {getCategoryIcon(category.icon)}
            </View>
            <Text style={styles.categoryValue}>
              {category.value}
              <Text style={styles.categoryUnit}> {category.unit}</Text>
            </Text>
            <Text style={styles.categoryTitle}>{category.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// QuickActions Component
const QuickActions = ({ onActionPress }: any) => {
  const actions = [
    { id: 1, title: 'Log Food', icon: 'fast-food-outline' as const, color: THEME.success },
    { id: 2, title: 'Vitals', icon: 'fitness-outline' as const, color: THEME.danger },
    { id: 3, title: 'Sleep', icon: 'bed-outline' as const, color: THEME.warning },
    { id: 4, title: 'Water', icon: 'water-outline' as const, color: THEME.info },
  ];

  return (
    <View style={styles.quickActionsCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
      </View>
      <View style={styles.actionsGrid}>
        {actions.map((action) => (
          <TouchableOpacity
            key={action.id}
            style={styles.actionItem}
            onPress={() => onActionPress && onActionPress(action)}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIcon, { backgroundColor: action.color + '15' }]}>
              <Ionicons name={action.icon} size={22} color={action.color} />
            </View>
            <Text style={styles.actionTitle}>{action.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// DailyTip Component
const DailyTip = ({ tip }: { tip?: string | DailyTipResponse }) => {
  if (!tip) return null;

  let tipText = '';
  if (typeof tip === 'string') {
    tipText = tip;
  } else if (tip && typeof tip === 'object') {
    tipText = tip.tip || tip.message || '';
  }

  if (!tipText) return null;

  return (
    <View style={styles.dailyTipCard}>
      <View style={styles.tipHeader}>
        <Ionicons name="bulb-outline" size={20} color={THEME.warning} />
        <Text style={styles.tipTitle}>Daily Health Tip</Text>
      </View>
      <Text style={styles.tipContent}>{tipText}</Text>
    </View>
  );
};

// BottomNavigation Component
const BottomNavigation = ({ activeRoute, onNavigate }: any) => {
  const routes = [
    { key: 'home', label: 'Home', icon: 'home-outline' as const, activeIcon: 'home' as const },
    { key: 'health', label: 'Health', icon: 'fitness-outline' as const, activeIcon: 'fitness' as const },
    { key: 'add', label: 'Add', icon: 'add' as const, special: true },
    { key: 'notifications', label: 'Payment', icon: 'wallet' as const, activeIcon: 'notifications' as const },
    { key: 'profile', label: 'Chat', icon: 'chatbubble-outline' as const, activeIcon: 'chatbubble' as const },
  ];

  return (
    <View style={styles.bottomNav}>
      {routes.map((route) => {
        if (route.special) {
          return (
            <TouchableOpacity
              key={route.key}
              style={styles.addButton}
              onPress={() => onNavigate && onNavigate('action-menu')}
              activeOpacity={0.8}
            >
              <View style={styles.addButtonCircle}>
                <Ionicons name={route.icon} size={28} color="#FFFFFF" />
              </View>
            </TouchableOpacity>
          );
        }

        const isActive = activeRoute === route.key;
        return (
          <TouchableOpacity
            key={route.key}
            style={styles.navItem}
            onPress={() => onNavigate && onNavigate(route.key)}
            activeOpacity={0.7}
          >
            <Ionicons
              name={isActive ? route.activeIcon : route.icon}
              size={24}
              color={isActive ? THEME.primary : THEME.textSecondary}
            />
            <Text
              style={[
                styles.navLabel,
                { color: isActive ? THEME.primary : THEME.textSecondary },
              ]}
            >
              {route.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// ProfileModal Component
const ProfileModal = ({ visible, onClose, user, onLogout, router }: any) => {
  const [slideAnim] = useState(new Animated.Value(300));

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  const getProfileImage = () => {
    if (user?.profile_image) {
      if (user.profile_image.startsWith('http')) return { uri: user.profile_image };
      return { uri: `${BASE_URL}${user.profile_image}` };
    }
    return { uri: `https://ui-avatars.com/api/?name=${user?.full_name || 'User'}&background=0D8ABC&color=fff&size=256` };
  };

  const profileImg = getProfileImage();
  const menuItems = [
    {
      icon: 'person-outline' as const,
      label: 'Edit Profile',
      onPress: () => {
        onClose();
        router.push('/profile-setup');
      },
    },
    {
      icon: 'settings-outline' as const,
      label: 'Settings',
      onPress: () => {
        onClose();
        router.push('/settings');
      },
    },
  ];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.modalContent,
            { transform: [{ translateX: slideAnim }] },
          ]}
        >
          <View style={styles.modalHeader}>
            <Image source={profileImg} style={styles.modalProfileImage} />
            <Text style={styles.modalName}>{user?.full_name || user?.username}</Text>
            <Text style={styles.modalEmail}>{user?.email}</Text>
          </View>

          <View style={styles.modalMenu}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.modalMenuItem}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={styles.modalMenuLeft}>
                  <Ionicons name={item.icon} size={22} color={THEME.textPrimary} />
                  <Text style={styles.modalMenuLabel}>{item.label}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={THEME.textTertiary} />
              </TouchableOpacity>
            ))}

            <TouchableOpacity
              style={[styles.modalMenuItem, styles.logoutButton]}
              onPress={onLogout}
              activeOpacity={0.7}
            >
              <View style={styles.modalMenuLeft}>
                <Ionicons name="log-out-outline" size={22} color={THEME.danger} />
                <Text style={[styles.modalMenuLabel, { color: THEME.danger }]}>
                  Sign Out
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

// Nutrition Widget Component
const NutritionOverview = ({ onPress }: { onPress: () => void }) => {
  const { todayNutrition, nutritionGoals } = useNutrition();
  
  const caloriePercentage = nutritionGoals.dailyCalories > 0 
    ? Math.min((todayNutrition.totalCalories / nutritionGoals.dailyCalories) * 100, 100)
    : 0;
  
  const waterPercentage = todayNutrition.waterGoal > 0
    ? Math.min((todayNutrition.waterIntake / todayNutrition.waterGoal) * 100, 100)
    : 0;

  return (
    <TouchableOpacity style={styles.nutritionCard} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.nutritionHeader}>
        <Text style={styles.nutritionTitle}>Nutrition Today</Text>
        <Ionicons name="chevron-forward" size={20} color={THEME.textSecondary} />
      </View>
      
      <View style={styles.nutritionGrid}>
        <View style={styles.nutritionItem}>
          <View style={[styles.nutritionIcon, { backgroundColor: `${THEME.success}20` }]}>
            <Ionicons name="flame" size={16} color={THEME.success} />
          </View>
          <Text style={styles.nutritionValue}>{todayNutrition.totalCalories}</Text>
          <Text style={styles.nutritionLabel}>Calories</Text>
          <View style={styles.miniProgress}>
            <View style={[
              styles.miniProgressFill, 
              { width: `${caloriePercentage}%`, backgroundColor: THEME.success }
            ]} />
          </View>
        </View>
        
        <View style={styles.nutritionItem}>
          <View style={[styles.nutritionIcon, { backgroundColor: `${THEME.info}20` }]}>
            <Ionicons name="water" size={16} color={THEME.info} />
          </View>
          <Text style={styles.nutritionValue}>{todayNutrition.waterIntake}ml</Text>
          <Text style={styles.nutritionLabel}>Water</Text>
          <View style={styles.miniProgress}>
            <View style={[
              styles.miniProgressFill, 
              { width: `${waterPercentage}%`, backgroundColor: THEME.info }
            ]} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// Fitness Widget Component
const FitnessOverview = ({ onPress }: { onPress: () => void }) => {
  const { todayActivity } = useNutrition();
  
  return (
    <TouchableOpacity style={styles.fitnessCard} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.fitnessHeader}>
        <Text style={styles.fitnessTitle}>Fitness Today</Text>
        <Ionicons name="chevron-forward" size={20} color={THEME.textSecondary} />
      </View>
      
      <View style={styles.fitnessGrid}>
        <View style={styles.fitnessItem}>
          <View style={[styles.fitnessIcon, { backgroundColor: `${THEME.primary}20` }]}>
            <Ionicons name="footsteps" size={16} color={THEME.primary} />
          </View>
          <Text style={styles.fitnessValue}>{todayActivity.steps}</Text>
          <Text style={styles.fitnessLabel}>Steps</Text>
        </View>
        
        <View style={styles.fitnessItem}>
          <View style={[styles.fitnessIcon, { backgroundColor: `${THEME.success}20` }]}>
            <Ionicons name="time" size={16} color={THEME.success} />
          </View>
          <Text style={styles.fitnessValue}>{todayActivity.activeMinutes}</Text>
          <Text style={styles.fitnessLabel}>Active Min</Text>
        </View>
        
        <View style={styles.fitnessItem}>
          <View style={[styles.fitnessIcon, { backgroundColor: `${THEME.danger}20` }]}>
            <Ionicons name="flame" size={16} color={THEME.danger} />
          </View>
          <Text style={styles.fitnessValue}>{todayActivity.caloriesBurned}</Text>
          <Text style={styles.fitnessLabel}>Calories</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// Main HomeScreen Component
export default function HomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { todayNutrition, todayActivity, nutritionGoals } = useNutrition();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [dailyTip, setDailyTip] = useState<string | DailyTipResponse>('');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      const [
        dashboardResponse,
        notificationsResponse,
        dailyTipResponse,
      ] = await Promise.allSettled([
        api.getHealthDashboard(),
        api.getUnreadCount(),
        api.getDailyTip(),
      ]);

      if (dashboardResponse.status === 'fulfilled') {
        setDashboardData(dashboardResponse.value);
      }

      if (notificationsResponse.status === 'fulfilled') {
        setUnreadCount(notificationsResponse.value.unread_count || 0);
      }

      if (dailyTipResponse.status === 'fulfilled') {
        setDailyTip(dailyTipResponse.value);
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchDashboardData();
  };

  const handleLogout = () => {
    setProfileModalVisible(false);
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  const handleQuickAction = (action: any) => {
    switch (action.title) {
      case 'Log Food':
        router.push('/nutrition/log-food' as any);
        break;
      case 'Vitals':
        router.push('/health/log-health');
        break;
      case 'Sleep':
        router.push('/health/log-health');
        break;
      case 'Water':
        router.push('/nutrition/log-water' as any);
        break;
      default:
        break;
    }
  };

  const handleCategoryPress = (category: HealthCategory) => {
    // Handle category press
  };

  const handleNavigate = (route: string) => {
    if (route === 'home') return;
    if (route === 'action-menu') {
      router.push('/action-menu');
    } else if (route === 'profile') {
      router.push('/(patient)/chat');
    } else if (route === 'nutrition') {
      router.push('/nutrition' as any);
    } else if (route === 'fitness') {
      router.push('/fitness' as any);
    } else {
      router.push(`/${route}` as any);
    }
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="dark-content" />
        <SkeletonLoader />
      </SafeAreaView>
    );
  }

  const mainCategories = dashboardData?.categories?.filter((c) => !c.is_workout) || [];
  const workoutCategories = dashboardData?.categories?.filter((c) => c.is_workout) || [];
  const trends = dashboardData?.trends || [];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="dark-content" />
      
      <Header
        user={user}
        unreadCount={unreadCount}
        onProfilePress={() => router.push('/(patient)/profile')}
        onNotificationPress={() => router.push('/notifications')}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[THEME.primary]}
            tintColor={THEME.primary}
          />
        }
      >
        {/* Health Score */}
        <HealthScoreCard
          score={dashboardData?.daily_score?.score || 0}
          message={dashboardData?.daily_score?.message || 'Complete your health check-in for today'}
          onPress={() => router.push('/health')}
        />

        {/* Activity Rings */}
        <ActivityRings rings={dashboardData?.activity_rings} />

        {/* Nutrition Overview */}
        <NutritionOverview onPress={() => router.push('/nutrition' as any)} />

        {/* Fitness Overview */}
        <FitnessOverview onPress={() => router.push('/fitness' as any)} />

        {/* Health Trends */}
        {trends.length > 0 && <HealthTrends trends={trends} />}

        {/* Main Health Categories */}
        {mainCategories.length > 0 && (
          <HealthCategories
            categories={mainCategories}
            title="Health Metrics"
            onItemPress={handleCategoryPress}
          />
        )}

        {/* Workout Categories */}
        {workoutCategories.length > 0 && (
          <HealthCategories
            categories={workoutCategories}
            title="Workouts"
            onItemPress={handleCategoryPress}
          />
        )}

        {/* Quick Actions */}
        <QuickActions onActionPress={handleQuickAction} />
        
        {/* Daily Tip */}
        <DailyTip tip={dailyTip || dashboardData?.daily_tip} />

        {/* Spacer for bottom navigation */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNavigation
        activeRoute="home"
        onNavigate={handleNavigate}
      />


    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.background,
  },
  
  // Header styles
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingTop: Platform.OS === 'android' ? SPACING.xl : SPACING.xxl,
    paddingBottom: SPACING.md,
    backgroundColor: THEME.background,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    color: THEME.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  userName: {
    fontSize: 34,
    fontWeight: '800',
    color: THEME.textPrimary,
    marginTop: SPACING.xs,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  notificationButton: {
    position: 'relative',
    padding: SPACING.xs,
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: THEME.danger,
    width: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: THEME.background,
  },
  notificationCount: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: THEME.primaryLight,
  },
  profilePlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInitial: {
    fontSize: 20,
    fontWeight: '600',
    color: THEME.primary,
  },
  
  // Health Score Card
  healthScoreCard: {
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 8,
  },
  healthScoreGradient: {
    padding: SPACING.lg,
  },
  healthScoreContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  healthScoreLeft: {
    flex: 1,
    paddingRight: SPACING.md,
  },
  healthScoreLabel: {
    fontSize: 14,
    color: THEME.textSecondary,
    marginBottom: SPACING.xs,
  },
  healthScoreValue: {
    fontSize: 48,
    fontWeight: '800',
    marginBottom: SPACING.sm,
  },
  healthScorePercent: {
    fontSize: 24,
    fontWeight: '600',
    color: THEME.textSecondary,
  },
  healthScoreMessage: {
    fontSize: 15,
    color: THEME.textSecondary,
    lineHeight: 20,
  },
  healthScoreRight: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circularProgressContainer: {
    width: 100,
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circularProgress: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circularProgressText: {
    fontSize: 16,
    fontWeight: '700',
  },
  
  // Activity Rings
  activityRingsCard: {
    backgroundColor: THEME.card,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderRadius: 20,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.lg,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  sectionAction: {
    fontSize: 15,
    color: THEME.primary,
    fontWeight: '500',
  },
  ringsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  activityRingContainer: {
    alignItems: 'center',
  },
  ringVisual: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
    position: 'relative',
  },
  ringBackground: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 8,
  },
  ringCenter: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: THEME.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ringValue: {
    fontSize: 16,
    fontWeight: '700',
  },
  ringUnit: {
    fontSize: 10,
    color: THEME.textSecondary,
    marginTop: 2,
  },
  ringLabel: {
    fontSize: 13,
    color: THEME.textSecondary,
    marginTop: SPACING.xs,
  },
  
  // Nutrition Widget Styles
  nutritionCard: {
    backgroundColor: THEME.card,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderRadius: 20,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  nutritionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  nutritionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  nutritionItem: {
    flex: 1,
    alignItems: 'center',
  },
  nutritionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  nutritionValue: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: SPACING.xs,
  },
  nutritionLabel: {
    fontSize: 12,
    color: THEME.textSecondary,
    marginBottom: SPACING.sm,
  },
  miniProgress: {
    width: 60,
    height: 4,
    backgroundColor: THEME.separator,
    borderRadius: 2,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Fitness Widget Styles
  fitnessCard: {
    backgroundColor: THEME.card,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderRadius: 20,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  fitnessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  fitnessTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: THEME.textPrimary,
  },
  fitnessGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  fitnessItem: {
    flex: 1,
    alignItems: 'center',
  },
  fitnessIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  fitnessValue: {
    fontSize: 20,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: SPACING.xs,
  },
  fitnessLabel: {
    fontSize: 12,
    color: THEME.textSecondary,
  },

  // Other existing styles...
  trendsCard: {
    backgroundColor: THEME.card,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderRadius: 20,
    paddingVertical: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  trendsScroll: {
    paddingHorizontal: SPACING.lg,
  },
  trendItem: {
    width: 160,
    backgroundColor: THEME.background,
    borderRadius: 16,
    padding: SPACING.md,
    marginRight: SPACING.md,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  trendIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendValue: {
    fontSize: 20,
    fontWeight: '600',
    color: THEME.textPrimary,
    marginBottom: SPACING.xs,
  },
  trendCategory: {
    fontSize: 13,
    color: THEME.textSecondary,
    marginBottom: SPACING.xs,
  },
  trendMessage: {
    fontSize: 11,
    color: THEME.textSecondary,
    lineHeight: 16,
  },
  
  categoriesCard: {
    backgroundColor: THEME.card,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderRadius: 20,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  categoryItem: {
    width: (width - SPACING.lg * 2 - SPACING.lg - SPACING.md) / 2,
    backgroundColor: THEME.background,
    borderRadius: 16,
    padding: SPACING.md,
    alignItems: 'center',
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  categoryValue: {
    fontSize: 20,
    fontWeight: '600',
    color: THEME.textPrimary,
    textAlign: 'center',
  },
  categoryUnit: {
    fontSize: 13,
    color: THEME.textSecondary,
  },
  categoryTitle: {
    fontSize: 15,
    color: THEME.textSecondary,
    textAlign: 'center',
    marginTop: SPACING.xs,
  },
  
  quickActionsCard: {
    backgroundColor: THEME.card,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderRadius: 20,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  actionItem: {
    width: (width - SPACING.lg * 2 - SPACING.lg - SPACING.md * 3) / 4,
    alignItems: 'center',
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  actionTitle: {
    fontSize: 11,
    color: THEME.textPrimary,
    textAlign: 'center',
    fontWeight: '500',
  },
  
  dailyTipCard: {
    backgroundColor: '#FFF9E6',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    borderRadius: 20,
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: '#FFE066',
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  tipTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#E67700',
  },
  tipContent: {
    fontSize: 15,
    color: '#8A6D3B',
    lineHeight: 22,
  },
  
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: THEME.card,
    borderTopWidth: 1,
    borderTopColor: THEME.separator,
    paddingTop: SPACING.sm,
    paddingBottom: Platform.OS === 'ios' ? SPACING.xl : SPACING.lg,
    height: 85,
  },
  navItem: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  navLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  addButton: {
    position: 'absolute',
    bottom: 30,
    alignSelf: 'center',
    zIndex: 1000,
  },
  addButtonCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: THEME.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? SPACING.xl : SPACING.lg,
    maxHeight: height * 0.6,
  },
  modalHeader: {
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: THEME.separator,
  },
  modalProfileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: SPACING.md,
  },
  modalProfilePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: THEME.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  modalProfileInitial: {
    fontSize: 32,
    fontWeight: '700',
    color: THEME.primary,
  },
  modalName: {
    fontSize: 22,
    fontWeight: '700',
    color: THEME.textPrimary,
    marginBottom: SPACING.xs,
  },
  modalEmail: {
    fontSize: 15,
    color: THEME.textSecondary,
  },
  modalMenu: {
    padding: SPACING.lg,
  },
  modalMenuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: THEME.separator,
  },
  modalMenuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  modalMenuLabel: {
    fontSize: 17,
    color: THEME.textPrimary,
  },
  logoutButton: {
    borderBottomWidth: 0,
    marginTop: SPACING.md,
  },
  
  skeletonContainer: {
    flex: 1,
    padding: SPACING.lg,
  },
  skeletonHeader: {
    marginBottom: SPACING.lg,
  },
  skeletonLine: {
    backgroundColor: THEME.separator,
    borderRadius: 8,
  },
  skeletonCard: {
    backgroundColor: THEME.card,
    borderRadius: 20,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  skeletonGridItem: {
    width: (width - SPACING.lg * 2 - SPACING.md) / 2,
    height: 100,
    backgroundColor: THEME.separator,
    borderRadius: 16,
  },
});

function setProfileModalVisible(arg0: boolean) {
  throw new Error('Function not implemented.');
}
