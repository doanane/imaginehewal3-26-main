import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import api from '../../services/api';
import { theme, GRADIENTS } from '../../constants/theme';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = async () => {
    if (!current || !next) {
      Alert.alert('Missing Fields', 'Enter both current and new password');
      return;
    }
    if (next.length < 6) {
      Alert.alert('Weak Password', 'New password must be at least 6 characters');
      return;
    }
    try {
      setLoading(true);
      const res = await api.changePassword(current, next);
      Alert.alert('Success', typeof res === 'string' ? res : 'Password changed');
      router.back();
    } catch (err) {
      Alert.alert('Error', 'Failed to change password');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={GRADIENTS.authBackground}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={styles.container}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={theme.COLORS.textOnDark} />
            </TouchableOpacity>
            <Text style={styles.title}>Change Password</Text>
            <Text style={styles.subtitle}>Update your account password</Text>
          </View>

          {/* Glass Form Card */}
          <BlurView intensity={theme.BLUR.intensity} tint={theme.BLUR.tint} style={styles.blurContainer}>
            <View style={styles.formCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Current Password</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color={theme.COLORS.textSecondary} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter current password"
                    placeholderTextColor={theme.COLORS.textTertiary}
                    value={current}
                    onChangeText={setCurrent}
                    secureTextEntry={!showCurrent}
                    editable={!loading}
                  />
                  <TouchableOpacity onPress={() => setShowCurrent(!showCurrent)}>
                    <Ionicons 
                      name={showCurrent ? 'eye-off-outline' : 'eye-outline'} 
                      size={20} 
                      color={theme.COLORS.textSecondary} 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>New Password</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color={theme.COLORS.textSecondary} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter new password"
                    placeholderTextColor={theme.COLORS.textTertiary}
                    value={next}
                    onChangeText={setNext}
                    secureTextEntry={!showNext}
                    editable={!loading}
                  />
                  <TouchableOpacity onPress={() => setShowNext(!showNext)}>
                    <Ionicons 
                      name={showNext ? 'eye-off-outline' : 'eye-outline'} 
                      size={20} 
                      color={theme.COLORS.textSecondary} 
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.submitButton, loading && styles.submitButtonDisabled]} 
                onPress={handleChange} 
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={theme.COLORS.textOnPrimary} />
                ) : (
                  <Text style={styles.submitButtonText}>Update Password</Text>
                )}
              </TouchableOpacity>
            </View>
          </BlurView>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: theme.SPACING.lg,
    paddingTop: theme.SPACING.xxl + theme.SPACING.md,
    paddingBottom: theme.SPACING.xl,
  },
  header: {
    marginBottom: theme.SPACING.xl,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: theme.LAYOUT.borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.SPACING.lg,
  },
  title: {
    ...theme.TYPOGRAPHY.h1,
    color: theme.COLORS.textOnDark,
    marginBottom: theme.SPACING.sm,
  },
  subtitle: {
    ...theme.TYPOGRAPHY.body,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  blurContainer: {
    borderRadius: theme.LAYOUT.borderRadius.xl,
    overflow: 'hidden',
  },
  formCard: {
    backgroundColor: theme.COLORS.cardGlass,
    padding: theme.SPACING.lg,
    borderRadius: theme.LAYOUT.borderRadius.xl,
  },
  inputGroup: {
    marginBottom: theme.SPACING.lg,
  },
  label: {
    ...theme.TYPOGRAPHY.label,
    color: theme.COLORS.textPrimary,
    marginBottom: theme.SPACING.sm,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.COLORS.inputBackground,
    borderRadius: theme.LAYOUT.borderRadius.md,
    paddingHorizontal: theme.SPACING.md,
    height: theme.LAYOUT.inputHeight,
    borderWidth: 1,
    borderColor: theme.COLORS.border,
  },
  input: {
    flex: 1,
    marginLeft: theme.SPACING.sm,
    ...theme.TYPOGRAPHY.body,
    color: theme.COLORS.textPrimary,
    height: '100%',
  },
  submitButton: {
    backgroundColor: theme.COLORS.primary,
    height: theme.LAYOUT.buttonHeight,
    borderRadius: theme.LAYOUT.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.SPACING.md,
    ...theme.SHADOWS.medium,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    ...theme.TYPOGRAPHY.button,
    color: theme.COLORS.textOnPrimary,
  },
});