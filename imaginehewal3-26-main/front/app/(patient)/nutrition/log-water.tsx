// app/(patient)/nutrition/log-water.tsx
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNutrition } from '../../../contexts/NutritionContext';
import { useToast } from '../../../contexts/ToastContext';
import { theme } from '../../../constants/theme';

const WATER_AMOUNTS = [250, 500, 750, 1000, 1500, 2000];

export default function LogWaterScreen() {
  const router = useRouter();
  const { todayNutrition, updateWaterIntake } = useNutrition();
  const { showToast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedAmount, setSelectedAmount] = useState<number | null>(null);

  const handleLogWater = async (amount: number) => {
    if (amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a positive amount of water');
      return;
    }

    setLoading(true);
    try {
      const newAmount = todayNutrition.waterIntake + amount;
      await updateWaterIntake(newAmount);

      showToast({
        message: `Logged ${amount}ml of water!`,
        type: 'success',
        duration: 3000,
      });

      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (error) {
      showToast({
        message: 'Failed to log water. Please try again.',
        type: 'error',
        duration: 3000,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCustomSubmit = () => {
    if (!customAmount.trim()) {
      Alert.alert('Missing Amount', 'Please enter a custom amount');
      return;
    }

    const amount = parseInt(customAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid positive number');
      return;
    }

    handleLogWater(amount);
  };

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
          <Text style={styles.title}>Log Water</Text>
          <View style={{ width: 40 }} />
        </View>

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Current Intake</Text>
              <LinearGradient
                colors={['#E0F2FE', '#BAE6FD']}
                style={styles.currentIntake}
              >
                <View style={styles.waterIconContainer}>
                  <Ionicons name="water" size={40} color="#0ea5e9" />
                </View>
                <View style={styles.intakeInfo}>
                  <Text style={styles.intakeAmount}>{todayNutrition.waterIntake}ml</Text>
                  <Text style={styles.intakeGoal}>Goal: {todayNutrition.waterGoal}ml</Text>
                </View>
                <View style={styles.intakeProgress}>
                  <Text style={styles.progressText}>
                    {Math.round((todayNutrition.waterIntake / todayNutrition.waterGoal) * 100)}%
                  </Text>
                  <Text style={styles.progressLabel}>Complete</Text>
                </View>
              </LinearGradient>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Quick Add</Text>
              <Text style={styles.sectionDescription}>Tap to log a glass of water</Text>
              
              <View style={styles.waterGrid}>
                {WATER_AMOUNTS.map((amount) => (
                  <TouchableOpacity
                    key={amount}
                    style={[
                      styles.waterButton,
                      selectedAmount === amount && styles.waterButtonSelected,
                    ]}
                    onPress={() => setSelectedAmount(amount)}
                    disabled={loading}
                    activeOpacity={0.7}
                  >
                    <Ionicons 
                      name="water-outline" 
                      size={24} 
                      color={selectedAmount === amount ? '#fff' : '#0ea5e9'} 
                    />
                    <Text style={[
                      styles.waterButtonText,
                      selectedAmount === amount && styles.waterButtonTextSelected,
                    ]}>
                      {amount}ml
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Custom Amount</Text>
              <View style={styles.customInputContainer}>
                <TextInput
                  style={styles.customInput}
                  placeholder="Enter amount"
                  placeholderTextColor={theme.COLORS.textTertiary}
                  value={customAmount}
                  onChangeText={setCustomAmount}
                  keyboardType="number-pad"
                  editable={!loading}
                />
                <Text style={styles.inputUnit}>ml</Text>
              </View>
              
              <TouchableOpacity
                style={[styles.customButton, loading && styles.customButtonDisabled]}
                onPress={handleCustomSubmit}
                disabled={loading}
                activeOpacity={0.8}
              >
                <Text style={styles.customButtonText}>Log Custom Amount</Text>
              </TouchableOpacity>
            </View>

            {selectedAmount && (
              <TouchableOpacity
                style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                onPress={() => handleLogWater(selectedAmount)}
                disabled={loading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#0ea5e9', '#0284c7']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.submitGradient}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="checkmark-circle" size={20} color="#fff" />
                      <Text style={styles.submitButtonText}>
                        Log {selectedAmount}ml Water
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => router.back()}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <View style={{ height: 40 }} />
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
  content: {
    flex: 1,
    paddingHorizontal: theme.SPACING.lg,
  },
  section: {
    marginBottom: theme.SPACING.xl,
  },
  sectionTitle: {
    ...theme.TYPOGRAPHY.h3,
    fontSize: 18,
    color: theme.COLORS.textPrimary,
    marginBottom: theme.SPACING.sm,
  },
  sectionDescription: {
    ...theme.TYPOGRAPHY.body,
    color: theme.COLORS.textSecondary,
    marginBottom: theme.SPACING.md,
  },
  currentIntake: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.SPACING.lg,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    ...theme.SHADOWS.small,
  },
  waterIconContainer: {
    width: 60,
    height: 60,
    borderRadius: theme.LAYOUT.borderRadius.full,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  intakeInfo: {
    flex: 1,
    marginLeft: 16,
  },
  intakeAmount: {
    fontSize: 28,
    fontWeight: '700',
    color: '#0ea5e9',
  },
  intakeGoal: {
    ...theme.TYPOGRAPHY.body,
    color: theme.COLORS.textSecondary,
    marginTop: 4,
  },
  intakeProgress: {
    alignItems: 'flex-end',
  },
  progressText: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.COLORS.textPrimary,
  },
  progressLabel: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textSecondary,
    marginTop: 2,
  },
  waterGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  waterButton: {
    flex: 1,
    minWidth: '30%',
    alignItems: 'center',
    paddingVertical: 16,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    borderWidth: 1,
    borderColor: '#0ea5e9',
    backgroundColor: theme.COLORS.card,
    ...theme.SHADOWS.small,
  },
  waterButtonSelected: {
    backgroundColor: '#0ea5e9',
  },
  waterButtonText: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#0ea5e9',
  },
  waterButtonTextSelected: {
    color: '#fff',
  },
  customInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.COLORS.border,
    paddingHorizontal: 16,
  },
  customInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: theme.COLORS.textPrimary,
  },
  inputUnit: {
    fontSize: 16,
    color: theme.COLORS.textSecondary,
    marginLeft: 12,
  },
  customButton: {
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#0ea5e9',
  },
  customButtonDisabled: {
    opacity: 0.6,
  },
  customButtonText: {
    color: '#0ea5e9',
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    borderRadius: theme.LAYOUT.borderRadius.lg,
    marginBottom: theme.SPACING.md,
    ...theme.SHADOWS.medium,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    gap: 8,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  cancelButtonText: {
    color: theme.COLORS.textSecondary,
    fontSize: 16,
    fontWeight: '500',
  },
});