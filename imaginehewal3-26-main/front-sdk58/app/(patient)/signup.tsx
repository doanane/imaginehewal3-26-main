import React, { useState } from 'react';
import {
  StyleSheet,
  Platform,
  Alert,
  // Import Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { ActivityIndicator, Ionicons, KeyboardAvoidingView, ScrollView, Text, TextInput, TouchableOpacity, View } from '../../components/themed';
// import { useToast } from '../../contexts/ToastContext'; // Uncomment if you have this

export default function SignupScreen() {
  const router = useRouter();
  const { signupPatient, isLoading } = useAuth();
  // const { showToast } = useToast(); // Uncomment if you have this
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
    phone_number: '',
  });
  
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    username: '',
  });

  const validateForm = () => {
    const newErrors = { email: '', password: '', confirmPassword: '', username: '' };
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

    if (!formData.username.trim()) {
      newErrors.username = 'Username is required';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSignup = async () => {
    if (!validateForm()) return;
    
    try {
      const signupData = {
        email: formData.email,
        password: formData.password,
        username: formData.username,
        phone_number: formData.phone_number || undefined,
      };
      
      const result = await signupPatient(signupData);
      
      if (result.success) {
        // Success Logic
        if (Platform.OS === 'web') {
          window.alert('Account created! Please verify your email.');
        } else {
          Alert.alert('Success', 'Account created! Please verify your email.');
        }
        router.replace('/(auth)/verify-email');
      } else {
        // Failure logic (this was missing/silent before)
        const errorMessage = result.message || 'Could not create account';
        
        console.log('Signup failed ui message:', errorMessage);

        if (Platform.OS === 'web') {
          window.alert(errorMessage); // Shows "Email already registered"
        } else {
          Alert.alert('Signup Failed', errorMessage);
        }
      }
    } catch (error: any) {
      // Catch unexpected crashes
      const crashMessage = error.message || 'An unexpected error occurred';
      if (Platform.OS === 'web') {
        window.alert(crashMessage);
      } else {
        Alert.alert('Error', crashMessage);
      }
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#333" />
          </TouchableOpacity>
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Join HEWAL3 and start your health journey</Text>
        </View>

        <View style={styles.form}>
          {/* Username */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Username *</Text>
            <View style={[styles.inputContainer, errors.username ? styles.inputError : null]}>
              <Ionicons name="person-outline" size={20} color="#666" />
              <TextInput
                style={styles.input}
                placeholder="Choose a username"
                value={formData.username}
                onChangeText={(text) => setFormData({ ...formData, username: text })}
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>
            {errors.username ? <Text style={styles.errorText}>{errors.username}</Text> : null}
          </View>

          {/* Email */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email Address *</Text>
            <View style={[styles.inputContainer, errors.email ? styles.inputError : null]}>
              <Ionicons name="mail-outline" size={20} color="#666" />
              <TextInput
                style={styles.input}
                placeholder="Enter your email"
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>
            {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
          </View>

          {/* Phone (Optional) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number (Optional)</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="call-outline" size={20} color="#666" />
              <TextInput
                style={styles.input}
                placeholder="+233..."
                value={formData.phone_number}
                onChangeText={(text) => setFormData({ ...formData, phone_number: text })}
                keyboardType="phone-pad"
                editable={!isLoading}
              />
            </View>
          </View>

          {/* Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Password *</Text>
            <View style={[styles.inputContainer, errors.password ? styles.inputError : null]}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" />
              <TextInput
                style={styles.input}
                placeholder="Min 8 characters"
                value={formData.password}
                onChangeText={(text) => setFormData({ ...formData, password: text })}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!isLoading}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color="#666" />
              </TouchableOpacity>
            </View>
            {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
          </View>

          {/* Confirm Password */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Confirm Password *</Text>
            <View style={[styles.inputContainer, errors.confirmPassword ? styles.inputError : null]}>
              <Ionicons name="lock-closed-outline" size={20} color="#666" />
              <TextInput
                style={styles.input}
                placeholder="Confirm your password"
                value={formData.confirmPassword}
                onChangeText={(text) => setFormData({ ...formData, confirmPassword: text })}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
                editable={!isLoading}
              />
            </View>
            {errors.confirmPassword ? <Text style={styles.errorText}>{errors.confirmPassword}</Text> : null}
          </View>

          <TouchableOpacity
            style={[styles.signupButton, isLoading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="person-add-outline" size={20} color="#fff" />
                <Text style={styles.signupButtonText}>Create Account</Text>
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
            onPress={() => router.push('/(patient)/login')}
            disabled={isLoading}
          >
            <Text style={styles.loginButtonText}>Sign In</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>By signing up, you agree to our Terms and Privacy Policy</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  scrollContainer: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 60, paddingBottom: 40 },
  header: { marginBottom: 30 },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  title: { fontSize: 32, fontWeight: 'bold', color: '#1a1a1a', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666' },
  form: { flex: 1 },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 8 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8f9fa', borderRadius: 10, paddingHorizontal: 16, height: 52, borderWidth: 1, borderColor: '#e9ecef' },
  input: { flex: 1, marginLeft: 12, fontSize: 16, color: '#333', height: '100%' },
  inputError: { borderColor: '#dc3545' },
  errorText: { fontSize: 12, color: '#dc3545', marginTop: 4, marginLeft: 4 },
  signupButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#007bff', height: 52, borderRadius: 10, marginBottom: 24, marginTop: 10 },
  buttonDisabled: { opacity: 0.7 },
  signupButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  divider: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#e9ecef' },
  dividerText: { marginHorizontal: 16, fontSize: 14, color: '#666' },
  loginButton: { height: 52, borderRadius: 10, borderWidth: 1, borderColor: '#007bff', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  loginButtonText: { color: '#007bff', fontSize: 16, fontWeight: '600' },
  footer: { alignItems: 'center', marginTop: 32, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  footerText: { fontSize: 12, color: '#666', textAlign: 'center' },
});