import React, { useState } from 'react';
import {
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { theme } from '../../constants/theme';
import { Ionicons, LinearGradient, SafeAreaView, ScrollView, StatusBar, Switch, Text, TouchableOpacity, View } from '../../components/themed';

export default function SettingsScreen() {
  const router = useRouter();
  const [notifications, setNotifications] = useState(true);
  const [darkMode, setDarkMode] = useState(false);
  const [locationTracking, setLocationTracking] = useState(true);

  const menuItems = [
    {
      title: 'Account',
      icon: 'person-outline',
      color: theme.COLORS.info,
      onPress: () => router.push('/(patient)/profile'),
    },
    {
      title: 'Notifications',
      icon: 'notifications-outline',
      color: theme.COLORS.warning,
      onPress: () => router.push('/(patient)/notification-settings'),
    },
    {
      title: 'Privacy & Security',
      icon: 'lock-closed-outline',
      color: theme.COLORS.success,
      onPress: () => router.push('/(patient)/privacy'),
    },
    {
      title: 'Emergency Contacts',
      icon: 'people-outline',
      color: theme.COLORS.danger,
      onPress: () => router.push('/(patient)/emergency-contacts'),
    },
    {
      title: 'Help & Support',
      icon: 'help-circle-outline',
      color: '#8b5cf6',
      onPress: () => router.push('/(patient)/help'),
    },
    {
      title: 'About',
      icon: 'information-circle-outline',
      color: theme.COLORS.textSecondary,
      onPress: () => router.push('/(patient)/about'),
    },
  ];

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
          <TouchableOpacity 
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={theme.COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
          <View style={styles.placeholder} />
        </View>

        <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
          {/* Quick Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Quick Settings</Text>
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIconBg, { backgroundColor: theme.COLORS.warningLight }]}>
                  <Ionicons name="notifications-outline" size={20} color={theme.COLORS.warning} />
                </View>
                <Text style={styles.settingText}>Push Notifications</Text>
              </View>
              <Switch
                value={notifications}
                onValueChange={setNotifications}
                trackColor={{ false: theme.COLORS.separator, true: theme.COLORS.primaryMuted }}
                thumbColor={notifications ? theme.COLORS.primary : theme.COLORS.card}
              />
            </View>
            
            <View style={styles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIconBg, { backgroundColor: 'rgba(139, 92, 246, 0.1)' }]}>
                  <Ionicons name="moon-outline" size={20} color="#8b5cf6" />
                </View>
                <Text style={styles.settingText}>Dark Mode</Text>
              </View>
              <Switch
                value={darkMode}
                onValueChange={setDarkMode}
                trackColor={{ false: theme.COLORS.separator, true: theme.COLORS.primaryMuted }}
                thumbColor={darkMode ? theme.COLORS.primary : theme.COLORS.card}
              />
            </View>
            
            <View style={[styles.settingItem, { borderBottomWidth: 0 }]}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIconBg, { backgroundColor: theme.COLORS.infoLight }]}>
                  <Ionicons name="location-outline" size={20} color={theme.COLORS.info} />
                </View>
                <Text style={styles.settingText}>Location Tracking</Text>
              </View>
              <Switch
                value={locationTracking}
                onValueChange={setLocationTracking}
                trackColor={{ false: theme.COLORS.separator, true: theme.COLORS.primaryMuted }}
                thumbColor={locationTracking ? theme.COLORS.primary : theme.COLORS.card}
              />
            </View>
          </View>

          {/* Menu Items */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>More Settings</Text>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.menuItem,
                  index === menuItems.length - 1 && { borderBottomWidth: 0 }
                ]}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={[styles.menuIcon, { backgroundColor: `${item.color}15` }]}>
                  <Ionicons name={item.icon as any} size={22} color={item.color} />
                </View>
                <Text style={styles.menuText}>{item.title}</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.COLORS.textTertiary} />
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.versionContainer}>
            <Text style={styles.versionText}>HEWAL3 Health Management</Text>
            <Text style={styles.versionNumber}>Version 3.0.0</Text>
          </View>
          <View style={{ height: 40 }} />
        </ScrollView>
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
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    ...theme.SHADOWS.small,
  },
  title: {
    ...theme.TYPOGRAPHY.h3,
    color: theme.COLORS.textPrimary,
  },
  placeholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: theme.SPACING.md,
  },
  section: {
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.xl,
    marginBottom: theme.SPACING.lg,
    paddingVertical: theme.SPACING.xs,
    ...theme.SHADOWS.medium,
  },
  sectionTitle: {
    ...theme.TYPOGRAPHY.label,
    color: theme.COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    paddingHorizontal: theme.SPACING.md,
    paddingVertical: theme.SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.COLORS.separator,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.SPACING.md,
    paddingVertical: theme.SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.COLORS.separator,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: theme.SPACING.md,
  },
  settingIconBg: {
    width: 36,
    height: 36,
    borderRadius: theme.LAYOUT.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingText: {
    ...theme.TYPOGRAPHY.bodyMedium,
    color: theme.COLORS.textPrimary,
    fontSize: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.SPACING.md,
    paddingVertical: theme.SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.COLORS.separator,
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.SPACING.md,
  },
  menuText: {
    flex: 1,
    ...theme.TYPOGRAPHY.bodyMedium,
    color: theme.COLORS.textPrimary,
    fontSize: 16,
  },
  versionContainer: {
    alignItems: 'center',
    paddingVertical: theme.SPACING.xl,
    marginTop: theme.SPACING.sm,
  },
  versionText: {
    ...theme.TYPOGRAPHY.caption,
    color: theme.COLORS.textSecondary,
    marginBottom: theme.SPACING.xs,
  },
  versionNumber: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textTertiary,
  },
});