import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { theme } from '../../constants/theme';
import { Ionicons, ScrollView, Text, TouchableOpacity, View } from '../../components/themed';

export default function ScheduleScreen() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date());

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={28} color={theme.COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>Schedule</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Coming Soon</Text>
          <Text style={styles.description}>
            The schedule feature is currently in development. This will allow you to manage and view all appointments and tasks.
          </Text>
        </View>

        <View style={styles.featuresList}>
          <View style={styles.featureItem}>
            <Ionicons name="calendar-outline" size={24} color={theme.COLORS.primary} />
            <Text style={styles.featureText}>Appointment Calendar</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="time-outline" size={24} color={theme.COLORS.primary} />
            <Text style={styles.featureText}>Task Timeline</Text>
          </View>
          <View style={styles.featureItem}>
            <Ionicons name="notifications-outline" size={24} color={theme.COLORS.primary} />
            <Text style={styles.featureText}>Reminders</Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.COLORS.border,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.COLORS.primary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.COLORS.primary,
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: theme.COLORS.primaryMuted,
    lineHeight: 20,
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: theme.COLORS.background,
    borderRadius: 12,
    gap: 12,
  },
  featureText: {
    fontSize: 14,
    color: theme.COLORS.primary,
    fontWeight: '500',
  },
});
