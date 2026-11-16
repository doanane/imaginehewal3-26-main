import { useRouter } from 'expo-router';
import React, { useRef, useState } from 'react';
import { Modal, StyleSheet } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { theme } from '../../constants/theme';
import { Ionicons, MaterialCommunityIcons, Text, TextInput, TouchableOpacity, View } from '../../components/themed';

export default function VerifyScreen() {
  const router = useRouter();
  const safeBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };
  
  const [otp, setOtp] = useState(['', '', '', '']);
  const [isError, setIsError] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const inputs = useRef<Array<React.ComponentRef<typeof TextInput> | null>>([]);

  const [fullName, setFullName] = useState('');
  const [patientId, setPatientId] = useState('');
  const [relationship, setRelationship] = useState('');

  const handleInput = (text: string, index: number) => {
    setIsError(false);
    const newOtp = [...otp];
    newOtp[index] = text;
    setOtp(newOtp);
    if (text && index < 3) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleVerify = () => {
    const code = otp.join('');
    if (code.length === 4) {
      setShowProfileModal(true);
    } else {
      setIsError(true);
    }
  };

  const handleFinalSubmit = () => {
    setShowProfileModal(false);
    router.replace('/(caregiver)/caregiver-home');
  };

  return (
    <View style={styles.container}>
      {/* OTP VERIFICATION VIEW */}
      <TouchableOpacity style={styles.backButton} onPress={safeBack}>
        <Ionicons name="arrow-back" size={24} color={theme.COLORS.textPrimary} />
      </TouchableOpacity>

      <Text style={styles.title}>Enter OTP</Text>
      <Text style={styles.subtitle}>
        We&apos;ve sent an OTP code to your email,{"\n"}
        <Text style={styles.emailText}>user@example.com</Text>
      </Text>

      <View style={styles.otpContainer}>
        {otp.map((digit, i) => (
          <TextInput
            key={i}
            ref={(ref) => { if (ref) inputs.current[i] = ref; }}
            style={[
              styles.otpBox, 
              isError && styles.otpBoxError
            ]}
            keyboardType="number-pad"
            maxLength={1}
            onChangeText={(text) => handleInput(text, i)}
            value={digit}
            onKeyPress={({ nativeEvent }) => {
              if (nativeEvent.key === 'Backspace' && !digit && i > 0) {
                inputs.current[i - 1]?.focus();
              }
            }}
          />
        ))}
      </View>

      <Text style={styles.timer}>
        We will resend the code in <Text style={styles.timerHighlight}>59 s</Text>
      </Text>

      <TouchableOpacity 
        style={styles.mainButton}
        onPress={handleVerify}
      >
        <Text style={styles.buttonText}>Verify</Text>
      </TouchableOpacity>

      {/* COMPLETE PROFILE MODAL */}
      <Modal visible={showProfileModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <Animated.View entering={FadeInDown} style={styles.modalContent}>
            <View style={styles.modalAccent} />
            
            <MaterialCommunityIcons name="account-circle-outline" size={50} color={theme.COLORS.primary} />
            <Text style={styles.modalTitle}>Complete Profile</Text>
            <Text style={styles.modalSubtitle}>Help us connect you to your patient correctly.</Text>

            <View style={styles.form}>
              <Text style={styles.inputLabel}>Your Full Name</Text>
              <TextInput 
                style={styles.modalInput} 
                placeholder="Dr. John Doe"
                placeholderTextColor={theme.COLORS.textTertiary}
                value={fullName}
                onChangeText={setFullName}
              />

              <Text style={styles.inputLabel}>Patient ID</Text>
              <TextInput 
                style={styles.modalInput} 
                placeholder="HEW-XXXX"
                placeholderTextColor={theme.COLORS.textTertiary}
                value={patientId}
                onChangeText={setPatientId}
              />

              <Text style={styles.inputLabel}>Relation to Patient</Text>
              <View style={styles.chipRow}>
                {['Family', 'Friend', 'Health Expert'].map((role) => (
                  <TouchableOpacity 
                    key={role} 
                    onPress={() => setRelationship(role)}
                    style={[
                      styles.chip, 
                      relationship === role && styles.chipActive
                    ]}
                  >
                    <Text style={[
                      styles.chipText, 
                      relationship === role && styles.chipTextActive
                    ]}>
                      {role}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity 
              style={[styles.mainButton, styles.modalButton]}
              onPress={handleFinalSubmit}
            >
              <Text style={styles.buttonText}>Complete Setup</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>

      <TouchableOpacity style={styles.footerLink} onPress={() => router.push('/(auth)/login')}>
        <Text style={styles.footerText}>Already have an account? <Text style={styles.footerBold}>Sign In</Text></Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: theme.COLORS.card, 
    padding: theme.SPACING.lg, 
    paddingTop: theme.SPACING.xxl + theme.SPACING.sm, 
    alignItems: 'center',
  },
  backButton: { 
    alignSelf: 'flex-start', 
    width: 40, 
    height: 40, 
    borderRadius: theme.LAYOUT.borderRadius.full, 
    backgroundColor: theme.COLORS.background, 
    alignItems: 'center', 
    justifyContent: 'center', 
    marginBottom: theme.SPACING.xxl,
  },
  title: { 
    ...theme.TYPOGRAPHY.h1,
    color: theme.COLORS.textPrimary,
    marginBottom: theme.SPACING.sm,
  },
  subtitle: { 
    ...theme.TYPOGRAPHY.body,
    color: theme.COLORS.textSecondary, 
    textAlign: 'center', 
    marginBottom: theme.SPACING.xxl, 
    lineHeight: 22,
  },
  emailText: {
    color: theme.COLORS.primary,
    fontWeight: '500',
  },
  otpContainer: { 
    flexDirection: 'row', 
    gap: theme.SPACING.md, 
    marginBottom: theme.SPACING.xl,
  },
  otpBox: { 
    width: 65, 
    height: 65, 
    borderRadius: theme.LAYOUT.borderRadius.md, 
    borderWidth: 1.5, 
    borderColor: theme.COLORS.separator, 
    textAlign: 'center', 
    fontSize: 24, 
    fontWeight: '700', 
    backgroundColor: theme.COLORS.background,
    color: theme.COLORS.textPrimary,
  },
  otpBoxError: {
    borderColor: theme.COLORS.primary,
    color: theme.COLORS.primary,
  },
  timer: { 
    ...theme.TYPOGRAPHY.body,
    color: theme.COLORS.textTertiary, 
    marginBottom: theme.SPACING.xxl,
  },
  timerHighlight: {
    color: theme.COLORS.info,
  },
  mainButton: { 
    width: '100%', 
    height: 55, 
    borderRadius: theme.LAYOUT.borderRadius.md, 
    backgroundColor: theme.COLORS.primary,
    alignItems: 'center', 
    justifyContent: 'center',
  },
  buttonText: { 
    color: theme.COLORS.textOnPrimary, 
    ...theme.TYPOGRAPHY.button,
  },
  footerLink: { 
    marginTop: theme.SPACING.lg,
  },
  footerText: { 
    ...theme.TYPOGRAPHY.body,
    color: theme.COLORS.textSecondary,
  },
  footerBold: {
    color: theme.COLORS.primary,
    fontWeight: '700',
  },
  // Profile Modal Styles
  modalOverlay: { 
    flex: 1, 
    backgroundColor: theme.COLORS.overlay, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  modalContent: { 
    width: '90%', 
    backgroundColor: theme.COLORS.card, 
    borderRadius: theme.LAYOUT.borderRadius.xl, 
    padding: theme.SPACING.lg, 
    alignItems: 'center', 
    overflow: 'hidden',
  },
  modalAccent: { 
    height: 6, 
    width: '120%', 
    position: 'absolute', 
    top: 0,
    backgroundColor: theme.COLORS.primary,
  },
  modalTitle: { 
    ...theme.TYPOGRAPHY.h2,
    color: theme.COLORS.textPrimary,
    marginTop: theme.SPACING.md,
  },
  modalSubtitle: { 
    ...theme.TYPOGRAPHY.body,
    textAlign: 'center', 
    color: theme.COLORS.textSecondary, 
    marginBottom: theme.SPACING.lg,
  },
  form: { 
    width: '100%',
  },
  inputLabel: { 
    ...theme.TYPOGRAPHY.caption,
    fontWeight: '600', 
    color: theme.COLORS.textPrimary, 
    marginBottom: theme.SPACING.sm, 
    marginTop: theme.SPACING.md,
  },
  modalInput: { 
    width: '100%', 
    height: 50, 
    backgroundColor: theme.COLORS.background, 
    borderRadius: theme.LAYOUT.borderRadius.md, 
    paddingHorizontal: theme.SPACING.md, 
    ...theme.TYPOGRAPHY.body,
    color: theme.COLORS.textPrimary,
  },
  chipRow: { 
    flexDirection: 'row', 
    gap: theme.SPACING.sm, 
    marginTop: theme.SPACING.xs,
  },
  chip: { 
    paddingVertical: theme.SPACING.sm, 
    paddingHorizontal: theme.SPACING.md, 
    borderRadius: theme.LAYOUT.borderRadius.xl, 
    backgroundColor: theme.COLORS.background, 
    borderWidth: 1, 
    borderColor: theme.COLORS.separator,
  },
  chipActive: {
    backgroundColor: theme.COLORS.primary,
    borderColor: theme.COLORS.primary,
  },
  chipText: { 
    ...theme.TYPOGRAPHY.caption,
    color: theme.COLORS.textSecondary, 
    fontWeight: '500',
  },
  chipTextActive: {
    color: theme.COLORS.textOnPrimary,
  },
  modalButton: {
    marginTop: theme.SPACING.lg,
  },
});
