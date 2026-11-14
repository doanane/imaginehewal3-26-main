import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../services/api';

type TestStatus = 'success' | 'error' | 'pending';

type TestResult = {
  test: string;
  status: TestStatus;
  message: string;
  timestamp: string;
};

export default function ConnectionTestScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<TestResult[]>([]);

  const addResult = (test: string, status: TestStatus, message: string) => {
    setResults(prev => [...prev, { test, status, message, timestamp: new Date().toISOString() }]);
  };

  const testBackendConnection = async () => {
    setLoading(true);
    addResult('Backend Health Check', 'pending', 'Checking...');
    
    try {
      const response = await fetch('http://localhost:8000/health');
      const data = await response.json();
      
      if (response.ok) {
        addResult('Backend Health Check', 'success', `Backend is ${data.status}. Database: ${data.database}`);
      } else {
        addResult('Backend Health Check', 'error', `Failed: ${response.status}`);
      }
    } catch (error: any) {
      addResult('Backend Health Check', 'error', `Error: ${error.message}`);
    }
    setLoading(false);
  };

  const testApiConnection = async () => {
    setLoading(true);
    addResult('API Connection', 'pending', 'Testing...');
    
    try {
      const result = await api.testConnection();
      if (result) {
        addResult('API Connection', 'success', 'API is reachable');
      } else {
        addResult('API Connection', 'error', 'API is not reachable');
      }
    } catch (error: any) {
      addResult('API Connection', 'error', `Error: ${error.message}`);
    }
    setLoading(false);
  };

  const testSystemHealth = async () => {
    setLoading(true);
    addResult('System Health', 'pending', 'Checking...');
    
    try {
      await api.systemHealthCheck();
      addResult('System Health', 'success', 'System health check passed');
    } catch (error: any) {
      addResult('System Health', 'error', `Error: ${error.message}`);
    }
    setLoading(false);
  };

  const runAllTests = async () => {
    setResults([]);
    await testBackendConnection();
    await testApiConnection();
    await testSystemHealth();
  };

  const clearResults = () => {
    setResults([]);
  };

  const goBack = () => {
    router.back();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={goBack} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Connection Test</Text>
        <Text style={styles.subtitle}>Diagnose API connectivity issues</Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity
          style={[styles.testButton, loading && styles.disabledButton]}
          onPress={runAllTests}
          disabled={loading}
        >
          <Ionicons name="play-circle-outline" size={20} color="#fff" />
          <Text style={styles.testButtonText}>Run All Tests</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.clearButton, loading && styles.disabledButton]}
          onPress={clearResults}
          disabled={loading}
        >
          <Ionicons name="trash-outline" size={20} color="#666" />
          <Text style={styles.clearButtonText}>Clear Results</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.resultsContainer}>
        {results.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="wifi-outline" size={60} color="#ccc" />
            <Text style={styles.emptyText}>No test results yet</Text>
            <Text style={styles.emptySubtext}>Run tests to check your connection</Text>
          </View>
        ) : (
          results.map((result, index) => (
            <View key={index} style={[
              styles.resultItem,
              result.status === 'success' ? styles.successItem :
              result.status === 'error' ? styles.errorItem :
              styles.pendingItem
            ]}>
              <View style={styles.resultHeader}>
                <Ionicons
                  name={
                    result.status === 'success' ? 'checkmark-circle' :
                    result.status === 'error' ? 'close-circle' :
                    'time-outline'
                  }
                  size={20}
                  color={
                    result.status === 'success' ? '#34C759' :
                    result.status === 'error' ? '#FF3B30' :
                    '#FF9500'
                  }
                />
                <Text style={styles.resultTest}>{result.test}</Text>
              </View>
              <Text style={styles.resultMessage}>{result.message}</Text>
              {result.timestamp && (
                <Text style={styles.resultTime}>
                  {new Date(result.timestamp).toLocaleTimeString()}
                </Text>
              )}
            </View>
          ))
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.footerTitle}>Troubleshooting Tips:</Text>
        <Text style={styles.footerText}>1. Make sure backend is running: `python app/main.py`</Text>
        <Text style={styles.footerText}>2. Check if port 8000 is available</Text>
        <Text style={styles.footerText}>3. Try `expo start --localhost` if on web</Text>
        <Text style={styles.footerText}>4. Check firewall/antivirus settings</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  header: {
    marginBottom: 30,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 5,
  },
  controls: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 20,
  },
  testButton: {
    flex: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
  },
  clearButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#f5f5f5',
    padding: 15,
    borderRadius: 10,
  },
  disabledButton: {
    opacity: 0.5,
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  clearButtonText: {
    color: '#666',
    fontSize: 14,
  },
  resultsContainer: {
    flex: 1,
    marginBottom: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 50,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    marginTop: 10,
    marginBottom: 5,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  resultItem: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
    borderWidth: 1,
  },
  successItem: {
    backgroundColor: 'rgba(52, 199, 89, 0.1)',
    borderColor: 'rgba(52, 199, 89, 0.3)',
  },
  errorItem: {
    backgroundColor: 'rgba(255, 59, 48, 0.1)',
    borderColor: 'rgba(255, 59, 48, 0.3)',
  },
  pendingItem: {
    backgroundColor: 'rgba(255, 149, 0, 0.1)',
    borderColor: 'rgba(255, 149, 0, 0.3)',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 5,
  },
  resultTest: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  resultMessage: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
  resultTime: {
    fontSize: 12,
    color: '#999',
  },
  footer: {
    padding: 15,
    backgroundColor: '#f8f9fa',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  footerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  footerText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 5,
  },
});