import React, { useEffect, useState, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  Image,
  ImageBackground,
  Dimensions,
  FlatList,
  NativeScrollEvent,
  NativeSyntheticEvent
} from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming, 
  withDelay
} from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../contexts/AuthContext';
import { theme, BACKGROUND_OVERLAY } from '../constants/theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Carousel data
const carouselData = [
  {
    id: '1',
    image: require('../assets/images/on_image1.png'),
    title: 'Smart Health Tracking',
    description: 'Monitor your vital signs, medications, and daily health activities with ease'
  },
  {
    id: '2',
    image: require('../assets/images/on_image2.png'),
    title: 'Instant Emergency Support',
    description: 'Get immediate help with our emergency alert system for patients and caregivers'
  },
  {
    id: '3',
    image: require('../assets/images/on_image3.png'),
    title: 'Secure Health Connection',
    description: 'Stay connected with healthcare providers through our secure platform'
  }
];

export default function SplashScreen() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useAuth();
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);
  
  // Animation values - start from visible state to prevent blank screen
  const logoRotation = useSharedValue(0);
  const logoScale = useSharedValue(0.3);
  const contentOpacity = useSharedValue(0);
  const buttonTranslation = useSharedValue(50);
  const carouselOpacity = useSharedValue(0);

  useEffect(() => {
    // Logo animations - run immediately on mount with fast timing
    logoRotation.value = withTiming(0, { duration: 600 }); 
    logoScale.value = withSpring(1, { damping: 15, stiffness: 150 });
    contentOpacity.value = withDelay(400, withTiming(1, { duration: 600 }));
    carouselOpacity.value = withDelay(600, withTiming(1, { duration: 500 }));
    buttonTranslation.value = withDelay(800, withSpring(0, { damping: 15 }));
  }, []);

  // Auto-scroll carousel every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const nextIndex = (currentIndex + 1) % carouselData.length;
      setCurrentIndex(nextIndex);
      flatListRef.current?.scrollToIndex({
        index: nextIndex,
        animated: true
      });
    }, 5000); 

    return () => clearInterval(interval);
  }, [currentIndex]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(contentOffsetX / SCREEN_WIDTH);
    if (index >= 0 && index < carouselData.length) {
      setCurrentIndex(index);
    }
  };

  const handleGetStarted = () => {
    router.push('/onboarding');
  };

  const renderCarouselItem = ({ item }: { item: typeof carouselData[0] }) => (
    <View style={styles.carouselItem}>
      <Image 
        source={item.image} 
        style={styles.carouselImage}
        resizeMode="contain"
      />
      <View style={styles.carouselTextContainer}>
        <Text style={styles.carouselTitle}>{item.title}</Text>
        <Text style={styles.carouselDescription}>{item.description}</Text>
      </View>
    </View>
  );

  const renderPaginationDots = () => (
    <View style={styles.paginationContainer}>
      {carouselData.map((_, index) => (
        <View
          key={index}
          style={[
            styles.paginationDot,
            index === currentIndex ? styles.paginationDotActive : styles.paginationDotInactive
          ]}
        />
      ))}
    </View>
  );

  const animatedLogoStyle = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${logoRotation.value}rad` },
      { scale: logoScale.value }
    ],
  }));

  const animatedContentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
  }));

  const animatedCarouselStyle = useAnimatedStyle(() => ({
    opacity: carouselOpacity.value,
  }));

  const animatedButtonStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: buttonTranslation.value }],
  }));

  if (isLoading) {
    return (
      <ImageBackground
        source={require('../assets/images/background.png')}
        style={styles.loadingContainer}
        resizeMode="cover"
      >
        <View style={styles.overlay}>
        <Image 
          source={require('../assets/images/logo.png')} 
          style={styles.loadingLogo} 
          resizeMode="contain" 
          />
        </View>
      </ImageBackground>
    );
  }

  return (
    <ImageBackground
      source={require('../assets/images/background.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
        <View style={styles.overlayContent}>
        
        {/* Top Logo */}
        <Animated.View style={[styles.logoContainer, animatedLogoStyle]}>
          <Image 
            source={require('../assets/images/logo.png')} 
            style={styles.logo} 
            resizeMode="contain" 
          />
        </Animated.View>

        {/* Image Carousel */}
        <Animated.View style={[styles.carouselWrapper, animatedCarouselStyle]}>
          <FlatList
            ref={flatListRef}
            data={carouselData}
            renderItem={renderCarouselItem}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            keyExtractor={(item) => item.id}
            style={styles.carousel}
            initialScrollIndex={0}
            getItemLayout={(data, index) => (
              {length: SCREEN_WIDTH, offset: SCREEN_WIDTH * index, index}
            )}
          />
          
          {/* Pagination Dots */}
          {renderPaginationDots()}
        </Animated.View>

        {/* Tagline */}
        <Animated.View style={[styles.textContainer, animatedContentStyle]}>
          <Text style={styles.tagline}>
            Designed in Ghana to support people living with early-stage chronic diseases globally. Built with Azure.
          </Text>
        </Animated.View>

        {/* Get Started Button */}
        <Animated.View style={[styles.buttonWrapper, animatedButtonStyle]}>
          <TouchableOpacity 
            style={styles.button} 
            onPress={handleGetStarted}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>
              {isAuthenticated ? 'Go to Dashboard' : 'Get started'}
            </Text>
            <View style={styles.iconCircle}>
              <Ionicons name="arrow-forward" size={24} color={theme.COLORS.textOnPrimary} />
            </View>
          </TouchableOpacity>
        </Animated.View>
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: BACKGROUND_OVERLAY,
  },
  overlayContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 0, 
    paddingVertical: theme.SPACING.lg,
  },
  logoContainer: { 
    marginBottom: theme.SPACING.xs,
    marginTop: theme.SPACING.xl,
  },
  logo: { 
    width: 60,
    height: 60, 
    borderRadius: theme.LAYOUT.borderRadius.md,
  },
  carouselWrapper: {
    width: SCREEN_WIDTH, 
    height: 550,
    marginBottom: theme.SPACING.sm,
    marginTop: theme.SPACING.sm,
    borderRadius: 0,
    overflow: 'hidden',
    paddingVertical: 0,
  },
  carousel: {
    flex: 1,
  },
  carouselItem: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.SPACING.sm,
  },
  carouselImage: {
    width: SCREEN_WIDTH - 20,
    height: 420,
    borderRadius: theme.LAYOUT.borderRadius.xl,
    marginBottom: theme.SPACING.md,
  },
  carouselTextContainer: {
    alignItems: 'center',
    paddingHorizontal: theme.SPACING.xl,
    paddingVertical: theme.SPACING.xs,
    width: '100%',
    maxWidth: '85%',
  },
  carouselTitle: {
    color: theme.COLORS.textOnDark,
    fontSize: 26,
    fontWeight: '800',
    marginBottom: theme.SPACING.sm,
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  carouselDescription: {
    color: '#FFFFFF',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
    flexWrap: 'wrap',
    maxWidth: '100%',
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    bottom: theme.SPACING.sm,
    width: '100%',
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: theme.LAYOUT.borderRadius.full,
    marginHorizontal: theme.SPACING.xs,
  },
  paginationDotActive: {
    backgroundColor: theme.COLORS.textOnDark,
    width: 24,
  },
  paginationDotInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
  },
  textContainer: { 
    alignItems: 'center', 
    marginBottom: theme.SPACING.lg,
    width: '100%',
    paddingHorizontal: theme.SPACING.lg,
  },
  tagline: {
    color: '#FFFFFF',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    fontWeight: '500',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: theme.SPACING.lg,
    paddingVertical: theme.SPACING.md,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    overflow: 'hidden',
  },
  buttonWrapper: { 
    width: '100%', 
    alignItems: 'center',
    maxWidth: 400,
    paddingHorizontal: theme.SPACING.lg,
    marginBottom: theme.SPACING.lg,
  },
  button: {
    backgroundColor: theme.COLORS.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
    paddingLeft: theme.SPACING.lg,
    paddingRight: theme.SPACING.sm,
    borderRadius: theme.LAYOUT.borderRadius.xl + 16,
    width: '100%',
    ...theme.SHADOWS.large,
  },
  buttonText: { 
    color: theme.COLORS.primary, 
    fontSize: 20,
    fontWeight: '800',
  },
  iconCircle: {
    backgroundColor: theme.COLORS.primary,
    width: 48,
    height: 48,
    borderRadius: theme.LAYOUT.borderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingLogo: {
    width: 100,
    height: 100,
    borderRadius: theme.LAYOUT.borderRadius.xl,
  },
});