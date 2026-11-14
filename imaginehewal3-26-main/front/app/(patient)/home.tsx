import {
  Feather,
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
} from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Dimensions,
  Image,
  Platform,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { theme } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useNutrition } from '../../contexts/NutritionContext';
import api, {
  DailyTipResponse,
  DashboardData,
  HealthCategory,
  HealthTrend
} from '../../services/api';

const { width } = Dimensions.get('window');
const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL || 'http://localhost:8000';

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
    <BlurView intensity={20} tint="light" style={styles.header}>
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
          <Ionicons name="notifications-outline" size={24} color={theme.COLORS.textPrimary} />
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
    </BlurView>
  );
};



// CircularProgress Component
const CircularProgress = ({ size = 60, strokeWidth = 6, progress = 0, color = theme.COLORS.primary }: any) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.COLORS.border}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </Svg>
      <Text style={{ fontSize: 14, fontWeight: 'bold', color }}>{Math.round(progress)}%</Text>
    </View>
  );
};

// HealthScoreCard Component
const HealthScoreCard = ({ score, message, onPress }: any) => {
  const getScoreColor = () => {
    if (score >= 80) return theme.COLORS.success;
    if (score >= 50) return theme.COLORS.warning;
    return theme.COLORS.danger;
  };

  const scoreColor = getScoreColor();

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
            <CircularProgress 
              size={70} 
              strokeWidth={8} 
              progress={score} 
              color={scoreColor} 
            />
          </View>
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
};

// ActivityRings Component
const ActivityRings = ({ rings }: any) => {
  const renderRing = (value: number, goal: number, color: string, label: string, unit: string) => {
    // const percentage = Math.min((value / goal) * 100, 100);
    
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
          theme.COLORS.ringMove,
          'Move',
          'kcal'
        )}
        {renderRing(
          rings?.exercise || 0,
          rings?.exercise_goal || 30,
          theme.COLORS.ringExercise,
          'Exercise',
          'min'
        )}
        {renderRing(
          rings?.stand || 0,
          rings?.stand_goal || 12,
          theme.COLORS.ringStand,
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
      case 'up': return <Feather name="trending-up" size={16} color={theme.COLORS.success} />;
      case 'down': return <Feather name="trending-down" size={16} color={theme.COLORS.danger} />;
      default: return <Feather name="minus" size={16} color={theme.COLORS.textSecondary} />;
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
      case 'footsteps':
        return <Ionicons name="footsteps-outline" size={16} color="#FFF" />;
      case 'aperture':
        return <Ionicons name="aperture-outline" size={16} color="#FFF" />;
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
    case 'up': return theme.COLORS.success;
    case 'down': return theme.COLORS.danger;
    default: return theme.COLORS.textSecondary;
  }
};

// DailyTip Component
const DailyTip = ({ tip }: { tip: string | DailyTipResponse }) => {
  if (!tip) return null;
  
  const message = typeof tip === 'string' ? tip : tip.message || tip.tip;

  return (
    <View style={styles.dailyTipCard}>
      <View style={styles.tipHeader}>
        <View style={styles.tipIconContainer}>
          <Ionicons name="bulb" size={20} color={theme.COLORS.warning} />
        </View>
        <Text style={styles.tipTitle}>Daily Tip</Text>
      </View>
      <Text style={styles.tipContent}>{message}</Text>
    </View>
  );
};

// QuickActions Component
const QuickActions = ({ onActionPress }: any) => {
  const actions = [
    { title: 'Log Food', icon: 'nutrition', color: theme.COLORS.info },
    { title: 'Vitals', icon: 'heart', color: theme.COLORS.danger },
    { title: 'Sleep', icon: 'bed', color: theme.COLORS.primary },
    { title: 'Water', icon: 'water', color: theme.COLORS.success },
  ];

  return (
    <View style={styles.quickActionsCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
      </View>
      <View style={styles.actionsGrid}>
        {actions.map((action, index) => (
          <TouchableOpacity
            key={index}
            style={styles.actionItem}
            onPress={() => onActionPress && onActionPress(action)}
            activeOpacity={0.7}
          >
            <View style={[styles.actionIcon, { backgroundColor: `${action.color}15` }]}>
              <Ionicons name={action.icon as any} size={24} color={action.color} />
            </View>
            <Text style={styles.actionTitle}>{action.title}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

// NutritionOverview Component
const NutritionOverview = ({ onPress }: any) => {
  return (
    <TouchableOpacity style={styles.nutritionCard} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.nutritionHeader}>
        <Text style={styles.nutritionTitle}>Nutrition</Text>
        <Ionicons name="chevron-forward" size={16} color={theme.COLORS.textTertiary} />
      </View>
      <View style={styles.nutritionGrid}>
        <View style={styles.nutritionItem}>
          <Text style={styles.nutritionLabel}>Calories</Text>
          <View style={styles.miniProgress}>
            <View style={[styles.miniProgressFill, { width: '60%', backgroundColor: theme.COLORS.warning }]} />
          </View>
          <Text style={[styles.nutritionValue, { marginTop: 4 }]}>1,200 <Text style={{ fontSize: 10, fontWeight: '400' }}>/ 2,000</Text></Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View>
            <Text style={styles.nutritionLabel}>Protein</Text>
            <Text style={styles.fitnessValue}>45g</Text>
          </View>
          <View>
            <Text style={styles.nutritionLabel}>Carbs</Text>
            <Text style={styles.fitnessValue}>120g</Text>
          </View>
          <View>
            <Text style={styles.nutritionLabel}>Fat</Text>
            <Text style={styles.fitnessValue}>35g</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// FitnessOverview Component
const FitnessOverview = ({ onPress }: any) => {
  return (
    <TouchableOpacity style={styles.fitnessCard} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.fitnessHeader}>
        <Text style={styles.fitnessTitle}>Fitness</Text>
        <Ionicons name="chevron-forward" size={16} color={theme.COLORS.textTertiary} />
      </View>
      <View style={styles.fitnessGrid}>
        <View style={styles.fitnessItem}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.fitnessIcon, { backgroundColor: `${theme.COLORS.primary}20` }]}>
              <Ionicons name="footsteps" size={14} color={theme.COLORS.primary} />
            </View>
            <Text style={styles.fitnessLabel}>Steps</Text>
          </View>
          <Text style={styles.fitnessValue}>6,540</Text>
        </View>
        <View style={styles.fitnessItem}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.fitnessIcon, { backgroundColor: `${theme.COLORS.danger}20` }]}>
              <Ionicons name="flame" size={14} color={theme.COLORS.danger} />
            </View>
            <Text style={styles.fitnessLabel}>Cals</Text>
          </View>
          <Text style={styles.fitnessValue}>320</Text>
        </View>
        <View style={styles.fitnessItem}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={[styles.fitnessIcon, { backgroundColor: `${theme.COLORS.success}20` }]}>
              <Ionicons name="bicycle" size={14} color={theme.COLORS.success} />
            </View>
            <Text style={styles.fitnessLabel}>Active</Text>
          </View>
          <Text style={styles.fitnessValue}>45m</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
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
      case 'footsteps':
        return <Ionicons name="footsteps-outline" size={16} color="#FFF" />;
      case 'aperture':
        return <Ionicons name="aperture-outline" size={16} color="#FFF" />;
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
            <View style={[styles.categoryIcon, { backgroundColor: category.color || theme.COLORS.primary }]}>
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

// BottomNavigation Component
const BottomNavigation = ({ activeRoute, onNavigate }: any) => {
  const routes = [
    { key: 'home', label: 'Home', icon: 'home-outline' as const, activeIcon: 'home' as const },
    { key: 'health', label: 'Health', icon: 'fitness-outline' as const, activeIcon: 'fitness' as const },
    { key: 'add', label: 'Add', icon: 'add' as const, special: true },
    { key: 'payment', label: 'Payment', icon: 'wallet-outline' as const, activeIcon: 'wallet' as const },
    { key: 'profile', label: 'Chat', icon: 'chatbubble-outline' as const, activeIcon: 'chatbubble' as const },
  ];

  return (
    <BlurView intensity={30} tint="light" style={styles.bottomNav}>
      {routes.map((route) => {
        if (route.special) {
          return (
            <TouchableOpacity
              key={route.key}
              style={styles.addButton}
              onPress={() => onNavigate && onNavigate('action-menu')}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[theme.COLORS.gradientStart, theme.COLORS.gradientOverlay]}
                style={styles.addButtonCircle}
              >
                <Ionicons name={route.icon} size={28} color="#FFFFFF" />
              </LinearGradient>
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
              color={isActive ? theme.COLORS.primary : theme.COLORS.textSecondary}
            />
            <Text
              style={[
                styles.navLabel,
                { color: isActive ? theme.COLORS.primary : theme.COLORS.textSecondary },
              ]}
            >
              {route.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </BlurView>
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
        <StatusBar barStyle="dark-content" backgroundColor={theme.COLORS.background} />
        <SkeletonLoader />
      </SafeAreaView>
    );
  }

  const mainCategories = dashboardData?.categories?.filter((c) => !c.is_workout) || [];
  const workoutCategories = dashboardData?.categories?.filter((c) => c.is_workout) || [];
  const trends = dashboardData?.trends || [];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Background Gradient */}
      <LinearGradient
        colors={[theme.COLORS.background, '#E0F2FE', '#DBEAFE']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        <Header
          user={user}
          unreadCount={unreadCount}
          onProfilePress={() => router.push('/(patient)/profile')}
          onNotificationPress={() => router.push('/notifications')}
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={theme.COLORS.primary} />
          }
        >
          <HealthScoreCard
            score={dashboardData?.daily_score?.score || 0}
            message={dashboardData?.daily_score?.message || 'Keep up the good work!'}
            onPress={() => router.push('/health')}
          />

          <DailyTip tip={dailyTip} />

          <ActivityRings rings={dashboardData?.activity_rings} />

          <QuickActions onActionPress={handleQuickAction} />

          <View style={styles.rowContainer}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <NutritionOverview onPress={() => router.push('/nutrition' as any)} />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <FitnessOverview onPress={() => router.push('/fitness' as any)} />
            </View>
          </View>

          <TouchableOpacity
            onPress={() => router.push('/behavior' as any)}
            style={{ backgroundColor: '#AD0023', borderRadius: 16, padding: 16, marginBottom: 16 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>My daily step</Text>
            <Text style={{ color: '#fff', opacity: 0.9, marginTop: 4 }}>
              A small, personal action for today. Tap to open your plan.
            </Text>
          </TouchableOpacity>

          <HealthTrends trends={trends} />

          {mainCategories.length > 0 && (
            <HealthCategories
              categories={mainCategories}
              title="Health Metrics"
              onItemPress={handleCategoryPress}
            />
          )}

          {workoutCategories.length > 0 && (
            <HealthCategories
              categories={workoutCategories}
              title="Workouts"
              onItemPress={handleCategoryPress}
            />
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        <BottomNavigation
          activeRoute="home"
          onNavigate={handleNavigate}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.COLORS.background,
  },
  scrollContent: {
    padding: theme.SPACING.lg,
    paddingTop: theme.SPACING.sm,
    paddingBottom: 100, // Space for bottom nav
  },
  
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.SPACING.lg,
    paddingVertical: theme.SPACING.md,
    marginBottom: theme.SPACING.sm,
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    ...theme.TYPOGRAPHY.caption,
    color: theme.COLORS.textSecondary,
    fontWeight: '500',
  },
  userName: {
    ...theme.TYPOGRAPHY.h2,
    color: theme.COLORS.textPrimary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  notificationButton: {
    position: 'relative',
    padding: 4,
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: theme.COLORS.danger,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.COLORS.background,
  },
  notificationCount: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  profileImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'white',
    ...theme.SHADOWS.small,
  },

  // Skeleton
  skeletonContainer: {
    padding: theme.SPACING.lg,
  },
  skeletonHeader: {
    marginBottom: 24,
  },
  skeletonLine: {
    backgroundColor: '#E1E9EE',
    borderRadius: 4,
  },
  skeletonCard: {
    backgroundColor: 'white',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  skeletonGridItem: {
    width: (width - 48 - 16) / 2,
    height: 120,
    backgroundColor: 'white',
    borderRadius: 16,
  },

  // Health Score Card
  healthScoreCard: {
    marginBottom: theme.SPACING.lg,
    borderRadius: theme.LAYOUT.borderRadius.xl,
    ...theme.SHADOWS.medium,
    backgroundColor: theme.COLORS.card,
  },
  healthScoreGradient: {
    borderRadius: theme.LAYOUT.borderRadius.xl,
    padding: 20,
  },
  healthScoreContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  healthScoreLeft: {
    flex: 1,
  },
  healthScoreLabel: {
    ...theme.TYPOGRAPHY.label,
    color: theme.COLORS.textSecondary,
    marginBottom: 4,
  },
  healthScoreValue: {
    fontSize: 42,
    fontWeight: '800',
    lineHeight: 48,
  },
  healthScorePercent: {
    fontSize: 16,
    fontWeight: '500',
    color: theme.COLORS.textTertiary,
  },
  healthScoreMessage: {
    ...theme.TYPOGRAPHY.caption,
    color: theme.COLORS.textSecondary,
    marginTop: 8,
  },
  healthScoreRight: {
    marginLeft: 16,
  },
  circularProgressContainer: {
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularProgress: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
    transform: [{ rotate: '-45deg' }],
  },
  circularProgressText: {
    fontSize: 18,
    fontWeight: 'bold',
    transform: [{ rotate: '45deg' }],
  },

  // Activity Rings
  activityRingsCard: {
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.xl,
    padding: theme.SPACING.md,
    marginBottom: theme.SPACING.lg,
    ...theme.SHADOWS.small,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.SPACING.md,
  },
  sectionTitle: {
    ...theme.TYPOGRAPHY.h3,
    color: theme.COLORS.textPrimary,
  },
  sectionAction: {
    ...theme.TYPOGRAPHY.caption,
    color: theme.COLORS.primary,
    fontWeight: '600',
  },
  ringsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  activityRingContainer: {
    alignItems: 'center',
  },
  ringVisual: {
    width: 64,
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  ringBackground: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: 32,
    borderWidth: 4,
    opacity: 0.3,
  },
  ringCenter: {
    alignItems: 'center',
  },
  ringValue: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  ringUnit: {
    fontSize: 10,
    color: theme.COLORS.textTertiary,
  },
  ringLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.COLORS.textSecondary,
  },

  // Quick Actions
  quickActionsCard: {
    marginBottom: theme.SPACING.lg,
  },
  actionsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionItem: {
    alignItems: 'center',
    width: (width - 48 - 32) / 4,
  },
  actionIcon: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 12,
    fontWeight: '500',
    color: theme.COLORS.textSecondary,
    textAlign: 'center',
  },

  // Daily Tip
  dailyTipCard: {
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.md,
    marginBottom: theme.SPACING.lg,
    borderLeftWidth: 4,
    borderLeftColor: theme.COLORS.warning,
    ...theme.SHADOWS.small,
  },
  tipHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 12,
  },
  tipIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.COLORS.warningLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.COLORS.textPrimary,
  },
  tipContent: {
    fontSize: 14,
    color: theme.COLORS.textSecondary,
    lineHeight: 20,
  },

  // Row Container
  rowContainer: {
    flexDirection: 'row',
    marginBottom: theme.SPACING.lg,
  },

  // Nutrition & Fitness Cards
  nutritionCard: {
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.xl,
    padding: theme.SPACING.md,
    height: 160,
    ...theme.SHADOWS.small,
  },
  fitnessCard: {
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.xl,
    padding: theme.SPACING.md,
    height: 160,
    ...theme.SHADOWS.small,
  },
  nutritionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  fitnessHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  nutritionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.COLORS.textPrimary,
  },
  fitnessTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.COLORS.textPrimary,
  },
  nutritionGrid: {
    gap: 12,
  },
  fitnessGrid: {
    gap: 10,
  },
  nutritionItem: {
    marginBottom: 4,
  },
  fitnessItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  nutritionIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
    display: 'none', // Hide icon to save space
  },
  fitnessIcon: {
    width: 24,
    height: 24,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  nutritionValue: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.COLORS.textPrimary,
  },
  fitnessValue: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.COLORS.textPrimary,
  },
  nutritionLabel: {
    fontSize: 11,
    color: theme.COLORS.textSecondary,
    marginBottom: 4,
  },
  fitnessLabel: {
    fontSize: 11,
    color: theme.COLORS.textSecondary,
  },
  miniProgress: {
    height: 4,
    backgroundColor: theme.COLORS.border,
    borderRadius: 2,
    width: '100%',
  },
  miniProgressFill: {
    height: '100%',
    borderRadius: 2,
  },

  // Trends
  trendsCard: {
    marginBottom: theme.SPACING.lg,
  },
  trendsScroll: {
    paddingRight: theme.SPACING.lg,
  },
  trendItem: {
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.md,
    marginRight: theme.SPACING.md,
    width: 140,
    ...theme.SHADOWS.small,
  },
  trendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  trendIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trendValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.COLORS.textPrimary,
    marginBottom: 2,
  },
  trendCategory: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.COLORS.textSecondary,
    marginBottom: 4,
  },
  trendMessage: {
    fontSize: 10,
    color: theme.COLORS.textTertiary,
    lineHeight: 14,
  },

  // Categories
  categoriesCard: {
    marginBottom: theme.SPACING.lg,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.SPACING.md,
  },
  categoryItem: {
    width: (width - theme.SPACING.lg * 2 - theme.SPACING.md) / 2,
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.md,
    alignItems: 'center',
    ...theme.SHADOWS.small,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.SPACING.sm,
  },
  categoryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.COLORS.textPrimary,
    textAlign: 'center',
  },
  categoryUnit: {
    fontSize: 12,
    color: theme.COLORS.textSecondary,
    fontWeight: '400',
  },
  categoryTitle: {
    fontSize: 14,
    color: theme.COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },

  // Bottom Nav
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.8)',
    borderTopWidth: 1,
    borderTopColor: theme.COLORS.separator,
    paddingTop: theme.SPACING.sm,
    paddingBottom: Platform.OS === 'ios' ? theme.SPACING.xl : theme.SPACING.lg,
    height: 85,
  },
  navItem: {
    alignItems: 'center',
    gap: 4,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: '500',
  },
  addButton: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  addButtonCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.SHADOWS.medium,
  },
});