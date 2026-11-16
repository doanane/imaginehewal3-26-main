import React, { useState } from 'react';
import {
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../../services/api';
import { theme } from '../../../constants/theme';
import { ActivityIndicator, Ionicons, KeyboardAvoidingView, LinearGradient, SafeAreaView, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from '../../../components/themed';

export default function LogHealthScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    steps: '',
    water_intake: '',
    sleep_time: '',
    heart_rate: '',
    blood_pressure: '',
    glucose: '',
    weight: '',
  });

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.steps && !formData.water_intake && !formData.heart_rate) {
      Alert.alert('Error', 'Please enter at least one health metric');
      return;
    }

    try {
      setLoading(true);
      
      const healthData: any = {};
      
      // Add numeric fields
      if (formData.steps) healthData.steps = parseInt(formData.steps);
      if (formData.water_intake) healthData.water_intake = parseInt(formData.water_intake);
      if (formData.sleep_time) healthData.sleep_time = parseFloat(formData.sleep_time);
      if (formData.heart_rate) healthData.heart_rate = parseInt(formData.heart_rate);
      if (formData.glucose) healthData.glucose = parseInt(formData.glucose);
      if (formData.weight) healthData.weight = parseFloat(formData.weight);
      if (formData.blood_pressure) healthData.blood_pressure = formData.blood_pressure;

      await api.addHealthData(healthData);
      
      Alert.alert(
        'Success',
        'Health data logged successfully!',
        [{ text: 'OK', onPress: () => router.back() }]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to log health data');
    } finally {
      setLoading(false);
    }
  };

  const renderInput = (
    label: string,
    value: string,
    key: keyof typeof formData,
    placeholder: string,
    keyboardType: 'default' | 'numeric' | 'decimal-pad' = 'default',
    icon: string
  ) => (
    <View style={styles.inputGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputContainer}>
        <View style={styles.iconContainer}>
          <Ionicons name={icon as any} size={20} color={theme.COLORS.primary} />
        </View>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor={theme.COLORS.textTertiary}
          value={value}
          onChangeText={(text) => setFormData({ ...formData, [key]: text })}
          keyboardType={keyboardType}
          editable={!loading}
        />
      </View>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        colors={[theme.COLORS.background, '#E0F2FE', '#DBEAFE']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />
      
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} disabled={loading} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={theme.COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Log Health Data</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView 
            style={styles.form}
            contentContainerStyle={{ paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionTitle}>Daily Activity</Text>
            
            {renderInput('Steps', formData.steps, 'steps', 'Enter steps taken', 'numeric', 'walk')}
            
            {renderInput('Water Intake (ml)', formData.water_intake, 'water_intake', 'Enter water in ml', 'numeric', 'water')}
            
            {renderInput('Sleep Time (hours)', formData.sleep_time, 'sleep_time', 'e.g., 7.5', 'decimal-pad', 'bed')}
            
            <Text style={styles.sectionTitle}>Vitals</Text>
            
            {renderInput('Heart Rate (BPM)', formData.heart_rate, 'heart_rate', 'Enter heart rate', 'numeric', 'heart')}
            
            {renderInput('Blood Pressure', formData.blood_pressure, 'blood_pressure', 'e.g., 120/80', 'default', 'speedometer')}
            
            {renderInput('Glucose Level', formData.glucose, 'glucose', 'Enter glucose level', 'numeric', 'flask')}
            
            {renderInput('Weight (kg)', formData.weight, 'weight', 'Enter weight', 'decimal-pad', 'scale')}

            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[theme.COLORS.primary, theme.COLORS.primaryDark]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitGradient}
              >
                {loading ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle" size={20} color="#fff" />
                    <Text style={styles.submitButtonText}>Save Health Data</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => router.back()}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.SPACING.lg,
    paddingVertical: theme.SPACING.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: theme.LAYOUT.borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.SHADOWS.small,
  },
  title: {
    ...theme.TYPOGRAPHY.h3,
    color: theme.COLORS.textPrimary,
  },
  form: {
    flex: 1,
    paddingHorizontal: theme.SPACING.lg,
  },
  sectionTitle: {
    ...theme.TYPOGRAPHY.h3,
    fontSize: 18,
    color: theme.COLORS.textPrimary,
    marginTop: theme.SPACING.lg,
    marginBottom: theme.SPACING.md,
  },
  inputGroup: {
    marginBottom: theme.SPACING.md,
  },
  label: {
    ...theme.TYPOGRAPHY.label,
    color: theme.COLORS.textSecondary,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.COLORS.border,
    ...theme.SHADOWS.small,
  },
  iconContainer: {
    padding: theme.SPACING.md,
    borderRightWidth: 1,
    borderRightColor: theme.COLORS.separator,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: theme.SPACING.md,
    fontSize: 16,
    color: theme.COLORS.textPrimary,
  },
  submitButton: {
    marginTop: theme.SPACING.xl,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    ...theme.SHADOWS.medium,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    gap: 10,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: theme.SPACING.sm,
  },
  cancelButtonText: {
    color: theme.COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
});