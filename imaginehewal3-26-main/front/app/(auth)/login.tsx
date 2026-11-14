import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ImageBackground,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { FadeInDown, FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { theme, BACKGROUND_OVERLAY } from '../../constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({ email: '', password: '' });

  const validateForm = () => {
    const newErrors = { email: '', password: '' };
    let isValid = true;

    if (!email.trim()) {
      newErrors.email = 'Email is required';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Please enter a valid email';
      isValid = false;
    }

    if (!password) {
      newErrors.password = 'Password is required';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;
    
    try {
      const result = await login(email, password);
      if (result.success) {
        Alert.alert('Success', result.message || 'Welcome back!');
      } else {
        Alert.alert('Login Failed', result.message || 'Invalid email or password');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An error occurred');
    }
  };

  const handleForgotPassword = () => {
    router.push('/(auth)/forgot-password');
  };

  const handleSignup = () => {
    router.push('/onboarding');
  };

  const handleTestConnection = () => {
    router.push('/connection-test');
  };

  return (
    <ImageBackground
      source={require('../../assets/images/background.png')}
      style={styles.gradient}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <Animated.View entering={FadeIn.duration(800)} style={styles.header}>
            <TouchableOpacity onPress={() => router.push('/onboarding')} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={theme.COLORS.textOnDark} />
            </TouchableOpacity>
            <View style={styles.logoContainer}>
              <Image 
                source={require('../../assets/images/logo.png')} 
                style={styles.loginLogo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to continue your health journey</Text>
          </Animated.View>

          {/* Glass Form Card */}
          <Animated.View entering={FadeInDown.delay(200).springify()}>
            <BlurView intensity={50} tint="light" style={styles.blurContainer}>
            <View style={styles.formCard}>
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
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                </View>
                {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
                <View style={[styles.inputContainer, errors.password ? styles.inputError : null]}>
                  <Ionicons name="lock-closed-outline" size={20} color={theme.COLORS.textSecondary} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your password"
                    placeholderTextColor={theme.COLORS.textTertiary}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    editable={!isLoading}
                  />
                  <TouchableOpacity 
                    onPress={() => setShowPassword(!showPassword)}
                    disabled={isLoading}
                  >
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={theme.COLORS.textSecondary}
                    />
                  </TouchableOpacity>
                </View>
                {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
              </View>

              <TouchableOpacity
                style={styles.forgotPassword}
                onPress={handleForgotPassword}
                disabled={isLoading}
              >
                <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.loginButton, isLoading && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator color={theme.COLORS.textOnPrimary} />
                ) : (
                  <Text style={styles.loginButtonText}>Sign In</Text>
                )}
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Don't have an account?</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={[styles.signupButton, isLoading && styles.buttonDisabled]}
                onPress={handleSignup}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <Text style={styles.signupButtonText}>Create New Account</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.connectionTest}
                onPress={handleTestConnection}
                disabled={isLoading}
              >
                <Text style={styles.connectionTestText}>Connection Test</Text>
              </TouchableOpacity>
            </View>
          </BlurView>
          </Animated.View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>HEWAL3 Health Management System</Text>
            <Text style={styles.footerVersion}>v3.0.0</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: BACKGROUND_OVERLAY,
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
    alignItems: 'center',
  },
  logoContainer: {
    width: 90,
    height: 90,
    marginBottom: theme.SPACING.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginLogo: {
    width: 80,
    height: 80,
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
    fontSize: 34,
    fontWeight: '800',
    color: theme.COLORS.textOnDark,
    marginBottom: theme.SPACING.sm,
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    ...theme.TYPOGRAPHY.body,
    color: '#FFFFFF',
    fontWeight: '500',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
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
    backgroundColor: 'rgba(173, 0, 35, 0.04)',
    borderRadius: theme.LAYOUT.borderRadius.lg,
    paddingHorizontal: theme.SPACING.md + 4,
    height: 56,
    borderWidth: 2,
    borderColor: 'rgba(173, 0, 35, 0.15)',
    ...theme.SHADOWS.small,
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
    marginLeft: theme.SPACING.xs,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: theme.SPACING.lg,
  },
  forgotPasswordText: {
    ...theme.TYPOGRAPHY.captionMedium,
    color: theme.COLORS.info,
  },
  loginButton: {
    backgroundColor: theme.COLORS.primary,
    height: 56,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.SPACING.lg,
    ...theme.SHADOWS.large,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    ...theme.TYPOGRAPHY.button,
    color: theme.COLORS.textOnPrimary,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.SPACING.lg,
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
  signupButton: {
    height: 56,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    borderWidth: 2,
    borderColor: theme.COLORS.primary,
    backgroundColor: 'rgba(173, 0, 35, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.SPACING.md,
    ...theme.SHADOWS.small,
  },
  signupButtonText: {
    ...theme.TYPOGRAPHY.button,
    color: theme.COLORS.primary,
  },
  connectionTest: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
  },
  connectionTestText: {
    ...theme.TYPOGRAPHY.caption,
    color: theme.COLORS.textSecondary,
    textDecorationLine: 'underline',
    marginLeft: 5,
  },
  footer: {
    alignItems: 'center',
    marginTop: theme.SPACING.xl,
    paddingTop: theme.SPACING.lg,
  },
  footerText: {
    ...theme.TYPOGRAPHY.caption,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: theme.SPACING.xs,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  footerVersion: {
    ...theme.TYPOGRAPHY.small,
    color: 'rgba(255, 255, 255, 0.5)',
  },
});