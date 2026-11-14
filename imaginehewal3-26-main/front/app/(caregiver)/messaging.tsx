import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { theme } from '../../constants/theme';

export default function CaregiverMessaging() {
  const router = useRouter();
  const [message, setMessage] = useState('');

  // Mock conversation
  const [chatHistory, setChatHistory] = useState([
    { id: 1, sender: 'patient', text: 'I felt a bit dizzy after the 9:00 AM meds.', time: '09:15 AM' },
    { id: 2, sender: 'caregiver', text: 'Did you drink enough water with it? Your hydration score looks low today.', time: '09:20 AM' },
    { id: 3, sender: 'patient', text: 'Just one glass. I will drink more now.', time: '09:22 AM' },
  ]);

  const sendMessage = () => {
    if (message.trim().length === 0) return;
    const newMessage = {
      id: Date.now(),
      sender: 'caregiver',
      text: message,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setChatHistory([...chatHistory, newMessage]);
    setMessage('');
  };

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined} 
      style={styles.container}
    >
      {/* 1. HEADER WITH CONTEXTUAL DATA */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={theme.COLORS.textPrimary} />
        </TouchableOpacity>
        
        <View style={styles.headerInfo}>
          <Text style={styles.patientName}>Alex Morgan</Text>
          <View style={styles.statusRow}>
            <View style={styles.onlineDot} />
            <Text style={styles.statusText}>Active Now</Text>
          </View>
        </View>

        {/* CLINICAL SCORE BADGE */}
        <View style={styles.scoreContainer}>
          <Text style={styles.scoreLabel}>SCORE</Text>
          <Text style={styles.scoreValue}>62</Text>
        </View>
      </View>

      {/* 2. CHAT AREA */}
      <ScrollView 
        contentContainerStyle={styles.chatScroll}
        ref={(ref) => ref?.scrollToEnd({ animated: true })}
      >
        <Text style={styles.dateSeparator}>Today</Text>
        
        {chatHistory.map((msg) => (
          <View 
            key={msg.id} 
            style={[
              styles.messageBubble, 
              msg.sender === 'caregiver' ? styles.caregiverBubble : styles.patientBubble
            ]}
          >
            <Text style={[
              styles.messageText, 
              msg.sender === 'caregiver' ? styles.caregiverText : styles.patientText
            ]}>
              {msg.text}
            </Text>
            <Text style={[
              styles.messageTime, 
              msg.sender === 'caregiver' ? styles.caregiverTime : styles.patientTime
            ]}>
              {msg.time}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* 3. INPUT AREA */}
      <View style={styles.inputWrapper}>
        <TouchableOpacity style={styles.attachBtn}>
          <Ionicons name="add" size={24} color={theme.COLORS.textSecondary} />
        </TouchableOpacity>
        
        <TextInput 
          style={styles.textInput} 
          placeholder="Type a clinical note or message..."
          placeholderTextColor={theme.COLORS.textTertiary}
          multiline
          value={message}
          onChangeText={setMessage}
        />

        <TouchableOpacity 
          style={styles.sendBtn} 
          onPress={sendMessage}
        >
          <Ionicons name="send" size={20} color={theme.COLORS.textOnPrimary} />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: theme.COLORS.background,
  },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingTop: theme.SPACING.xxl + theme.SPACING.sm, 
    paddingHorizontal: theme.SPACING.lg, 
    paddingBottom: theme.SPACING.md, 
    backgroundColor: theme.COLORS.card,
    ...theme.SHADOWS.small,
  },
  headerInfo: { 
    flex: 1, 
    marginLeft: theme.SPACING.md,
  },
  patientName: { 
    ...theme.TYPOGRAPHY.h3,
    color: theme.COLORS.textPrimary,
  },
  statusRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginTop: 2,
  },
  onlineDot: { 
    width: 8, 
    height: 8, 
    borderRadius: theme.LAYOUT.borderRadius.full, 
    backgroundColor: theme.COLORS.success, 
    marginRight: theme.SPACING.xs,
  },
  statusText: { 
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textSecondary,
  },
  
  scoreContainer: { 
    paddingHorizontal: theme.SPACING.sm, 
    paddingVertical: theme.SPACING.xs, 
    borderRadius: theme.LAYOUT.borderRadius.md, 
    borderWidth: 1.5, 
    borderColor: theme.COLORS.primary,
    alignItems: 'center',
  },
  scoreLabel: { 
    fontSize: 8, 
    fontWeight: '700',
    color: theme.COLORS.primary,
  },
  scoreValue: { 
    fontSize: 16, 
    fontWeight: '700',
    color: theme.COLORS.primary,
  },

  chatScroll: { 
    padding: theme.SPACING.lg, 
    paddingBottom: theme.SPACING.xl,
  },
  dateSeparator: { 
    textAlign: 'center', 
    color: theme.COLORS.textTertiary, 
    ...theme.TYPOGRAPHY.small,
    marginBottom: theme.SPACING.lg, 
    textTransform: 'uppercase', 
    letterSpacing: 1,
  },
  
  messageBubble: { 
    maxWidth: '80%', 
    padding: theme.SPACING.sm, 
    borderRadius: theme.LAYOUT.borderRadius.xl, 
    marginBottom: theme.SPACING.md, 
    ...theme.SHADOWS.small,
  },
  patientBubble: { 
    alignSelf: 'flex-start', 
    backgroundColor: theme.COLORS.card, 
    borderBottomLeftRadius: 2,
  },
  caregiverBubble: { 
    alignSelf: 'flex-end', 
    backgroundColor: theme.COLORS.primary, 
    borderBottomRightRadius: 2,
  },
  messageText: { 
    ...theme.TYPOGRAPHY.body,
    lineHeight: 20,
  },
  patientText: { 
    color: theme.COLORS.textPrimary,
  },
  caregiverText: { 
    color: theme.COLORS.textOnPrimary,
  },
  
  messageTime: { 
    ...theme.TYPOGRAPHY.small,
    marginTop: theme.SPACING.xs, 
    alignSelf: 'flex-end',
  },
  patientTime: { 
    color: theme.COLORS.textTertiary,
  },
  caregiverTime: { 
    color: 'rgba(255,255,255,0.7)',
  },

  inputWrapper: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: theme.SPACING.md, 
    backgroundColor: theme.COLORS.card, 
    borderTopWidth: 1, 
    borderTopColor: theme.COLORS.separator,
  },
  attachBtn: { 
    width: 40, 
    height: 40, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  textInput: { 
    flex: 1, 
    backgroundColor: theme.COLORS.background, 
    borderRadius: theme.LAYOUT.borderRadius.xl, 
    paddingHorizontal: theme.SPACING.md, 
    paddingVertical: theme.SPACING.sm, 
    marginHorizontal: theme.SPACING.sm, 
    maxHeight: 100,
    ...theme.TYPOGRAPHY.body,
    color: theme.COLORS.textPrimary,
  },
  sendBtn: { 
    width: 40, 
    height: 40, 
    borderRadius: theme.LAYOUT.borderRadius.full, 
    backgroundColor: theme.COLORS.primary,
    alignItems: 'center', 
    justifyContent: 'center',
  },
});