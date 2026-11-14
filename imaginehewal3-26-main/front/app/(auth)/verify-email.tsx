import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import { theme, GRADIENTS } from '../../constants/theme';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);

  const handleResendVerification = async () => {
    try {
      setLoading(true);
      if (user?.email) {
        await api.resendVerification(user.email);
      }
      setVerificationSent(true);
    } catch (error) {
      console.error('Error resending verification:', error);
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
      <View style={styles.container}>
        {/* Glass Card */}
        <BlurView intensity={theme.BLUR.intensity} tint={theme.BLUR.tint} style={styles.blurContainer}>
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <View style={styles.iconCircle}>
                <Ionicons name="mail" size={48} color={theme.COLORS.info} />
              </View>
            </View>

            <Text style={styles.title}>Verify Your Email</Text>
            <Text style={styles.description}>
              We've sent a verification link to
            </Text>
            <Text style={styles.email}>{user?.email}</Text>

            <Text style={styles.instructions}>
              Please check your email and click the verification link to complete your signup.
            </Text>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled, verificationSent && styles.buttonSuccess]}
              onPress={handleResendVerification}
              disabled={loading || verificationSent}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={theme.COLORS.textOnPrimary} />
              ) : (
                <>
                  <Ionicons 
                    name={verificationSent ? "checkmark-circle" : "mail-outline"} 
                    size={20} 
                    color={theme.COLORS.textOnPrimary} 
                  />
                  <Text style={styles.buttonText}>
                    {verificationSent ? 'Verification Sent!' : 'Resend Verification Email'}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.backLink}
              onPress={() => router.push('/(auth)/login')}
            >
              <Text style={styles.backLinkText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </BlurView>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: theme.SPACING.lg,
  },
  blurContainer: {
    borderRadius: theme.LAYOUT.borderRadius.xl,
    overflow: 'hidden',
    width: '100%',
    maxWidth: 400,
  },
  content: {
    backgroundColor: theme.COLORS.cardGlass,
    alignItems: 'center',
    padding: theme.SPACING.xl,
    borderRadius: theme.LAYOUT.borderRadius.xl,
  },
  iconContainer: {
    marginBottom: theme.SPACING.lg,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: theme.LAYOUT.borderRadius.full,
    backgroundColor: theme.COLORS.infoLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    ...theme.TYPOGRAPHY.h2,
    color: theme.COLORS.textPrimary,
    marginBottom: theme.SPACING.sm,
    textAlign: 'center',
  },
  description: {
    ...theme.TYPOGRAPHY.body,
    color: theme.COLORS.textSecondary,
    textAlign: 'center',
  },
  email: {
    ...theme.TYPOGRAPHY.bodyMedium,
    color: theme.COLORS.textPrimary,
    marginBottom: theme.SPACING.md,
    textAlign: 'center',
  },
  instructions: {
    ...theme.TYPOGRAPHY.caption,
    color: theme.COLORS.textTertiary,
    marginBottom: theme.SPACING.xl,
    textAlign: 'center',
    lineHeight: 22,
  },
  button: {
    backgroundColor: theme.COLORS.primary,
    paddingVertical: theme.SPACING.md,
    paddingHorizontal: theme.SPACING.xl,
    borderRadius: theme.LAYOUT.borderRadius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.SPACING.sm,
    width: '100%',
    ...theme.SHADOWS.medium,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonSuccess: {
    backgroundColor: theme.COLORS.success,
  },
  buttonText: {
    ...theme.TYPOGRAPHY.button,
    color: theme.COLORS.textOnPrimary,
  },
  backLink: {
    marginTop: theme.SPACING.lg,
  },
  backLinkText: {
    ...theme.TYPOGRAPHY.captionMedium,
    color: theme.COLORS.info,
  },
});
