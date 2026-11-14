import React, { useEffect } from 'react';
import { TouchableOpacity, StyleSheet, View, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
  Easing
} from 'react-native-reanimated';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ChatButtonProps {
  onPress: () => void;
  unreadCount?: number;
  isChatOpen?: boolean;
}

export const ChatButton: React.FC<ChatButtonProps> = ({ 
  onPress, 
  unreadCount = 0,
  isChatOpen = false 
}) => {
  
  const scale = useSharedValue(1);
  const rotation = useSharedValue(0);
  const pulseScale = useSharedValue(1);
  const bounce = useSharedValue(0);
  const glowOpacity = useSharedValue(0.3);

  
  useEffect(() => {
    bounce.value = withRepeat(
      withSequence(
        withTiming(-8, { duration: 1500, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: 1500, easing: Easing.inOut(Easing.sin) })
      ),
      -1,
      true
    );
    
    
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1000 }),
        withTiming(0.3, { duration: 1000 })
      ),
      -1,
      true
    );
  }, []);

  
  useEffect(() => {
    if (unreadCount > 0 && !isChatOpen) {
      pulseScale.value = withRepeat(
        withSequence(
          withSpring(1.15, { damping: 1.5 }),
          withSpring(1, { damping: 1.5 })
        ),
        -1,
        true
      );
    } else {
      pulseScale.value = 1;
    }
  }, [unreadCount, isChatOpen]);

  const handlePress = () => {
    
    scale.value = withSequence(
      withSpring(0.85, { damping: 15 }),
      withSpring(1, { damping: 15 })
    );
    rotation.value = withSequence(
      withSpring(-15, { damping: 2 }),
      withSpring(0, { damping: 15 })
    );
    onPress();
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value * pulseScale.value },
      { rotate: `${rotation.value}deg` },
      { translateY: bounce.value }
    ],
  }));

  const badgeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  
  
  const getPosition = () => {
    return {
      
      
      bottom: 180, 
      
      right: 15, 
    };
  };

  const position = getPosition();

  return (
    <Animated.View style={[styles.container, { 
      bottom: position.bottom, 
      right: position.right,
    }]}>
      {/* Glow effect */}
      <Animated.View style={[styles.glowEffect, glowStyle]} />
      
      <Animated.View style={[animatedStyle]}>
        <TouchableOpacity
          style={styles.button}
          onPress={handlePress}
          activeOpacity={0.8}
        >
          <View style={styles.iconContainer}>
            <Ionicons 
              name="chatbubble-ellipses" 
              size={22}
              color="#FFFFFF" 
            />
            <View style={styles.medicalBadge}>
              <Ionicons name="medical" size={12} color="#007bff" />
            </View>
            
            {/* Animated rings */}
            <View style={styles.ring} />
            <View style={[styles.ring, styles.ring2]} />
          </View>
          
          {/* Notification badge */}
          {unreadCount > 0 && (
            <Animated.View style={[styles.notificationBadge, badgeStyle]}>
              <Animated.Text style={styles.notificationText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Animated.Text>
            </Animated.View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  glowEffect: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'rgba(0, 123, 255, 0.3)',
    zIndex: -1,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007bff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#007bff',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  iconContainer: {
    position: 'relative',
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  medicalBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    width: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  ring: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    zIndex: 1,
  },
  ring2: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  notificationBadge: {
    position: 'absolute',
    top: -5,
    right: -5,
    backgroundColor: '#dc3545',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  notificationText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
    includeFontPadding: false,
  },
});

export default ChatButton;