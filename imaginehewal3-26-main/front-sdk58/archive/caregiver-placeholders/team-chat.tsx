// front/app/(caregiver)/team-chat.tsx
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Dimensions,
  Platform,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GRADIENTS, theme } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { FlatList, Image, Ionicons, KeyboardAvoidingView, LinearGradient, StatusBar, Text, TextInput, TouchableOpacity, View } from '../../components/themed';

const { width } = Dimensions.get('window');

interface ChatMessage {
  id: number;
  sender: string;
  sender_id: string;
  sender_role: string;
  message: string;
  timestamp: string;
  is_own: boolean;
  avatar?: string;
}

interface TeamMember {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  status: 'online' | 'offline' | 'away';
  last_seen?: string;
}

export default function TeamChatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 1,
      sender: 'Dr. Sarah Johnson',
      sender_id: 'D001',
      sender_role: 'Doctor',
      message: 'Patient in Room 302 needs immediate attention. Vitals are showing concerning trends.',
      timestamp: new Date(Date.now() - 3600000).toISOString(),
      is_own: false,
    },
    {
      id: 2,
      sender: user?.full_name || 'You',
      sender_id: user?.id?.toString() || 'C001',
      sender_role: 'Caregiver',
      message: 'On my way. Will check vitals and update you immediately.',
      timestamp: new Date(Date.now() - 3300000).toISOString(),
      is_own: true,
    },
    {
      id: 3,
      sender: 'Nurse Michael Brown',
      sender_id: 'N001',
      sender_role: 'Nurse',
      message: "I've prepared the necessary equipment. Blood pressure cuff and thermometer are ready.",
      timestamp: new Date(Date.now() - 3000000).toISOString(),
      is_own: false,
    },
  ]);

  const teamMembers: TeamMember[] = [
    {
      id: 'D001',
      name: 'Dr. Sarah Johnson',
      role: 'Cardiologist',
      status: 'online',
      avatar: 'https://ui-avatars.com/api/?name=Sarah+Johnson&background=1E40AF&color=fff'
    },
    {
      id: 'N001',
      name: 'Nurse Michael Brown',
      role: 'Senior Nurse',
      status: 'online',
      avatar: 'https://ui-avatars.com/api/?name=Michael+Brown&background=10B981&color=fff'
    },
    {
      id: 'N002',
      name: 'Nurse Emily Davis',
      role: 'Nurse',
      status: 'away',
      avatar: 'https://ui-avatars.com/api/?name=Emily+Davis&background=F59E0B&color=fff'
    },
  ];

  const handleSend = () => {
    if (message.trim()) {
      const newMessage: ChatMessage = {
        id: messages.length + 1,
        sender: user?.full_name || 'You',
        sender_id: user?.id?.toString() || 'C001',
        sender_role: 'Caregiver',
        message: message.trim(),
        timestamp: new Date().toISOString(),
        is_own: true,
      };
      setMessages([...messages, newMessage]);
      setMessage('');
    }
  };

  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => (
    <Animated.View
      entering={FadeInDown.delay(index * 20)}
      style={[styles.messageContainer, item.is_own && styles.ownMessageContainer]}
    >
      {!item.is_own && (
        <Image
          source={{ uri: item.avatar || `https://ui-avatars.com/api/?name=${item.sender}&background=${theme.COLORS.primary.replace('#', '')}&color=fff` }}
          style={styles.messageAvatar}
        />
      )}
      <View style={[styles.messageBubble, item.is_own && styles.ownMessageBubble]}>
        {!item.is_own && (
          <View style={styles.senderInfo}>
            <Text style={styles.senderName}>{item.sender}</Text>
            <Text style={styles.senderRole}>{item.sender_role}</Text>
          </View>
        )}
        <Text style={[styles.messageText, item.is_own && styles.ownMessageText]}>
          {item.message}
        </Text>
        <Text style={[styles.messageTime, item.is_own && styles.ownMessageTime]}>
          {new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </Animated.View>
  );

  const renderTeamMember = (member: TeamMember, index: number) => (
    <Animated.View
      key={member.id}
      entering={FadeInDown.delay(index * 30)}
      style={styles.teamMemberItem}
    >
      <TouchableOpacity style={styles.teamMemberContent}>
        <View style={styles.memberAvatarContainer}>
          <Image source={{ uri: member.avatar }} style={styles.memberAvatar} />
          <View style={[
            styles.statusIndicator,
            { backgroundColor: 
              member.status === 'online' ? theme.COLORS.success : 
              member.status === 'away' ? theme.COLORS.warning : 
              theme.COLORS.textTertiary 
            }
          ]} />
        </View>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{member.name}</Text>
          <Text style={styles.memberRole}>{member.role}</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.COLORS.textTertiary} />
      </TouchableOpacity>
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
            <Text style={styles.headerTitle}>Care Team</Text>
            <Text style={styles.headerSubtitle}>{teamMembers.filter(m => m.status === 'online').length} online</Text>
          </View>
          <TouchableOpacity style={styles.infoButton}>
            <Ionicons name="information-circle-outline" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Team Members Horizontal List */}
      <View style={styles.teamMembersSection}>
        <Text style={styles.teamSectionTitle}>Team Members</Text>
        <FlatList
          horizontal
          data={teamMembers}
          renderItem={({ item, index }) => renderTeamMember(item, index)}
          keyExtractor={(item) => item.id}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.teamMembersList}
        />
      </View>

      {/* Messages */}
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.messagesContainer}
        inverted={false}
      />

      {/* Message Input */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachButton}>
            <Ionicons name="add-circle-outline" size={28} color={theme.COLORS.primary} />
          </TouchableOpacity>
          <TextInput
            style={styles.input}
            placeholder="Type a message..."
            placeholderTextColor={theme.COLORS.textTertiary}
            value={message}
            onChangeText={setMessage}
            multiline
            maxLength={500}
          />
          <TouchableOpacity 
            style={[styles.sendButton, !message.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!message.trim()}
          >
            <Ionicons name="send" size={20} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.COLORS.background,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight ? StatusBar.currentHeight + 10 : 30,
    paddingHorizontal: theme.SPACING.lg,
    paddingBottom: theme.SPACING.md,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  infoButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamMembersSection: {
    backgroundColor: '#FFFFFF',
    paddingVertical: theme.SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.COLORS.border,
  },
  teamSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.COLORS.textPrimary,
    marginBottom: theme.SPACING.sm,
    paddingHorizontal: theme.SPACING.lg,
  },
  teamMembersList: {
    paddingHorizontal: theme.SPACING.lg,
    gap: theme.SPACING.md,
  },
  teamMemberItem: {
    width: 100,
  },
  teamMemberContent: {
    alignItems: 'center',
    gap: theme.SPACING.xs,
  },
  memberAvatarContainer: {
    position: 'relative',
  },
  memberAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: theme.COLORS.primary,
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  memberInfo: {
    alignItems: 'center',
  },
  memberName: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.COLORS.textPrimary,
    textAlign: 'center',
  },
  memberRole: {
    fontSize: 10,
    color: theme.COLORS.textTertiary,
    textAlign: 'center',
  },
  messagesContainer: {
    padding: theme.SPACING.lg,
    gap: theme.SPACING.md,
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.SPACING.sm,
  },
  ownMessageContainer: {
    flexDirection: 'row-reverse',
  },
  messageAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  messageBubble: {
    maxWidth: '70%',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: theme.SPACING.md,
    ...theme.SHADOWS.small,
  },
  ownMessageBubble: {
    backgroundColor: theme.COLORS.primary,
  },
  senderInfo: {
    marginBottom: theme.SPACING.xs,
  },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.COLORS.textPrimary,
  },
  senderRole: {
    fontSize: 10,
    color: theme.COLORS.textTertiary,
  },
  messageText: {
    fontSize: 14,
    color: theme.COLORS.textPrimary,
    lineHeight: 20,
  },
  ownMessageText: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 10,
    color: theme.COLORS.textTertiary,
    marginTop: theme.SPACING.xs,
  },
  ownMessageTime: {
    color: 'rgba(255, 255, 255, 0.8)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: theme.SPACING.md,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: theme.COLORS.border,
    gap: theme.SPACING.sm,
  },
  attachButton: {
    padding: theme.SPACING.xs,
  },
  input: {
    flex: 1,
    backgroundColor: theme.COLORS.background,
    borderRadius: 20,
    paddingHorizontal: theme.SPACING.md,
    paddingVertical: theme.SPACING.sm,
    fontSize: 16,
    color: theme.COLORS.textPrimary,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: theme.COLORS.textTertiary,
    opacity: 0.5,
  },
});
