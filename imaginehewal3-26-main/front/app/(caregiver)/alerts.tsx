import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Switch, Text, TouchableOpacity, View } from 'react-native';

const brandColor = 'rgb(173, 0, 35)';

export default function AlertsScreen() {
  const router = useRouter();
  
  const [notifications, setNotifications] = useState([
    {
      id: '1',
      type: 'critical',
      title: 'Critical Alert: High Blood Pressure',
      patient: 'Alex Morgan',
      time: '10 minutes ago',
      read: false,
      icon: 'heart-pulse'
    },
    {
      id: '2',
      type: 'medication',
      title: 'Missed Medication Alert',
      patient: 'Sarah Jenkins',
      time: '1 hour ago',
      read: true,
      icon: 'pill'
    },
    {
      id: '3',
      type: 'appointment',
      title: 'Upcoming Appointment',
      patient: 'Robert Chen',
      time: '3 hours ago',
      read: true,
      icon: 'calendar'
    },
    {
      id: '4',
      type: 'task',
      title: 'Task Reminder',
      patient: 'All Patients',
      time: '5 hours ago',
      read: true,
      icon: 'check-circle'
    }
  ]);

  const [alertSettings, setAlertSettings] = useState({
    criticalAlerts: true,
    medicationAlerts: true,
    appointmentAlerts: true,
    taskReminders: true,
    emailNotifications: false,
    pushNotifications: true,
    smsAlerts: true
  });

  const getAlertColor = (type: string) => {
    switch (type) {
      case 'critical': return '#EF4444';
      case 'medication': return '#F59E0B';
      case 'appointment': return '#3B82F6';
      case 'task': return '#10B981';
      default: return '#666';
    }
  };

  const handleMarkAsRead = (id: string) => {
    setNotifications(notifications.map(notification => 
      notification.id === id ? { ...notification, read: true } : notification
    ));
  };

  const handleClearAll = () => {
    Alert.alert(
      'Clear All Notifications',
      'Are you sure you want to mark all notifications as read?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: () => {
            setNotifications(notifications.map(notification => ({ ...notification, read: true })));
          }
        }
      ]
    );
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Alerts & Notifications</Text>
        <TouchableOpacity style={styles.filterButton}>
          <Ionicons name="filter" size={24} color={brandColor} />
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{unreadCount}</Text>
          <Text style={styles.statLabel}>Unread</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{notifications.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>
            {notifications.filter(n => n.type === 'critical').length}
          </Text>
          <Text style={styles.statLabel}>Critical</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>3</Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Alerts</Text>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleClearAll}>
              <Text style={styles.clearAllText}>Clear All</Text>
            </TouchableOpacity>
          )}
        </View>

        {notifications.map((notification) => (
          <TouchableOpacity 
            key={notification.id} 
            style={[
              styles.notificationCard,
              !notification.read && styles.unreadCard
            ]}
            onPress={() => handleMarkAsRead(notification.id)}
          >
            <View style={[
              styles.notificationIcon,
              { backgroundColor: `${getAlertColor(notification.type)}20` }
            ]}>
              <MaterialCommunityIcons 
                name={notification.icon as any} 
                size={20} 
                color={getAlertColor(notification.type)} 
              />
            </View>
            
            <View style={styles.notificationContent}>
              <View style={styles.notificationHeader}>
                <Text style={styles.notificationTitle}>{notification.title}</Text>
                {!notification.read && <View style={styles.unreadDot} />}
              </View>
              <Text style={styles.notificationPatient}>{notification.patient}</Text>
              <Text style={styles.notificationTime}>{notification.time}</Text>
            </View>
            
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="chevron-forward" size={20} color="#999" />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}

        {notifications.length === 0 && (
          <View style={styles.emptyState}>
            <Ionicons name="notifications-off-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>No alerts</Text>
            <Text style={styles.emptySubtext}>All caught up!</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Alert Settings</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="heart-circle-outline" size={22} color="#EF4444" />
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Critical Health Alerts</Text>
              <Text style={styles.settingDescription}>High BP, abnormal heart rate</Text>
            </View>
          </View>
          <Switch
            value={alertSettings.criticalAlerts}
            onValueChange={(value) => setAlertSettings({...alertSettings, criticalAlerts: value})}
            trackColor={{ false: '#ddd', true: '#EF4444' }}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <MaterialCommunityIcons name="pill" size={22} color="#F59E0B" />
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Medication Alerts</Text>
              <Text style={styles.settingDescription}>Missed doses, refill reminders</Text>
            </View>
          </View>
          <Switch
            value={alertSettings.medicationAlerts}
            onValueChange={(value) => setAlertSettings({...alertSettings, medicationAlerts: value})}
            trackColor={{ false: '#ddd', true: '#F59E0B' }}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="calendar-outline" size={22} color="#3B82F6" />
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Appointment Alerts</Text>
              <Text style={styles.settingDescription}>Upcoming appointments</Text>
            </View>
          </View>
          <Switch
            value={alertSettings.appointmentAlerts}
            onValueChange={(value) => setAlertSettings({...alertSettings, appointmentAlerts: value})}
            trackColor={{ false: '#ddd', true: '#3B82F6' }}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="checkmark-circle-outline" size={22} color="#10B981" />
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Task Reminders</Text>
              <Text style={styles.settingDescription}>Daily task notifications</Text>
            </View>
          </View>
          <Switch
            value={alertSettings.taskReminders}
            onValueChange={(value) => setAlertSettings({...alertSettings, taskReminders: value})}
            trackColor={{ false: '#ddd', true: '#10B981' }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notification Channels</Text>
        
        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="notifications-outline" size={22} color="#666" />
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Push Notifications</Text>
              <Text style={styles.settingDescription}>In-app notifications</Text>
            </View>
          </View>
          <Switch
            value={alertSettings.pushNotifications}
            onValueChange={(value) => setAlertSettings({...alertSettings, pushNotifications: value})}
            trackColor={{ false: '#ddd', true: brandColor }}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="mail-outline" size={22} color="#666" />
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>Email Notifications</Text>
              <Text style={styles.settingDescription}>Receive email alerts</Text>
            </View>
          </View>
          <Switch
            value={alertSettings.emailNotifications}
            onValueChange={(value) => setAlertSettings({...alertSettings, emailNotifications: value})}
            trackColor={{ false: '#ddd', true: brandColor }}
          />
        </View>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Ionicons name="chatbubble-outline" size={22} color="#666" />
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>SMS Alerts</Text>
              <Text style={styles.settingDescription}>Critical alerts via SMS</Text>
            </View>
          </View>
          <Switch
            value={alertSettings.smsAlerts}
            onValueChange={(value) => setAlertSettings({...alertSettings, smsAlerts: value})}
            trackColor={{ false: '#ddd', true: brandColor }}
          />
        </View>
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 60, paddingHorizontal: 20, paddingBottom: 20, backgroundColor: 'white' },
  backButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
  filterButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  
  statsContainer: { flexDirection: 'row', backgroundColor: 'white', padding: 20 },
  statCard: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 5 },
  statLabel: { fontSize: 12, color: '#666' },
  
  section: { backgroundColor: 'white', padding: 20, marginTop: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A' },
  clearAllText: { fontSize: 14, color: brandColor, fontWeight: '500' },
  
  notificationCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  unreadCard: { backgroundColor: '#F8F9FA' },
  notificationIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  notificationContent: { flex: 1 },
  notificationHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  notificationTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', flex: 1 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: brandColor },
  notificationPatient: { fontSize: 12, color: '#666', marginTop: 2 },
  notificationTime: { fontSize: 11, color: '#999', marginTop: 2 },
  actionButton: { padding: 8 },
  
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#999', marginTop: 16 },
  emptySubtext: { fontSize: 13, color: '#BBB', marginTop: 4 },
  
  settingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  settingInfo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  settingText: { flex: 1 },
  settingLabel: { fontSize: 14, color: '#1A1A1A', fontWeight: '500' },
  settingDescription: { fontSize: 12, color: '#666', marginTop: 2 }
});