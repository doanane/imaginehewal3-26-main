import React, { useState } from 'react';
import {
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, ScrollView, Switch, Text, TouchableOpacity, View } from '../../components/themed';

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const [pushNotifications, setPushNotifications] = useState(true);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [medicationReminders, setMedicationReminders] = useState(true);
  const [healthAlerts, setHealthAlerts] = useState(true);
  const [achievementAlerts, setAchievementAlerts] = useState(true);
  const [newsletter, setNewsletter] = useState(false);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Notification Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notification Types</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="notifications-outline" size={22} color="#666" style={styles.settingIcon} />
              <View>
                <Text style={styles.settingText}>Push Notifications</Text>
                <Text style={styles.settingDescription}>Receive notifications on your device</Text>
              </View>
            </View>
            <Switch
              value={pushNotifications}
              onValueChange={setPushNotifications}
              trackColor={{ false: '#e5e7eb', true: '#007bff' }}
              thumbColor="#fff"
            />
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="mail-outline" size={22} color="#666" style={styles.settingIcon} />
              <View>
                <Text style={styles.settingText}>Email Notifications</Text>
                <Text style={styles.settingDescription}>Receive notifications via email</Text>
              </View>
            </View>
            <Switch
              value={emailNotifications}
              onValueChange={setEmailNotifications}
              trackColor={{ false: '#e5e7eb', true: '#007bff' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alert Types</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="medical-outline" size={22} color="#666" style={styles.settingIcon} />
              <View>
                <Text style={styles.settingText}>Medication Reminders</Text>
                <Text style={styles.settingDescription}>Remind me to take medications</Text>
              </View>
            </View>
            <Switch
              value={medicationReminders}
              onValueChange={setMedicationReminders}
              trackColor={{ false: '#e5e7eb', true: '#007bff' }}
              thumbColor="#fff"
            />
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="heart-outline" size={22} color="#666" style={styles.settingIcon} />
              <View>
                <Text style={styles.settingText}>Health Alerts</Text>
                <Text style={styles.settingDescription}>Alert me about health changes</Text>
              </View>
            </View>
            <Switch
              value={healthAlerts}
              onValueChange={setHealthAlerts}
              trackColor={{ false: '#e5e7eb', true: '#007bff' }}
              thumbColor="#fff"
            />
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="trophy-outline" size={22} color="#666" style={styles.settingIcon} />
              <View>
                <Text style={styles.settingText}>Achievement Alerts</Text>
                <Text style={styles.settingDescription}>Notify me about achievements</Text>
              </View>
            </View>
            <Switch
              value={achievementAlerts}
              onValueChange={setAchievementAlerts}
              trackColor={{ false: '#e5e7eb', true: '#007bff' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Marketing</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="newspaper-outline" size={22} color="#666" style={styles.settingIcon} />
              <View>
                <Text style={styles.settingText}>Newsletter</Text>
                <Text style={styles.settingDescription}>Receive health tips and updates</Text>
              </View>
            </View>
            <Switch
              value={newsletter}
              onValueChange={setNewsletter}
              trackColor={{ false: '#e5e7eb', true: '#007bff' }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  placeholder: {
    width: 24,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 16,
    paddingVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 12,
    color: '#999',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    marginRight: 12,
  },
  settingText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: '#999',
  },
});