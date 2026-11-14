import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

export default function DevicesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [devices, setDevices] = useState<any[]>([]);

  const loadDevices = async () => {
    try {
      // Add API call to get devices
      setDevices([]);
    } catch (error) {
      console.error('Error loading devices:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    loadDevices();
  };

  const getDeviceIcon = (deviceType: string) => {
    switch (deviceType) {
      case 'smartwatch':
        return <Ionicons name="watch-outline" size={32} color="#007bff" />;
      case 'fitbit':
        return <MaterialCommunityIcons name="heart-pulse" size={32} color="#ff6b6b" />;
      case 'apple_health':
        return <Ionicons name="fitness-outline" size={32} color="#34c759" />;
      default:
        return <Ionicons name="laptop-outline" size={32} color="#007bff" />;
    }
  };

  const renderDevice = ({ item }: { item: any }) => (
    <View style={styles.deviceCard}>
      <View style={styles.deviceIcon}>{getDeviceIcon(item.type)}</View>
      <View style={styles.deviceInfo}>
        <Text style={styles.deviceName}>{item.name}</Text>
        <Text style={styles.deviceStatus}>
          {item.connected ? '✓ Connected' : '○ Disconnected'}
        </Text>
        {item.last_sync && <Text style={styles.deviceSync}>Last sync: {item.last_sync}</Text>}
      </View>
      <Ionicons name="chevron-forward" size={20} color="#ccc" />
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Connected Devices</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.section}>
        <TouchableOpacity style={styles.addDeviceButton}>
          <Ionicons name="add-circle-outline" size={24} color="#007bff" />
          <Text style={styles.addDeviceText}>Connect New Device</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={devices}
        renderItem={renderDevice}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        scrollEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialCommunityIcons name="devices" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No devices connected yet</Text>
            <Text style={styles.emptySubtext}>Connect a device to sync health data</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  placeholder: {
    width: 24,
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 12,
    borderRadius: 8,
    padding: 0,
  },
  addDeviceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  addDeviceText: {
    color: '#007bff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  deviceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f0f0f0',
  },
  deviceIcon: {
    marginRight: 12,
  },
  deviceInfo: {
    flex: 1,
  },
  deviceName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  deviceStatus: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  deviceSync: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 6,
  },
});
