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

export default function ResetPasswordScreen() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({ password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);

  const validate = () => {
    const newErrors = { password: '', confirmPassword: '' };
    let isValid = true;

    if (!token.trim()) {
      Alert.alert('Reset Token Required', 'Please paste the reset token you received via email.');
      isValid = false;
    }

    if (!password) {
      newErrors.password = 'Password is required';
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
      isValid = false;
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
      isValid = false;
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleResetPassword = async () => {
    if (!validate()) return;

    try {
      setLoading(true);
      await api.resetPassword(token, password);
      Alert.alert('Success', 'Your password has been reset');
      router.replace('/(auth)/login');
    } catch (error) {
      Alert.alert('Error', 'Failed to reset password. Please try again.');
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
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>Create a new secure password</Text>
          </View>

          {/* Glass Form Card */}
          <BlurView intensity={theme.BLUR.intensity} tint={theme.BLUR.tint} style={styles.blurContainer}>
            <View style={styles.formCard}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Reset Token</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="key-outline" size={20} color={theme.COLORS.textSecondary} />
                  <TextInput
                    style={styles.input}
                    placeholder="Paste reset token from email"
                    placeholderTextColor={theme.COLORS.textTertiary}
                    value={token}
                    onChangeText={setToken}
                    autoCapitalize="none"
                    editable={!loading}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>New Password</Text>
                <View style={[styles.inputContainer, errors.password ? styles.inputError : null]}>
                  <Ionicons name="lock-closed-outline" size={20} color={theme.COLORS.textSecondary} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter new password"
                    placeholderTextColor={theme.COLORS.textTertiary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    editable={!loading}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={theme.COLORS.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
                {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={[styles.inputContainer, errors.confirmPassword ? styles.inputError : null]}>
                  <Ionicons name="lock-closed-outline" size={20} color={theme.COLORS.textSecondary} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm password"
                    placeholderTextColor={theme.COLORS.textTertiary}
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                    editable={!loading}
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={theme.COLORS.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
                {errors.confirmPassword ? (
                  <Text style={styles.errorText}>{errors.confirmPassword}</Text>
                ) : null}
              </View>

              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={handleResetPassword}
                disabled={loading}
                activeOpacity={0.8}
              >
                {loading ? (
                  <ActivityIndicator color={theme.COLORS.textOnPrimary} />
                ) : (
                  <Text style={styles.submitButtonText}>Reset Password</Text>
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
});
