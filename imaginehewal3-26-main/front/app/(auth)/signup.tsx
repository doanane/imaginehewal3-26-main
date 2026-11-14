import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
  Switch,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../contexts/AuthContext';
import { theme, BACKGROUND_OVERLAY } from '../../constants/theme';

export default function SignupScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const userType = params.userType as 'patient' | 'caregiver' || 'patient';
  
  const safeBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/onboarding');
  };
  
  const { signupPatient, signupCaregiver, isLoading } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    phone_number: '',
    
    first_name: '',
    last_name: '',
    years_of_experience: '',
    credentials: '',
    specialties: '',
    
    agree_to_terms: false,
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    first_name: '',
    last_name: '',
    terms: '',
  });

  
  useEffect(() => {
    
  }, [userType]);

  const validateForm = () => {
    const newErrors = { 
      email: '', 
      password: '', 
      confirmPassword: '', 
      username: '',
      first_name: '',
      last_name: '',
      terms: '',
    };
    let isValid = true;

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email';
      isValid = false;
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
      isValid = false;
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
      isValid = false;
    }

    if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
      isValid = false;
    }

    if (userType === 'patient') {
      if (!formData.username.trim()) {
        newErrors.username = 'Username is required';
        isValid = false;
      }
    } else if (userType === 'caregiver') {
      if (!formData.first_name.trim()) {
        newErrors.first_name = 'First name is required';
        isValid = false;
      }
      if (!formData.last_name.trim()) {
        newErrors.last_name = 'Last name is required';
        isValid = false;
      }
      if (!formData.agree_to_terms) {
        newErrors.terms = 'You must agree to the terms and conditions';
        isValid = false;
      }
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;
    
    try {
      let result;
      
      if (userType === 'patient') {
        
        const signupData = {
          email: formData.email,
          password: formData.password,
          username: formData.username,
          phone_number: formData.phone_number || undefined,
        };
        
        result = await signupPatient(signupData);
      } else {
        
        const signupData = {
          email: formData.email,
          password: formData.password,

          first_name: formData.first_name,
          last_name: formData.last_name,
          phone_number: formData.phone_number || undefined,
          caregiver_type: 'family',
          experience_years: parseInt(formData.years_of_experience) || undefined,
          agree_to_terms: formData.agree_to_terms,
        };
        
        result = await signupCaregiver(signupData);
      }
      
      if (result.success) {
        Alert.alert('Success', result.message || 'Account created successfully!');
        
      } else {
        Alert.alert('Signup Failed', result.message || 'Could not create account');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'An unexpected error occurred');
    }
  };

  const getTitle = () => {
    return userType === 'patient' ? 'Create Patient Account' : 'Create Caregiver Account';
  };

  const getSubtitle = () => {
    return userType === 'patient' 
      ? 'Join HEWAL3 and start your health journey' 
      : 'Join HEWAL3 to support patients and manage care';
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
          <View style={styles.header}>
            <TouchableOpacity onPress={safeBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={theme.COLORS.textOnDark} />
            </TouchableOpacity>
            <Text style={styles.title}>{getTitle()}</Text>
            <Text style={styles.subtitle}>{getSubtitle()}</Text>
          </View>

          {/* Glass Form Card */}
          <BlurView intensity={theme.BLUR.intensity} tint={theme.BLUR.tint} style={styles.blurContainer}>
            <View style={styles.formCard}>
              {userType === 'patient' ? (
                /* Patient Fields */
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Username *</Text>
                    <View style={[styles.inputContainer, errors.username ? styles.inputError : null]}>
                      <Ionicons name="person-outline" size={20} color={theme.COLORS.textSecondary} />
                      <TextInput
                        style={styles.input}
                        placeholder="Choose a username"
                        placeholderTextColor={theme.COLORS.textTertiary}
                        value={formData.username}
                        onChangeText={(text) => setFormData({ ...formData, username: text })}
                        autoCapitalize="none"
                        editable={!isLoading}
                      />
                    </View>
                    {errors.username ? <Text style={styles.errorText}>{errors.username}</Text> : null}
                  </View>
                </>
              ) : (
                /* Caregiver Fields */
                <>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>First Name *</Text>
                    <View style={[styles.inputContainer, errors.first_name ? styles.inputError : null]}>
                      <Ionicons name="person-outline" size={20} color={theme.COLORS.textSecondary} />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your first name"
                        placeholderTextColor={theme.COLORS.textTertiary}
                        value={formData.first_name}
                        onChangeText={(text) => setFormData({ ...formData, first_name: text })}
                        editable={!isLoading}
                      />
                    </View>
                    {errors.first_name ? <Text style={styles.errorText}>{errors.first_name}</Text> : null}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Last Name *</Text>
                    <View style={[styles.inputContainer, errors.last_name ? styles.inputError : null]}>
                      <Ionicons name="person-outline" size={20} color={theme.COLORS.textSecondary} />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter your last name"
                        placeholderTextColor={theme.COLORS.textTertiary}
                        value={formData.last_name}
                        onChangeText={(text) => setFormData({ ...formData, last_name: text })}
                        editable={!isLoading}
                      />
                    </View>
                    {errors.last_name ? <Text style={styles.errorText}>{errors.last_name}</Text> : null}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Years of Experience</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons name="briefcase-outline" size={20} color={theme.COLORS.textSecondary} />
                      <TextInput
                        style={styles.input}
                        placeholder="0"
                        placeholderTextColor={theme.COLORS.textTertiary}
                        value={formData.years_of_experience}
                        onChangeText={(text) => setFormData({ ...formData, years_of_experience: text })}
                        keyboardType="numeric"
                        editable={!isLoading}
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Credentials (Optional)</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons name="school-outline" size={20} color={theme.COLORS.textSecondary} />
                      <TextInput
                        style={styles.input}
                        placeholder="RN, MD, etc."
                        placeholderTextColor={theme.COLORS.textTertiary}
                        value={formData.credentials}
                        onChangeText={(text) => setFormData({ ...formData, credentials: text })}
                        editable={!isLoading}
                      />
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Specialties (Optional)</Text>
                    <View style={styles.inputContainer}>
                      <Ionicons name="medical-outline" size={20} color={theme.COLORS.textSecondary} />
                      <TextInput
                        style={styles.input}
                        placeholder="Cardiology, Geriatrics, etc."
                        placeholderTextColor={theme.COLORS.textTertiary}
                        value={formData.specialties}
                        onChangeText={(text) => setFormData({ ...formData, specialties: text })}
                        editable={!isLoading}
                      />
                    </View>
                  </View>
                </>
              )}

              {/* Common Fields */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address *</Text>
                <View style={[styles.inputContainer, errors.email ? styles.inputError : null]}>
                  <Ionicons name="mail-outline" size={20} color={theme.COLORS.textSecondary} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    placeholderTextColor={theme.COLORS.textTertiary}
                    value={formData.email}
                    onChangeText={(text) => setFormData({ ...formData, email: text })}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    editable={!isLoading}
                  />
                </View>
                {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone Number (Optional)</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="call-outline" size={20} color={theme.COLORS.textSecondary} />
                  <TextInput
                    style={styles.input}
                    placeholder="+233..."
                    placeholderTextColor={theme.COLORS.textTertiary}
                    value={formData.phone_number}
                    onChangeText={(text) => setFormData({ ...formData, phone_number: text })}
                    keyboardType="phone-pad"
                    editable={!isLoading}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password *</Text>
                <View style={[styles.inputContainer, errors.password ? styles.inputError : null]}>
                  <Ionicons name="lock-closed-outline" size={20} color={theme.COLORS.textSecondary} />
                  <TextInput
                    style={styles.input}
                    placeholder="Min 8 characters"
                    placeholderTextColor={theme.COLORS.textTertiary}
                    value={formData.password}
                    onChangeText={(text) => setFormData({ ...formData, password: text })}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!isLoading}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                    <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.COLORS.textSecondary} />
                  </TouchableOpacity>
                </View>
                {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm Password *</Text>
                <View style={[styles.inputContainer, errors.confirmPassword ? styles.inputError : null]}>
                  <Ionicons name="lock-closed-outline" size={20} color={theme.COLORS.textSecondary} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm your password"
                    placeholderTextColor={theme.COLORS.textTertiary}
                    value={formData.confirmPassword}
                    onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    editable={!isLoading}
                  />
                </View>
                {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
              </View>

              {/* Terms Agreement for Caregiver */}
              {userType === 'caregiver' && (
                <View style={styles.termsContainer}>
                  <View style={styles.termsRow}>
                    <Switch
                      value={formData.agree_to_terms}
                      onValueChange={(value) => setFormData({ ...formData, agree_to_terms: value })}
                      trackColor={{ false: theme.COLORS.separator, true: theme.COLORS.primaryMuted }}
                      thumbColor={formData.agree_to_terms ? theme.COLORS.primary : theme.COLORS.card}
                    />
                    <Text style={styles.termsText}>
                      I agree to the Terms and Conditions and Privacy Policy
                    </Text>
                  </View>
                  {errors.terms ? <Text style={styles.errorText}>{errors.terms}</Text> : null}
                </View>
              )}

              <TouchableOpacity
                style={[styles.signupButton, isLoading && styles.buttonDisabled]}
                onPress={handleSignup}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                {isLoading ? (
                  <ActivityIndicator color={theme.COLORS.textOnPrimary} />
                ) : (
                  <>
                    <Ionicons name="person-add-outline" size={20} color={theme.COLORS.textOnPrimary} />
                    <Text style={styles.signupButtonText}>
                      Create {userType === 'patient' ? 'Patient' : 'Caregiver'} Account
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>Already have an account?</Text>
                <View style={styles.dividerLine} />
              </View>

              <TouchableOpacity
                style={styles.loginButton}
                onPress={() => router.push('/(auth)/login')}
                disabled={isLoading}
                activeOpacity={0.8}
              >
                <Text style={styles.loginButtonText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </BlurView>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>By signing up, you agree to our Terms and Privacy Policy</Text>
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
    marginBottom: theme.SPACING.lg,
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
    marginLeft: theme.SPACING.xs,
  },
  termsContainer: {
    marginBottom: theme.SPACING.lg,
    paddingVertical: theme.SPACING.sm,
  },
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: theme.SPACING.xs,
  },
  termsText: {
    marginLeft: theme.SPACING.sm,
    ...theme.TYPOGRAPHY.caption,
    color: theme.COLORS.textPrimary,
    flex: 1,
  },
  signupButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.SPACING.sm,
    backgroundColor: theme.COLORS.primary,
    height: theme.LAYOUT.buttonHeight,
    borderRadius: theme.LAYOUT.borderRadius.md,
    marginBottom: theme.SPACING.lg,
    marginTop: theme.SPACING.sm,
    ...theme.SHADOWS.medium,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  signupButtonText: {
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
  loginButton: {
    height: theme.LAYOUT.buttonHeight,
    borderRadius: theme.LAYOUT.borderRadius.md,
    borderWidth: 1.5,
    borderColor: theme.COLORS.primary,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.SPACING.md,
  },
  loginButtonText: {
    ...theme.TYPOGRAPHY.button,
    color: theme.COLORS.primary,
  },
  footer: {
    alignItems: 'center',
    marginTop: theme.SPACING.xl,
    paddingTop: theme.SPACING.lg,
  },
  footerText: {
    ...theme.TYPOGRAPHY.small,
    color: 'rgba(255, 255, 255, 0.9)',
    textAlign: 'center',
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});