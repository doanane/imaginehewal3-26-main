import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { theme } from '../../constants/theme';

export default function ChatScreen() {
  const router = useRouter();
  
  // Messages State
  const [conversations] = useState([
    {
      id: '1',
      type: 'caregiver',
      name: 'Sarah Morgan (Daughter)',
      lastMessage: 'How are you feeling today, Dad?',
      time: '10:30 AM',
      unread: 2
    },
    {
      id: '2',
      type: 'doctor',
      name: 'Dr. James Wilson',
      lastMessage: 'Your blood pressure readings look good this week.',
      time: 'Yesterday',
      unread: 0
    },
    {
      id: '3',
      type: 'caregiver',
      name: 'John Morgan (Son)',
      lastMessage: 'Did you take your medication this morning?',
      time: '2 days ago',
      unread: 0
    }
  ]);
  
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messageInput, setMessageInput] = useState('');

  const handleBack = () => {
    if (selectedConversation) {
      setSelectedConversation(null);
    } else {
      router.push('/(patient)/home');
    }
  };

  // Conversation Detail View
  if (selectedConversation) {
    const conv = conversations.find(c => c.id === selectedConversation);
    const isDoctor = conv?.type === 'doctor';
    
    return (
      <View style={styles.container}>
        <StatusBar barStyle="dark-content" />
        <LinearGradient
          colors={[theme.COLORS.background, '#E0F2FE', '#DBEAFE']}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        
        <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={theme.COLORS.textPrimary} />
            </TouchableOpacity>
            <View style={styles.headerCenter}>
              <Text style={styles.headerName}>{conv?.name}</Text>
              <Text style={styles.headerStatus}>
                {isDoctor ? '🩺 Healthcare Provider' : '👤 Caregiver'}
              </Text>
            </View>
            <View style={styles.headerRight}>
              <TouchableOpacity style={styles.iconButton}>
                <Ionicons name="call-outline" size={22} color={theme.COLORS.primary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Messages */}
          <ScrollView 
            style={styles.messagesContainer} 
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.messageReceived}>
              <Text style={styles.messageText}>{conv?.lastMessage}</Text>
              <Text style={styles.messageTime}>{conv?.time}</Text>
            </View>
            
            {!isDoctor && (
              <View style={styles.messageSent}>
                <Text style={[styles.messageText, { color: 'white' }]}>
                  Thank you! I'm feeling much better today.
                </Text>
                <Text style={[styles.messageTime, { color: 'rgba(255,255,255,0.7)' }]}>9:45 AM</Text>
              </View>
            )}
          </ScrollView>

          {/* Input */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 10 : 0}
          >
            {isDoctor ? (
              <View style={styles.disabledInput}>
                <Ionicons name="lock-closed" size={20} color={theme.COLORS.textSecondary} />
                <Text style={styles.disabledInputText}>
                  You can view but not reply to doctor messages
                </Text>
              </View>
            ) : (
              <View style={styles.inputContainer}>
                <TextInput 
                  style={styles.input} 
                  placeholder="Type your message..." 
                  placeholderTextColor={theme.COLORS.textTertiary}
                  value={messageInput}
                  onChangeText={setMessageInput}
                  multiline
                />
                <TouchableOpacity style={styles.sendButton}>
                  <Ionicons name="send" size={20} color="white" />
                </TouchableOpacity>
              </View>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    );
  }

  // Conversation List View
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        colors={[theme.COLORS.background, '#E0F2FE', '#DBEAFE']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Messages</Text>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="create-outline" size={24} color={theme.COLORS.primary} />
          </TouchableOpacity>
        </View>

        {/* Conversations List */}
        <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
          <Text style={styles.sectionLabel}>Your Conversations</Text>
          
          {conversations.map((conv) => (
            <TouchableOpacity 
              key={conv.id} 
              style={styles.conversationCard}
              onPress={() => setSelectedConversation(conv.id)}
              activeOpacity={0.7}
            >
              <View style={[
                styles.conversationIcon, 
                { backgroundColor: conv.type === 'doctor' ? theme.COLORS.primaryMuted : theme.COLORS.successLight }
              ]}>
                <MaterialCommunityIcons 
                  name={conv.type === 'doctor' ? 'stethoscope' : 'account-heart'} 
                  size={24} 
                  color={conv.type === 'doctor' ? theme.COLORS.primary : theme.COLORS.success} 
                />
              </View>
              
              <View style={styles.conversationContent}>
                <Text style={styles.conversationName}>{conv.name}</Text>
                <Text style={styles.conversationMessage} numberOfLines={1}>
                  {conv.lastMessage}
                </Text>
              </View>

              <View style={styles.conversationRight}>
                <Text style={styles.conversationTime}>{conv.time}</Text>
                {conv.unread > 0 && (
                  <View style={styles.unreadBadge}>
                    <Text style={styles.unreadText}>{conv.unread}</Text>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.COLORS.background,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.SPACING.lg,
    paddingVertical: theme.SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: theme.LAYOUT.borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.SHADOWS.small,
  },
  headerTitle: {
    ...theme.TYPOGRAPHY.h3,
    color: theme.COLORS.textPrimary,
    flex: 1,
    marginLeft: theme.SPACING.md,
  },
  headerCenter: {
    flex: 1,
    marginLeft: theme.SPACING.md,
  },
  headerName: {
    ...theme.TYPOGRAPHY.bodyMedium,
    color: theme.COLORS.textPrimary,
  },
  headerStatus: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textSecondary,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    gap: theme.SPACING.md,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: theme.LAYOUT.borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.SHADOWS.small,
  },
  
  // List View
  listContainer: {
    flex: 1,
    padding: theme.SPACING.lg,
  },
  sectionLabel: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textSecondary,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: theme.SPACING.md,
  },
  conversationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.COLORS.card,
    padding: theme.SPACING.md,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    marginBottom: theme.SPACING.md,
    ...theme.SHADOWS.small,
  },
  conversationIcon: {
    width: 56,
    height: 56,
    borderRadius: theme.LAYOUT.borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  },
  conversationContent: {
    flex: 1,
    marginLeft: theme.SPACING.md,
  },
  conversationName: {
    ...theme.TYPOGRAPHY.bodyMedium,
    color: theme.COLORS.textPrimary,
    marginBottom: 4,
  },
  conversationMessage: {
    ...theme.TYPOGRAPHY.caption,
    color: theme.COLORS.textSecondary,
  },
  conversationRight: {
    alignItems: 'flex-end',
  },
  conversationTime: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textSecondary,
    marginBottom: 5,
  },
  unreadBadge: {
    backgroundColor: theme.COLORS.primary,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadText: {
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },
  
  // Detail View
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: theme.SPACING.lg,
    paddingTop: theme.SPACING.lg,
  },
  messageReceived: {
    backgroundColor: theme.COLORS.card,
    padding: theme.SPACING.md,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    borderBottomLeftRadius: 4,
    maxWidth: '80%',
    marginBottom: theme.SPACING.md,
    alignSelf: 'flex-start',
    ...theme.SHADOWS.small,
  },
  messageSent: {
    backgroundColor: theme.COLORS.primary,
    padding: theme.SPACING.md,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    borderBottomRightRadius: 4,
    maxWidth: '80%',
    marginBottom: theme.SPACING.md,
    alignSelf: 'flex-end',
    ...theme.SHADOWS.small,
  },
  messageText: {
    ...theme.TYPOGRAPHY.body,
    fontSize: 15,
    color: theme.COLORS.textPrimary,
  },
  messageTime: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textSecondary,
    marginTop: 5,
    alignSelf: 'flex-end',
  },
  
  // Input
  inputContainer: {
    flexDirection: 'row',
    padding: theme.SPACING.md,
    backgroundColor: theme.COLORS.card,
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 30 : theme.SPACING.md,
    ...theme.SHADOWS.medium, // Add shadow to input bar
  },
  input: {
    flex: 1,
    backgroundColor: theme.COLORS.background,
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 10,
    fontSize: 15,
    maxHeight: 100,
    color: theme.COLORS.textPrimary,
  },
  sendButton: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: theme.COLORS.primary,
    marginLeft: 10,
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.SHADOWS.small,
  },
  disabledInput: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: theme.SPACING.lg,
    backgroundColor: theme.COLORS.background,
    borderTopWidth: 1,
    borderTopColor: theme.COLORS.separator,
    paddingBottom: Platform.OS === 'ios' ? 30 : theme.SPACING.lg,
  },
  disabledInputText: {
    flex: 1,
    color: theme.COLORS.textSecondary,
    fontSize: 14,
  },
});
