import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Platform,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming
} from 'react-native-reanimated';
import { useChatbot } from '../../contexts/ChatbotContext';
import { ChatMessage } from '../../services/chatbot';
import { ActivityIndicator, Ionicons, KeyboardAvoidingView, LinearGradient, MaterialCommunityIcons, MaterialIcons, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from '../themed';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ChatWindowProps {
  isVisible: boolean;
  onClose: () => void;
}


const THEME = {
  primary: '#007bff',
  secondary: '#0056b3',
  background: '#F8F9FA',
  card: '#FFFFFF',
  textPrimary: '#000000',
  textSecondary: '#6C757D',
  userMessage: '#007bff',
  aiMessage: '#F0F8FF',
  emergency: '#DC3545',
  success: '#28A745',
  warning: '#FFC107',
  gradientStart: '#007bff',
  gradientEnd: '#0056b3',
};


const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
};

export const ChatWindow: React.FC<ChatWindowProps> = ({ isVisible, onClose }) => {
  const { 
    messages, 
    sendMessage, 
    isLoading, 
    isTyping,
    clearMessages 
  } = useChatbot();
  
  const [inputText, setInputText] = useState('');
  const scrollViewRef = useRef<React.ComponentRef<typeof ScrollView>>(null);
  
  
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(50);
  const scale = useSharedValue(0.95);
  const borderRadius = useSharedValue(24);

  
  useEffect(() => {
    if (isVisible) {
      opacity.value = withTiming(1, { 
        duration: 300,
        easing: Easing.out(Easing.cubic)
      });
      translateY.value = withSpring(0, {
        damping: 20,
        stiffness: 120
      });
      scale.value = withSpring(1, {
        damping: 20,
        stiffness: 120
      });
      borderRadius.value = withSpring(16, {
        damping: 20,
        stiffness: 120
      });
    } else {
      opacity.value = withTiming(0, { duration: 200 });
      translateY.value = withTiming(50, { duration: 200 });
    }
  }, [isVisible]);

  
  useEffect(() => {
    if (scrollViewRef.current && messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateY: translateY.value },
      { scale: scale.value }
    ],
    borderRadius: borderRadius.value,
    display: opacity.value === 0 ? 'none' : 'flex'
  }));

  if (!isVisible) return null;

  const handleSend = async () => {
    if (inputText.trim()) {
      await sendMessage(inputText);
      setInputText('');
    }
  };

  const handleClearChat = async () => {
    Alert.alert(
      'Clear Conversation',
      'Are you sure you want to delete all messages? This action cannot be undone.',
      [
        { 
          text: 'Cancel', 
          style: 'cancel',
        },
        { 
          text: 'Delete All', 
          style: 'destructive',
          onPress: async () => {
            await clearMessages();
          }
        }
      ]
    );
  };

  const formatTime = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '--:--';
    }
  };

  const TypingIndicator = () => {
    const dot1 = useSharedValue(0);
    const dot2 = useSharedValue(0);
    const dot3 = useSharedValue(0);

    useEffect(() => {
      const animateDot = (dot: typeof dot1, delay: number) => {
        dot.value = withDelay(
          delay,
          withRepeat(
            withSequence(
              withTiming(-6, { duration: 400, easing: Easing.inOut(Easing.ease) }),
              withTiming(0, { duration: 400, easing: Easing.inOut(Easing.ease) })
            ),
            -1,
            false
          )
        );
      };

      animateDot(dot1, 0);
      animateDot(dot2, 150);
      animateDot(dot3, 300);
    }, []);

    const dot1Style = useAnimatedStyle(() => ({
      transform: [{ translateY: dot1.value }]
    }));

    const dot2Style = useAnimatedStyle(() => ({
      transform: [{ translateY: dot2.value }]
    }));

    const dot3Style = useAnimatedStyle(() => ({
      transform: [{ translateY: dot3.value }]
    }));

    return (
      <View style={styles.typingContainer}>
        <Animated.View style={[styles.typingDot, dot1Style]} />
        <Animated.View style={[styles.typingDot, dot2Style]} />
        <Animated.View style={[styles.typingDot, dot3Style]} />
      </View>
    );
  };
  const renderMessage = (message: ChatMessage) => {
    const isUser = message.role === 'user';
    const isEmergency = message.isEmergency;

    return (
      <View
        key={message.id}
        style={[
          styles.messageContainer,
          isUser ? styles.userContainer : styles.aiContainer,
        ]}
      >
        {!isUser && (
          <View style={styles.aiAvatar}>
            <LinearGradient
              colors={[THEME.gradientStart, THEME.gradientEnd]}
              style={styles.aiAvatarGradient}
            >
              <MaterialCommunityIcons name="robot-happy" size={18} color="#FFFFFF" />
            </LinearGradient>
          </View>
        )}
        
        <View style={[
          styles.messageBubble,
          isUser ? styles.userBubble : styles.aiBubble,
          isEmergency && styles.emergencyBubble
        ]}>
          {!isUser && !isEmergency && (
            <View style={styles.messageHeader}>
              <Text style={styles.aiName}>HEWAL3 Assistant</Text>
              {isEmergency && (
                <Ionicons name="warning" size={14} color={THEME.emergency} />
              )}
            </View>
          )}
          
          {isEmergency && (
            <View style={styles.emergencyHeader}>
              <Ionicons name="warning" size={16} color={THEME.emergency} />
              <Text style={styles.emergencyText}>EMERGENCY</Text>
            </View>
          )}
          
          <Text style={[
            styles.messageText,
            isUser ? styles.userText : styles.aiText,
            isEmergency && styles.emergencyMessageText
          ]}>
            {message.content}
          </Text>
          
          <Text style={[
            styles.timestamp,
            isUser ? styles.userTimestamp : styles.aiTimestamp
          ]}>
            {formatTime(message.timestamp)}
          </Text>
        </View>
      </View>
    );
  };

  
  const quickActions = [
    { 
      icon: 'favorite' as const, 
      text: 'BP Tips', 
      query: 'Blood pressure management tips',
      color: '#007bff'
    },
    { 
      icon: 'opacity' as const, 
      text: 'Diabetes', 
      query: 'Diabetes care and management',
      color: '#28a745'
    },
    { 
      icon: 'medication' as const, 
      text: 'Medication', 
      query: 'Medication guidance and reminders',
      color: '#6f42c1'
    },
    { 
      icon: 'warning' as const, 
      text: 'Emergency', 
      query: 'What to do in a health emergency',
      color: '#dc3545'
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" />
      <View style={styles.overlay}>
        <Animated.View style={[styles.container, animatedStyle]}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.keyboardView}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 20}
          >
            {/* Header */}
            <LinearGradient
              colors={[THEME.gradientStart, THEME.gradientEnd]}
              style={styles.header}
            >
              <View style={styles.headerContent}>
                <View style={styles.headerLeft}>
                  <View style={styles.headerIcon}>
                    <MaterialCommunityIcons name="robot-happy" size={22} color="#FFFFFF" />
                  </View>
                  <View>
                    <Text style={styles.title}>HEWAL3 Health Assistant</Text>
                    <Text style={styles.subtitle}>Powered by Gemini AI</Text>
                  </View>
                </View>
                
                <View style={styles.headerRight}>
                  <TouchableOpacity 
                    onPress={handleClearChat} 
                    style={styles.headerButton}
                  >
                    <Ionicons name="trash-outline" size={20} color="rgba(255, 255, 255, 0.8)" />
                  </TouchableOpacity>
                  <TouchableOpacity 
                    onPress={onClose} 
                    style={styles.closeButton}
                  >
                    <Ionicons name="close" size={24} color="#FFFFFF" />
                  </TouchableOpacity>
                </View>
              </View>
            </LinearGradient>

            {/* Messages */}
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesScroll}
              contentContainerStyle={styles.messagesContent}
              showsVerticalScrollIndicator={false}
            >
              {messages.length === 0 ? (
                <View style={styles.emptyState}>
                  <LinearGradient
                    colors={['rgba(0, 123, 255, 0.1)', 'rgba(0, 123, 255, 0.05)']}
                    style={styles.emptyStateGradient}
                  >
                    <MaterialCommunityIcons 
                      name="robot-happy-outline" 
                      size={60} 
                      color={THEME.primary} 
                    />
                    <Text style={styles.emptyStateTitle}>Hello! I&apos;m your Health Assistant</Text>
                    <Text style={styles.emptyStateText}>
                      I can help you with health questions, medication guidance, and emergency assistance.
                    </Text>
                  </LinearGradient>
                </View>
              ) : (
                messages.map(renderMessage)
              )}
              
              {isTyping && (
                <View style={styles.typingMessageContainer}>
                  <View style={styles.aiAvatar}>
                    <LinearGradient
                      colors={[THEME.gradientStart, THEME.gradientEnd]}
                      style={styles.aiAvatarGradient}
                    >
                      <MaterialCommunityIcons name="robot-happy" size={18} color="#FFFFFF" />
                    </LinearGradient>
                  </View>
                  <View style={styles.typingBubble}>
                    <Text style={styles.typingText}>HEWAL3 Assistant is typing</Text>
                    <TypingIndicator />
                  </View>
                </View>
              )}
            </ScrollView>

            {/* Quick Actions */}
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false}
              style={styles.quickActions}
              contentContainerStyle={styles.quickActionsContent}
            >
              {quickActions.map((action, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.quickAction}
                  onPress={() => sendMessage(action.query)}
                  disabled={isLoading}
                  activeOpacity={0.7}
                >
                  <MaterialIcons 
                    name={action.icon} 
                    size={18} 
                    color={action.color} 
                  />
                  <Text 
                    style={styles.quickActionText}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {action.text}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Input Area */}
            <View style={styles.inputContainer}>
              <View style={styles.inputWrapper}>
                <TextInput
                  style={styles.input}
                  value={inputText}
                  onChangeText={setInputText}
                  placeholder="Ask about health, symptoms, or emergencies..."
                  placeholderTextColor={THEME.textSecondary}
                  multiline
                  maxLength={500}
                  editable={!isLoading}
                  onSubmitEditing={handleSend}
                />
                
                <TouchableOpacity
                  style={[styles.sendButton, (!inputText.trim() || isLoading) && styles.sendDisabled]}
                  onPress={handleSend}
                  disabled={!inputText.trim() || isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color="#FFFFFF" size={20} />
                  ) : (
                    <Ionicons name="send" size={20} color="#FFFFFF" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Ionicons name="warning" size={12} color={THEME.warning} />
              <Text style={styles.footerText}>
                For emergencies, always call 112 (Ghana Emergency Services)
              </Text>
            </View>
          </KeyboardAvoidingView>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 10000,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)', 
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: THEME.background,
    maxHeight: SCREEN_HEIGHT, 
    minHeight: SCREEN_HEIGHT, 
    width: '100%',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.3,
    shadowRadius: 25,
    elevation: 25,
  },
  keyboardView: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 90 : 50, 
    paddingBottom: SPACING.lg,
    paddingHorizontal: SPACING.lg,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    marginRight: SPACING.sm,
  },
  title: {
    fontSize: 16, 
    fontWeight: '600',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: 12, 
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    padding: SPACING.sm,
    marginRight: SPACING.xs,
  },
  closeButton: {
    padding: SPACING.sm,
  },
  messagesScroll: {
    flex: 1,
  },
  messagesContent: {
    padding: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  emptyState: {
    marginTop: SPACING.xl * 2, 
  },
  emptyStateGradient: {
    padding: SPACING.xl * 1.5, 
    borderRadius: 24,
    alignItems: 'center',
  },
  emptyStateTitle: {
    fontSize: 20, 
    fontWeight: '600',
    color: THEME.textPrimary,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    textAlign: 'center',
  },
  emptyStateText: {
    fontSize: 16, 
    color: THEME.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  messageContainer: {
    flexDirection: 'row',
    marginBottom: SPACING.md,
    maxWidth: '85%',
  },
  userContainer: {
    alignSelf: 'flex-end',
  },
  aiContainer: {
    alignSelf: 'flex-start',
  },
  aiAvatar: {
    marginRight: SPACING.sm,
  },
  aiAvatarGradient: {
    width: 40, 
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  messageBubble: {
    borderRadius: 20, 
    padding: SPACING.lg, 
    maxWidth: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  userBubble: {
    backgroundColor: THEME.userMessage,
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: THEME.aiMessage,
    borderBottomLeftRadius: 4,
  },
  emergencyBubble: {
    backgroundColor: '#FFF5F5',
    borderWidth: 2,
    borderColor: '#F8D7DA',
  },
  messageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  aiName: {
    fontSize: 14, 
    fontWeight: '600',
    color: THEME.primary,
    marginRight: SPACING.xs,
  },
  emergencyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  emergencyText: {
    fontSize: 14, 
    fontWeight: 'bold',
    color: THEME.emergency,
    marginLeft: SPACING.xs,
  },
  messageText: {
    fontSize: 16, 
    lineHeight: 24,
  },
  userText: {
    color: '#FFFFFF',
  },
  aiText: {
    color: THEME.textPrimary,
  },
  emergencyMessageText: {
    color: THEME.emergency,
    fontWeight: '500',
  },
  timestamp: {
    fontSize: 12, 
    marginTop: SPACING.xs,
  },
  userTimestamp: {
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'right',
  },
  aiTimestamp: {
    color: THEME.textSecondary,
  },
  typingMessageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  typingBubble: {
    backgroundColor: THEME.aiMessage,
    paddingHorizontal: SPACING.lg, 
    paddingVertical: SPACING.md, 
    borderRadius: 20,
    borderBottomLeftRadius: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  typingText: {
    fontSize: 14, 
    color: THEME.textSecondary,
    marginRight: SPACING.sm,
  },
  typingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  typingDot: {
    width: 8, 
    height: 8, 
    borderRadius: 4,
    backgroundColor: THEME.textSecondary,
  },
  quickActions: {
    borderTopWidth: 1,
    borderTopColor: '#E9ECEF',
    borderBottomWidth: 1,
    borderBottomColor: '#E9ECEF',
    backgroundColor: THEME.background,
    maxHeight: 80, 
  },
  quickActionsContent: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md, 
    alignItems: 'center',
  },
  quickAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16, 
    paddingVertical: 12, 
    borderRadius: 8, 
    marginRight: 12, 
    borderWidth: 1,
    borderColor: '#D1D5DB',
    minWidth: 100,
    height: 44,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 3,
    overflow: 'visible',
  },
  quickActionText: {
    fontSize: 14, 
    color: '#000000',
    fontWeight: 'bold',
    marginLeft: 8,
    textAlign: 'center',
  },
  inputContainer: {
    padding: SPACING.lg, 
    backgroundColor: THEME.card,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: THEME.background,
    borderRadius: 28, 
    paddingHorizontal: SPACING.lg, 
    paddingVertical: SPACING.md, 
    borderWidth: 2, 
    borderColor: '#E9ECEF',
  },
  input: {
    flex: 1,
    fontSize: 16, 
    color: THEME.textPrimary,
    maxHeight: 120, 
    paddingTop: SPACING.md, 
  },
  sendButton: {
    width: 48, 
    height: 48, 
    borderRadius: 24,
    backgroundColor: THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: SPACING.md, 
    shadowColor: THEME.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 4,
  },
  sendDisabled: {
    opacity: 0.5,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.lg, 
    paddingVertical: SPACING.md, 
    backgroundColor: '#FFF3CD',
    borderTopWidth: 1,
    borderTopColor: '#FFEEBA',
  },
  footerText: {
    fontSize: 13, 
    color: '#856404',
    marginLeft: SPACING.sm, 
    fontWeight: '500',
  },
});