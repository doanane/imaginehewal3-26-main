import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ActivityIndicator,
} from 'react-native';
import api from '../../services/api';
import { theme, GRADIENTS } from '../../constants/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState({ email: '' });
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const validate = () => {
    const newErrors = { email: '' };
    let isValid = true;

    if (!email.trim()) {
      newErrors.email = 'Email is required';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSendReset = async () => {
    if (!validate()) return;

    try {
      setLoading(true);
      await api.forgotPassword(email);
      setSent(true);
      Alert.alert('Success', 'Password reset link sent to your email');
    } catch (error) {
      Alert.alert('Error', 'Failed to send reset link. Please try again.');
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
            <Text style={styles.title}>Forgot Password?</Text>
            <Text style={styles.subtitle}>
              Enter your email address and we'll send you a link to reset your password
            </Text>
          </View>

          {/* Glass Form Card */}
          <BlurView intensity={theme.BLUR.intensity} tint={theme.BLUR.tint} style={styles.blurContainer}>
            <View style={styles.formCard}>
              {sent ? (
                <View style={styles.successContainer}>
                  <View style={styles.successIcon}>
                    <Ionicons name="checkmark-circle" size={64} color={theme.COLORS.success} />
                  </View>
                  <Text style={styles.successTitle}>Check Your Email</Text>
                  <Text style={styles.successText}>
                    We've sent a password reset link to {email}
                  </Text>
                  <TouchableOpacity
                    style={styles.backToLoginButton}
                    onPress={() => router.push('/(auth)/login')}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.backToLoginText}>Back to Login</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email Address</Text>
                    <View style={[styles.inputContainer, errors.email ? styles.inputError : null]}>
                      <Ionicons name="mail-outline" size={20} color={theme.COLORS.textSecondary} />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your email"
                        placeholderTextColor={theme.COLORS.textTertiary}
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        editable={!loading}
                      />
                    </View>
                    {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
                  </View>

                  <TouchableOpacity
                    style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                    onPress={handleSendReset}
                    disabled={loading}
                    activeOpacity={0.8}
                  >
                    {loading ? (
                      <ActivityIndicator color={theme.COLORS.textOnPrimary} />
                    ) : (
                      <Text style={styles.submitButtonText}>Send Reset Link</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity 
                    onPress={() => router.back()}
                    style={styles.backLink}
                  >
                    <Text style={styles.backText}>Back to Login</Text>
                  </TouchableOpacity>
                </>
              )}
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
    lineHeight: 24,
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
  inputError: {
    borderColor: theme.COLORS.danger,
    borderWidth: 1.5,
  },
  errorText: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.danger,
    marginTop: theme.SPACING.xs,
  },
  submitButton: {
    backgroundColor: theme.COLORS.primary,
    height: theme.LAYOUT.buttonHeight,
    borderRadius: theme.LAYOUT.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.SPACING.lg,
    ...theme.SHADOWS.medium,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    ...theme.TYPOGRAPHY.button,
    color: theme.COLORS.textOnPrimary,
  },
  backLink: {
    marginTop: theme.SPACING.lg,
    alignItems: 'center',
  },
  backText: {
    ...theme.TYPOGRAPHY.captionMedium,
    color: theme.COLORS.info,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: theme.SPACING.lg,
  },
  successIcon: {
    marginBottom: theme.SPACING.lg,
  },
  successTitle: {
    ...theme.TYPOGRAPHY.h2,
    color: theme.COLORS.textPrimary,
    marginBottom: theme.SPACING.sm,
  },
  successText: {
    ...theme.TYPOGRAPHY.body,
    color: theme.COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: theme.SPACING.xl,
  },
  backToLoginButton: {
    backgroundColor: theme.COLORS.primary,
    height: theme.LAYOUT.buttonHeight,
    borderRadius: theme.LAYOUT.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.SPACING.xl,
    ...theme.SHADOWS.medium,
  },
  backToLoginText: {
    ...theme.TYPOGRAPHY.button,
    color: theme.COLORS.textOnPrimary,
  },
});
