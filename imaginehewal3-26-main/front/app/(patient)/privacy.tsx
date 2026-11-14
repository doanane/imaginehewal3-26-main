import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export default function PrivacyScreen() {
  const router = useRouter();
  const [dataCollection, setDataCollection] = useState(true);
  const [analytics, setAnalytics] = useState(true);
  const [locationTracking, setLocationTracking] = useState(false);
  const [shareWithDoctors, setShareWithDoctors] = useState(true);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Privacy & Security</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Data Privacy</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="shield-outline" size={22} color="#666" style={styles.settingIcon} />
              <View>
                <Text style={styles.settingText}>Data Collection</Text>
                <Text style={styles.settingDescription}>Allow collection of health data for personalized insights</Text>
              </View>
            </View>
            <Switch
              value={dataCollection}
              onValueChange={setDataCollection}
              trackColor={{ false: '#e5e7eb', true: '#007bff' }}
              thumbColor="#fff"
            />
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="analytics-outline" size={22} color="#666" style={styles.settingIcon} />
              <View>
                <Text style={styles.settingText}>Analytics</Text>
                <Text style={styles.settingDescription}>Help improve HEWAL3 with anonymous usage data</Text>
              </View>
            </View>
            <Switch
              value={analytics}
              onValueChange={setAnalytics}
              trackColor={{ false: '#e5e7eb', true: '#007bff' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sharing</Text>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="location-outline" size={22} color="#666" style={styles.settingIcon} />
              <View>
                <Text style={styles.settingText}>Location Tracking</Text>
                <Text style={styles.settingDescription}>Share location for emergency services</Text>
              </View>
            </View>
            <Switch
              value={locationTracking}
              onValueChange={setLocationTracking}
              trackColor={{ false: '#e5e7eb', true: '#007bff' }}
              thumbColor="#fff"
            />
          </View>
          
          <View style={styles.settingItem}>
            <View style={styles.settingLeft}>
              <Ionicons name="people-outline" size={22} color="#666" style={styles.settingIcon} />
              <View>
                <Text style={styles.settingText}>Share with Doctors</Text>
                <Text style={styles.settingDescription}>Allow doctors to view your health data</Text>
              </View>
            </View>
            <Switch
              value={shareWithDoctors}
              onValueChange={setShareWithDoctors}
              trackColor={{ false: '#e5e7eb', true: '#007bff' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Security</Text>
          
          <TouchableOpacity style={styles.menuItem} onPress={() => router.push('/(auth)/change-password')}>
            <View style={styles.menuIcon}>
              <Ionicons name="key-outline" size={22} color="#007bff" />
            </View>
            <Text style={styles.menuText}>Change Password</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIcon}>
              <Ionicons name="phone-portrait-outline" size={22} color="#007bff" />
            </View>
            <Text style={styles.menuText}>Two-Factor Authentication</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.menuItem}>
            <View style={styles.menuIcon}>
              <Ionicons name="lock-closed-outline" size={22} color="#007bff" />
            </View>
            <Text style={styles.menuText}>Active Sessions</Text>
            <Ionicons name="chevron-forward" size={20} color="#ccc" />
          </TouchableOpacity>
        </View>

        <View style={styles.infoCard}>
          <Ionicons name="information-circle" size={24} color="#f59e0b" />
          <Text style={styles.infoText}>
            Your data is encrypted and stored securely. We never sell your personal information.
          </Text>
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
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  menuIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#fff3cd',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#856404',
    lineHeight: 20,
  },
});

function useLocalState(arg0: boolean): [any, any] {
    throw new Error('Function not implemented.');
}
