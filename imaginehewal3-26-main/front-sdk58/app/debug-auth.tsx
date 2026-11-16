import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { Ionicons, ScrollView, Text, TouchableOpacity, View } from '../components/themed';

export default function DebugAuthScreen() {
  const router = useRouter();
  const safeBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  // Be defensive: if the screen ever renders outside AuthProvider, avoid hard crash
  let auth = {
    isAuthenticated: false,
    user: null as any,
    isLoading: false,
    logout: async () => {},
  };
  try {
    auth = useAuth();
  } catch (error) {
    console.warn('useAuth is unavailable; is the screen wrapped in AuthProvider?', error);
  }

  const { isAuthenticated, user, isLoading, logout } = auth;
  const [storageData, setStorageData] = useState<any>({});
  const [apiTest, setApiTest] = useState<string>('');
  const [onboardingCompleted, setOnboardingCompleted] = useState<string | null>(null);

  const loadStorageData = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const data: any = {};
      
      for (const key of keys) {
        const value = await AsyncStorage.getItem(key);
        data[key] = value;
      }
      
      setStorageData(data);
      setOnboardingCompleted(data['onboarding_completed'] ?? null);
    } catch (error) {
      console.error('Error loading storage:', error);
    }
  };

  const testApiConnection = async () => {
    try {
      setApiTest('Testing...');
      const result = await api.testConnection();
      setApiTest(result ? 'API Connected' : 'API Not Connected');
    } catch (error: any) {
      setApiTest(`Error: ${error.message}`);
    }
  };

  const testCurrentUser = async () => {
    try {
      const user = await api.getCurrentUser();
      console.log('Current user:', user);
      alert(JSON.stringify(user, null, 2));
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const clearStorage = async () => {
    await AsyncStorage.clear();
    await loadStorageData();
  };

  const markOnboarding = async (value: 'true' | 'false') => {
    await AsyncStorage.setItem('onboarding_completed', value);
    await loadStorageData();
  };

  const setUserType = async (type: 'patient' | 'caregiver') => {
    await AsyncStorage.setItem('user_type', type);
    await loadStorageData();
  };

  useEffect(() => {
    loadStorageData();
  }, []);

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={safeBack}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Auth Debug</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Authentication State</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Loading:</Text>
          <Text style={styles.value}>{isLoading ? 'Yes' : 'No'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Authenticated:</Text>
          <Text style={[styles.value, { color: isAuthenticated ? 'green' : 'red' }]}>
            {isAuthenticated ? 'Yes' : 'No'}
          </Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>User Type:</Text>
          <Text style={styles.value}>{user?.user_type || storageData['user_type'] || 'None'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>User Email:</Text>
          <Text style={styles.value}>{user?.email || 'None'}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Onboarding Completed:</Text>
          <Text style={styles.value}>{onboardingCompleted ?? 'None'}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Storage Data</Text>
        {Object.entries(storageData).map(([key, value]) => (
          <View key={key} style={styles.infoRow}>
            <Text style={styles.label}>{key}:</Text>
            <Text style={styles.value} numberOfLines={1}>
              {String(value).substring(0, 50)}
              {String(value).length > 50 ? '...' : ''}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>API Tests</Text>
        <TouchableOpacity style={styles.testButton} onPress={testApiConnection}>
          <Text style={styles.testButtonText}>Test API Connection</Text>
        </TouchableOpacity>
        {apiTest && <Text style={styles.testResult}>{apiTest}</Text>}
        
        <TouchableOpacity style={styles.testButton} onPress={testCurrentUser}>
          <Text style={styles.testButtonText}>Test Current User Endpoint</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>
        <TouchableOpacity style={styles.actionButton} onPress={loadStorageData}>
          <Ionicons name="refresh" size={20} color="#007bff" />
          <Text style={styles.actionButtonText}>Refresh Storage Data</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={[styles.actionButton, styles.dangerButton]} onPress={clearStorage}>
          <Ionicons name="trash" size={20} color="#dc2626" />
          <Text style={[styles.actionButtonText, { color: '#dc2626' }]}>Clear All Storage</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => markOnboarding('true')}>
          <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
          <Text style={[styles.actionButtonText, { color: '#16a34a' }]}>Mark Onboarding Complete</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => markOnboarding('false')}>
          <Ionicons name="close-circle" size={20} color="#ea580c" />
          <Text style={[styles.actionButtonText, { color: '#ea580c' }]}>Mark Onboarding Incomplete</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => setUserType('patient')}>
          <Ionicons name="person" size={20} color="#007bff" />
          <Text style={styles.actionButtonText}>Set User Type: patient</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => setUserType('caregiver')}>
          <Ionicons name="people" size={20} color="#7c3aed" />
          <Text style={[styles.actionButtonText, { color: '#7c3aed' }]}>Set User Type: caregiver</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.actionButton, styles.dangerButton]} onPress={logout}>
          <Ionicons name="log-out" size={20} color="#dc2626" />
          <Text style={[styles.actionButtonText, { color: '#dc2626' }]}>Logout (clear tokens)</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.actionButton} onPress={() => router.push('/onboarding')}>
          <Ionicons name="navigate" size={20} color="#007bff" />
          <Text style={styles.actionButtonText}>Go to Onboarding</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  section: {
    backgroundColor: 'white',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  label: {
    fontSize: 14,
    color: '#666',
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    color: '#333',
    fontWeight: '600',
  },
  testButton: {
    backgroundColor: '#007bff',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 12,
  },
  testButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  testResult: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#f0f7ff',
    marginBottom: 12,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    color: '#007bff',
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: '#fee2e2',
  },
});