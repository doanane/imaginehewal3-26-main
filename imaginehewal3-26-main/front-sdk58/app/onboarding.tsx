import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import Animated, { FadeIn, FadeOut, Layout } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { theme, BACKGROUND_OVERLAY } from '../constants/theme';
import { DepthSurface } from '../components/ui/motion';
import { Image, ImageBackground, Ionicons, ScrollView, Text, TouchableOpacity, View } from '../components/themed';

export default function OnboardingScreen() {
  const [role, setRole] = useState<'none' | 'patient' | 'caregiver'>('none');
  const router = useRouter();

  return (
    <ImageBackground
      source={require('../assets/images/background.png')}
      style={styles.gradient}
      resizeMode="cover"
    >
      <View style={styles.overlay}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.container}>
         <View style={styles.topGroup}>
          {/* Back to the role choice: a real row above the card, so it can never sit on top of it */}
          {role !== 'none' && (
            <Animated.View entering={FadeIn.duration(300)} style={styles.backRow}>
              <TouchableOpacity style={styles.backPill} onPress={() => setRole('none')} accessibilityRole="button" accessibilityLabel="Back to choosing who you are" activeOpacity={0.75}>
                <Ionicons name="chevron-back" size={20} color={theme.COLORS.textOnDark} />
                <Text style={styles.backText}>Back</Text>
              </TouchableOpacity>
            </Animated.View>
          )}

          {/* Intro Text - Disappears when a role is selected */}
          {role === 'none' && (
            <Animated.View entering={FadeIn.duration(700)} exiting={FadeOut.duration(220)} style={styles.introContainer}>
                <Image 
                  source={require('../assets/images/logo.png')} 
                  style={styles.logoImage}
                  resizeMode="contain"
                />
              <Text style={styles.introText}>
                Empowering patients and caregivers with smart health tracking, emergency support, and secure connection.
              </Text>
            </Animated.View>
          )}

          <View style={styles.roleContainer}>
            
            {/* Premium Patient Card */}
            {(role === 'none' || role === 'patient') && (
              <Animated.View entering={FadeIn.delay(180).duration(500)} layout={Layout.springify()} style={styles.section}>
                <DepthSurface label="Patient account" onPress={() => setRole('patient')} style={styles.premiumCard}>
                  <BlurView intensity={20} tint="light" style={styles.cardBlur}>
                    <View style={[styles.cardContent, role === 'patient' && styles.selectedCard]}>
                      <View style={styles.cardHeader}>
                        <View style={[styles.premiumIcon, role === 'patient' && styles.selectedPremiumIcon]}>
                          <Ionicons 
                            name="person" 
                            size={32} 
                            color={role === 'patient' ? theme.COLORS.textOnPrimary : theme.COLORS.primary} 
                          />
                        </View>
                        <View style={styles.cardTextContainer}>
                          <Text style={[styles.cardTitle, role === 'patient' && styles.selectedCardTitle]}>
                            I&apos;m a Patient
                          </Text>
                          <Text style={[styles.cardSubtitle, role === 'patient' && styles.selectedCardSubtitle]}>
                            Track your health journey
                          </Text>
                        </View>
                      </View>
                    </View>
                  </BlurView>
                </DepthSurface>
                
                {role === 'patient' && (
                  <Animated.Text entering={FadeIn.delay(200)} style={styles.supportingText}>
                    Your health is seamlessly tracked and managed by Hewal3 - from daily habits to emergency alerts, meal tracking, and direct connection with doctors or caregivers.
                  </Animated.Text>
                )}
              </Animated.View>
            )}

            {/* Premium Caregiver Card */}
            {(role === 'none' || role === 'caregiver') && (
              <Animated.View entering={FadeIn.delay(300).duration(500)} layout={Layout.springify()} style={styles.section}>
                <DepthSurface label="Caregiver account" onPress={() => setRole('caregiver')} style={styles.premiumCard}>
                  <BlurView intensity={20} tint="light" style={styles.cardBlur}>
                    <View style={[styles.cardContent, role === 'caregiver' && styles.selectedCard]}>
                      <View style={styles.cardHeader}>
                        <View style={[styles.premiumIcon, role === 'caregiver' && styles.selectedPremiumIcon]}>
                          <Ionicons 
                            name="people" 
                            size={32} 
                            color={role === 'caregiver' ? theme.COLORS.textOnPrimary : theme.COLORS.primary} 
                          />
                        </View>
                        <View style={styles.cardTextContainer}>
                          <Text style={[styles.cardTitle, role === 'caregiver' && styles.selectedCardTitle]}>
                            I&apos;m a Caregiver
                          </Text>
                          <Text style={[styles.cardSubtitle, role === 'caregiver' && styles.selectedCardSubtitle]}>
                            Support and monitor patients
                          </Text>
                        </View>
                      </View>
                    </View>
                  </BlurView>
                </DepthSurface>
                
                {role === 'caregiver' && (
                  <Animated.Text entering={FadeIn.delay(200)} style={styles.supportingText}>
                    Monitor patients&apos; wellbeing with daily insights, receive instant alerts, and communicate securely through Hewal3.
                  </Animated.Text>
                )}
              </Animated.View>
            )}
          </View>
         </View>

          {/* Next Button - Only appears after selection */}
          {role !== 'none' && (
            <Animated.View entering={FadeIn.duration(500)} style={styles.footer}>
              <DepthSurface label="Continue to sign up" onPress={() => {
                  if (role === 'patient') {
                    router.push({
                      pathname: '/(auth)/signup',
                      params: { userType: 'patient' }
                    });
                  } else if (role === 'caregiver') {
                    router.push({
                      pathname: '/(auth)/signup',
                      params: { userType: 'caregiver' }
                    });
                  }
                }} style={styles.nextButton}>
                  <Text style={styles.nextText}>Continue to Sign Up</Text>
                  <View style={styles.nextArrow}>
                    <Ionicons name="arrow-forward" size={20} color={theme.COLORS.primary} />
                  </View>
              </DepthSurface>
              
              {/* Already have an account? */}
              <TouchableOpacity 
                style={styles.loginLink}
                onPress={() => {
                  router.push('/(auth)/login');
                }}
              >
                <Text style={styles.loginText}>
                  Already have an account? <Text style={styles.loginBold}>Log In</Text>
                </Text>
              </TouchableOpacity>
            </Animated.View>
          )}

        </View>
      </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    padding: theme.SPACING.lg,
    paddingTop: theme.SPACING.xxl + theme.SPACING.xl,
    paddingBottom: theme.SPACING.xl,
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: '100%',
  },
  introContainer: {
    alignItems: 'center',
    marginBottom: theme.SPACING.md,
    marginTop: theme.SPACING.lg,
  },
  logoPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: theme.LAYOUT.borderRadius.xl,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.SPACING.lg,
  },
  logoImage: {
    width: 120,
    height: 120,
    marginBottom: theme.SPACING.xl,
  },
  introTitle: {
    ...theme.TYPOGRAPHY.h1,
    color: theme.COLORS.textOnDark,
    marginBottom: theme.SPACING.md,
  },
  introText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 26,
    paddingHorizontal: theme.SPACING.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    paddingVertical: theme.SPACING.md,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    overflow: 'hidden',
  },
  roleContainer: { 
    width: '100%',
    maxWidth: 400,
  },
  section: { 
    marginBottom: theme.SPACING.lg,
    width: '100%',
  },
  
  // Premium Card Styles
  premiumCard: {
    width: '100%',
    borderRadius: theme.LAYOUT.borderRadius.xl,
    overflow: 'hidden',
    ...theme.SHADOWS.large,
  },
  cardBlur: {
    overflow: 'hidden',
    borderRadius: theme.LAYOUT.borderRadius.xl,
  },
  cardContent: {
    backgroundColor: 'rgba(255, 250, 250, 0.95)',
    paddingVertical: theme.SPACING.xl,
    paddingHorizontal: theme.SPACING.lg,
    borderRadius: theme.LAYOUT.borderRadius.xl,
    borderWidth: 2,
    borderColor: 'rgba(255, 220, 220, 0.6)',
  },
  selectedCard: {
    backgroundColor: theme.COLORS.primary,
    borderColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 3,
    ...theme.SHADOWS.colored(theme.COLORS.primary),
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.SPACING.md,
  },
  premiumIcon: {
    width: 64,
    height: 64,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    backgroundColor: 'rgba(11, 110, 110, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.SHADOWS.medium,
  },
  selectedPremiumIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  cardTextContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: theme.COLORS.primary,
    marginBottom: theme.SPACING.xs / 2,
  },
  selectedCardTitle: {
    color: theme.COLORS.textOnPrimary,
  },
  cardSubtitle: {
    fontSize: 15,
    fontWeight: '500',
    color: theme.COLORS.textSecondary,
  },
  selectedCardSubtitle: {
    color: 'rgba(255, 255, 255, 0.9)',
  },
  
  supportingText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '500',
    marginTop: theme.SPACING.md,
    lineHeight: 22,
    textAlign: 'center',
    paddingHorizontal: theme.SPACING.md,
    paddingVertical: theme.SPACING.sm,
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    borderRadius: theme.LAYOUT.borderRadius.md,
    overflow: 'hidden',
  },
  footer: { 
    marginTop: theme.SPACING.xl, 
    alignItems: 'center',
    width: '100%',
    maxWidth: 400,
  },
  nextButton: {
    backgroundColor: theme.COLORS.card,
    paddingHorizontal: theme.SPACING.xl,
    paddingVertical: theme.SPACING.lg + 4,
    borderRadius: theme.LAYOUT.borderRadius.xl,
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.SPACING.md,
    marginBottom: theme.SPACING.md,
    ...theme.SHADOWS.large,
    borderWidth: 2,
    borderColor: 'rgba(11, 110, 110, 0.2)',
  },
  nextText: { 
    color: theme.COLORS.textPrimary, 
    ...theme.TYPOGRAPHY.button,
  },
  nextArrow: {
    width: 32,
    height: 32,
    borderRadius: theme.LAYOUT.borderRadius.full,
    backgroundColor: theme.COLORS.primaryMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginLink: {
    paddingVertical: theme.SPACING.md,
  },
  loginText: {
    color: 'rgba(255, 255, 255, 0.8)',
    ...theme.TYPOGRAPHY.body,
    textAlign: 'center',
  },
  loginBold: {
    fontWeight: '700',
    color: theme.COLORS.textOnDark,
    textDecorationLine: 'underline',
  },
  topGroup: {
    width: '100%',
    alignItems: 'center',
  },
  backRow: {
    width: '100%',
    maxWidth: 400,
    alignItems: 'flex-start',
    marginBottom: theme.SPACING.md,
  },
  backPill: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    paddingLeft: theme.SPACING.sm,
    paddingRight: theme.SPACING.md + 2,
    borderRadius: theme.LAYOUT.borderRadius.full,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    gap: 2,
  },
  backText: {
    color: theme.COLORS.textOnDark,
    fontSize: 16,
    fontWeight: '600',
  },

});