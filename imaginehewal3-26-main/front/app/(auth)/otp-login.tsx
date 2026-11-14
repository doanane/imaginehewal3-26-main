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

export default function OtpLoginScreen() {
  const router = useRouter();
  const safeBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [otpSent, setOtpSent] = useState(false);

  const requestOtp = async () => {
    if (!/\S+@\S+\.\S+/.test(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email');
      return;
    }
    try {
      setRequesting(true);
      await api.requestOTP(email);
      setOtpSent(true);
      Alert.alert('OTP Sent', 'Check your email for the OTP');
    } catch (err) {
      Alert.alert('Error', 'Failed to request OTP');
      console.error(err);
    } finally {
      setRequesting(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp.trim()) {
      Alert.alert('Invalid OTP', 'Please enter the OTP');
      return;
    }
    try {
      setVerifying(true);
      const res = await api.verifyOTP(email, otp);
      Alert.alert('Verified', typeof res === 'string' ? res : 'OTP verified');
      router.replace('/(auth)/login');
    } catch (err) {
      Alert.alert('Error', 'Failed to verify OTP');
      console.error(err);
    } finally {
      setVerifying(false);
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
            <TouchableOpacity onPress={safeBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={theme.COLORS.textOnDark} />
            </TouchableOpacity>
            <Text style={styles.title}>Login with OTP</Text>
            <Text style={styles.subtitle}>Request and verify OTP via email</Text>
          </View>

          {/* Glass Form Card */}
          <BlurView intensity={theme.BLUR.intensity} tint={theme.BLUR.tint} style={styles.blurContainer}>
            <View style={styles.formCard}>
              {/* Email Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail-outline" size={20} color={theme.COLORS.textSecondary} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    placeholderTextColor={theme.COLORS.textTertiary}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!requesting && !verifying}
                  />
                </View>
              </View>

              <TouchableOpacity 
                style={[
                  styles.submitButton, 
                  requesting && styles.submitButtonDisabled,
                  otpSent && styles.submitButtonSuccess
                ]} 
                onPress={requestOtp} 
                disabled={requesting}
                activeOpacity={0.8}
              >
                {requesting ? (
                  <ActivityIndicator color={theme.COLORS.textOnPrimary} />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {otpSent ? 'Resend OTP' : 'Request OTP'}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Enter OTP below</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* OTP Input */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>OTP Code</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="key-outline" size={20} color={theme.COLORS.textSecondary} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter 6-digit OTP"
                    placeholderTextColor={theme.COLORS.textTertiary}
                    value={otp}
                    onChangeText={setOtp}
                    autoCapitalize="none"
                    keyboardType="number-pad"
                    maxLength={6}
                    editable={!verifying}
                  />
                </View>
              </View>

              <TouchableOpacity 
                style={[styles.verifyButton, verifying && styles.submitButtonDisabled]} 
                onPress={verifyOtp} 
                disabled={verifying}
                activeOpacity={0.8}
              >
                {verifying ? (
                  <ActivityIndicator color={theme.COLORS.textOnPrimary} />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color={theme.COLORS.textOnPrimary} />
                    <Text style={styles.verifyButtonText}>Verify & Continue</Text>
                  </>
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
    marginBottom: theme.SPACING.md,
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
    backgroundColor: theme.COLORS.info,
    height: theme.LAYOUT.buttonHeight,
    borderRadius: theme.LAYOUT.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.SPACING.sm,
    ...theme.SHADOWS.small,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonSuccess: {
    backgroundColor: theme.COLORS.success,
  },
  submitButtonText: {
    ...theme.TYPOGRAPHY.button,
    color: theme.COLORS.textOnPrimary,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.SPACING.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.COLORS.separator,
  },
  dividerText: {
    marginHorizontal: theme.SPACING.md,
    ...theme.TYPOGRAPHY.caption,
    color: theme.COLORS.textSecondary,
  },
  verifyButton: {
    backgroundColor: theme.COLORS.primary,
    height: theme.LAYOUT.buttonHeight,
    borderRadius: theme.LAYOUT.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.SPACING.sm,
    marginTop: theme.SPACING.sm,
    ...theme.SHADOWS.medium,
  },
  verifyButtonText: {
    ...theme.TYPOGRAPHY.button,
    color: theme.COLORS.textOnPrimary,
  },
});
