import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Platform,
  StyleSheet,
} from 'react-native';
import LoadingOverlay from '../../components/LoadingOverlay';
import { useToast } from '../../contexts/ToastContext';
import api from '../../services/api';
import { Ionicons, KeyboardAvoidingView, ScrollView, Text, TextInput, TouchableOpacity, View } from '../../components/themed';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { showToast } = useToast();
  
  const initialEmail = params.email as string || '';
  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResetPassword = async () => {
    if (!email.trim()) {
      showToast('Please enter your email address', 'error');
      return;
    }

    if (!/\S+@\S+\.\S+/.test(email)) {
      showToast('Please enter a valid email address', 'error');
      return;
    }

    try {
      setLoading(true);
      await api.forgotPassword(email);
      setSent(true);
      showToast('Password reset instructions sent to your email', 'success');
    } catch (error: any) {
      showToast(error.message || 'Failed to send reset instructions', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <LoadingOverlay visible={loading} message="Sending reset instructions..." />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView 
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={() => router.back()} 
              style={styles.backButton}
              disabled={loading}
            >
              <Ionicons name="arrow-back" size={24} color="#333" />
            </TouchableOpacity>
            
            <View style={styles.headerContent}>
              <View style={styles.iconContainer}>
                <Ionicons name="key-outline" size={48} color="#007bff" />
              </View>
              <Text style={styles.title}>Reset Password</Text>
              <Text style={styles.subtitle}>
                Enter your email address and we'll send you instructions to reset your password.
              </Text>
            </View>
          </View>

          <View style={styles.form}>
            {sent ? (
              <View style={styles.successCard}>
                <Ionicons name="checkmark-circle" size={48} color="#10b981" />
                <Text style={styles.successTitle}>Check Your Email</Text>
                <Text style={styles.successText}>
                  We've sent password reset instructions to:
                </Text>
                <Text style={styles.emailText}>{email}</Text>
                <Text style={styles.instructions}>
                  Please check your inbox and follow the instructions to reset your password.
                </Text>
                
                <TouchableOpacity 
                  style={styles.resendButton}
                  onPress={handleResetPassword}
                  disabled={loading}
                >
                  <Ionicons name="refresh-outline" size={20} color="#007bff" />
                  <Text style={styles.resendButtonText}>Resend Email</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email Address</Text>
                  <View style={styles.inputContainer}>
                    <Ionicons name="mail-outline" size={20} color="#666" />
                    <TextInput
                      style={styles.input}
                      placeholder="Enter your email"
                      value={email}
                      onChangeText={setEmail}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      editable={!loading}
                    />
                  </View>
                </View>

                <TouchableOpacity 
                  style={[styles.resetButton, loading && styles.buttonDisabled]}
                  onPress={handleResetPassword}
                  disabled={loading}
                >
                  <Ionicons name="paper-plane-outline" size={20} color="#fff" />
                  <Text style={styles.resetButtonText}>
                    {loading ? 'Sending...' : 'Send Reset Instructions'}
                  </Text>
                </TouchableOpacity>
              </>
            )}

            <TouchableOpacity 
              style={[styles.backButtonContainer, loading && styles.buttonDisabled]}
              onPress={() => router.back()}
              disabled={loading}
            >
              <Ionicons name="arrow-back" size={20} color="#666" />
              <Text style={styles.backButtonText}>Back to Login</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Need help? Contact support@hewal3.com</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    marginBottom: 40,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  headerContent: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  form: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  input: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: '#333',
    height: '100%',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#007bff',
    borderRadius: 12,
    height: 52,
    marginBottom: 16,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  successCard: {
    backgroundColor: '#f0f9ff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  successTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#10b981',
    marginTop: 16,
    marginBottom: 8,
  },
  successText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007bff',
    marginBottom: 16,
  },
  instructions: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#007bff',
  },
  resendButtonText: {
    color: '#007bff',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  backButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    marginBottom: 8,
  },
  backButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  footer: {
    alignItems: 'center',
    marginTop: 32,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  footerText: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});