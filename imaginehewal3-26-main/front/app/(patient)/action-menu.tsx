import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Dimensions, Switch, Alert, Platform } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated, { SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { theme } from '../../constants/theme';

const { width, height } = Dimensions.get('window');

export default function ActionMenu({ visible, onClose }: { visible: boolean; onClose?: () => void }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('Leaderboard');
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Profile Edit State
  const [profileEdit, setProfileEdit] = useState(false);
  const [profileData, setProfileData] = useState({
    age: '45',
    height: '175',
    weight: '82',
    conditions: ['Diabetes', 'Hypertension'],
    familyHistory: ['Heart Disease', 'Diabetes']
  });

  // Leaderboard Data (Daily ranked by health score)
  const [leaderboardData] = useState([
    { id: '1', name: 'User #4892', score: 98, rank: 1, isUser: false },
    { id: '2', name: 'User #1127', score: 94, rank: 2, isUser: false },
    { id: '3', name: 'User #6634', score: 89, rank: 3, isUser: false },
    { id: '4', name: 'You', score: 76, rank: 4, isUser: true },
    { id: '5', name: 'User #3421', score: 72, rank: 5, isUser: false },
    { id: '6', name: 'User #8890', score: 68, rank: 6, isUser: false }
  ]);

  // History - Monthly Calendar (mock 30 days)
  const [monthlyScores] = useState(
    Array.from({ length: 30 }, (_, i) => ({
      day: i + 1,
      score: Math.floor(Math.random() * 40) + 60 // 60-100 range
    }))
  );

  // Devices State
  const [devices] = useState([
    { id: '1', name: 'Apple Watch Series 8', type: 'watch', connected: true, lastSync: '2 min ago' },
    { id: '2', name: 'Omron Blood Pressure Monitor', type: 'bp-monitor', connected: true, lastSync: '1 hour ago' },
    { id: '3', name: 'Fitbit Charge 5', type: 'fitness-tracker', connected: false, lastSync: '2 days ago' }
  ]);

  // Caregiver State
  const [caregiverForm, setCaregiverForm] = useState({
    name: '',
    patientId: '',
    relation: ''
  });
  const [myPatients] = useState([
    { id: '1', name: 'John Morgan', patientId: '#H-1928', relation: 'Father', status: 'active' }
  ]);

  const tabs = [
    { name: 'Leaderboard', icon: 'trophy' },
    { name: 'History', icon: 'calendar' },
    { name: 'Devices', icon: 'bluetooth' },
    { name: 'Be a Caregiver', icon: 'account-heart' },
  ];

  const conditionOptions = ['Cardiovascular disease', 'Cancer', 'Chronic respiratory disease', 'Diabetes'];
  const relationOptions = ['Spouse', 'Son', 'Daughter', 'Sibling', 'Parent', 'Friend', 'Other'];

  // Get color for health score
  const getScoreColor = (score: number) => {
    if (score >= 80) return theme.COLORS.success;
    if (score >= 60) return theme.COLORS.warning;
    return theme.COLORS.danger;
  };

  // Handle Caregiver Request
  const sendCaregiverRequest = () => {
    if (!caregiverForm.name || !caregiverForm.patientId || !caregiverForm.relation) {
      Alert.alert('Missing Information', 'Please fill in all fields');
      return;
    }
    Alert.alert(
      'Request Sent!',
      `A connection request has been sent to patient ${caregiverForm.patientId}. You'll be notified once they accept.`,
      [{ text: 'OK', onPress: () => setCaregiverForm({ name: '', patientId: '', relation: '' }) }]
    );
  };

  const renderContent = () => {
    switch (activeTab) {
      // ============ LEADERBOARD TAB ============
      case 'Leaderboard':
        return (
          <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
            <View style={styles.leaderboardHeader}>
              <View style={[styles.iconCircle, { backgroundColor: theme.COLORS.primaryMuted }]}>
                <MaterialCommunityIcons name="trophy" size={32} color={theme.COLORS.primary} />
              </View>
              <Text style={styles.leaderboardTitle}>Daily Rankings</Text>
              <Text style={styles.motivationText}>
                Consistency beats perfection. You're in the top 15% this week! 🎯
              </Text>
            </View>

            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderText, { width: 50 }]}>Rank</Text>
              <Text style={[styles.tableHeaderText, { flex: 1 }]}>User</Text>
              <Text style={[styles.tableHeaderText, { width: 60 }]}>Score</Text>
            </View>

            {leaderboardData.map((item) => (
              <View 
                key={item.id} 
                style={[
                  styles.leaderRow,
                  item.isUser && styles.leaderRowHighlight
                ]}
              >
                <View style={styles.rankBadge}>
                  {item.rank <= 3 ? (
                    <Text style={styles.rankEmoji}>
                      {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : '🥉'}
                    </Text>
                  ) : (
                    <Text style={styles.rankNum}>#{item.rank}</Text>
                  )}
                </View>
                <Text style={[styles.leaderName, item.isUser && styles.leaderNameBold]}>
                  {item.name}
                </Text>
                <View style={[styles.scoreBadge, { backgroundColor: `${getScoreColor(item.score)}20` }]}>
                  <Text style={[styles.leaderScore, { color: getScoreColor(item.score) }]}>
                    {item.score}
                  </Text>
                </View>
              </View>
            ))}

            <View style={styles.leaderboardFooter}>
              <Text style={styles.footerText}>Rankings update daily at midnight</Text>
              <Text style={styles.footerText}>Keep tracking to climb higher! 💪</Text>
            </View>
          </ScrollView>
        );

      // ============ HISTORY TAB ============
      case 'History':
        return (
          <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.menuLabel}>Your Monthly Health Summary is a quick way to see your overall progress at a glance.</Text>
            
            {/* Calendar Grid */}
            <View style={styles.calendarContainer}>
              <View style={styles.weekDays}>
                {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                  <Text key={i} style={styles.weekDayText}>{day}</Text>
                ))}
              </View>
              
              <View style={styles.calendarGrid}>
                {monthlyScores.map((day) => {
                  const color = getScoreColor(day.score);
                  return (
                    <TouchableOpacity 
                      key={day.day} 
                      style={[styles.calDay, { backgroundColor: `${color}30` }]}
                    >
                      <Text style={[styles.calDayNum, { color }]}>{day.day}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: theme.COLORS.success }]} />
                  <Text style={styles.legendText}>Optimal (80+)</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: theme.COLORS.warning }]} />
                  <Text style={styles.legendText}>Good (60-79)</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: theme.COLORS.danger }]} />
                  <Text style={styles.legendText}>Needs Work (&lt;60)</Text>
                </View>
              </View>
            </View>

            {/* Performance Chart */}
            <Text style={[styles.menuLabel, { marginTop: 30 }]}>6-Month Trend</Text>
            <View style={styles.chartContainer}>
              <View style={styles.chartMock}>
                {/* Simple mock line chart */}
                <View style={styles.chartLine}>
                  {[65, 70, 68, 75, 73, 76].map((val, i) => (
                    <View key={i} style={styles.chartPoint}>
                      <View style={[styles.chartDot, { backgroundColor: getScoreColor(val) }]} />
                      <Text style={styles.chartLabel}>{val}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.chartLabels}>
                  {['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'].map((month, i) => (
                    <Text key={i} style={styles.chartMonth}>{month}</Text>
                  ))}
                </View>
              </View>
            </View>

            {/* Stats Summary */}
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>23</Text>
                <Text style={styles.statLabel}>Days &gt; 80 Score</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statValue}>12</Text>
                <Text style={styles.statLabel}>Current Streak</Text>
              </View>
            </View>
          </ScrollView>
        );

      // ============ DEVICES TAB ============
      case 'Devices':
        return (
          <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.menuLabel}>Connected Devices</Text>
            
            {devices.map((device) => (
              <View key={device.id} style={styles.deviceCard}>
                <View style={[styles.deviceIcon, { backgroundColor: device.connected ? theme.COLORS.successLight : '#F5F5F5' }]}>
                  <MaterialCommunityIcons 
                    name={device.type === 'watch' ? 'watch' : device.type === 'bp-monitor' ? 'heart-pulse' : 'run'} 
                    size={28} 
                    color={device.connected ? theme.COLORS.success : '#999'} 
                  />
                </View>
                
                <View style={{ flex: 1, marginLeft: 15 }}>
                  <Text style={styles.deviceName}>{device.name}</Text>
                  <Text style={styles.deviceStatus}>
                    {device.connected ? `✓ Connected • Last sync: ${device.lastSync}` : '○ Disconnected'}
                  </Text>
                </View>

                <TouchableOpacity 
                  style={[
                    styles.deviceBtn,
                    { backgroundColor: device.connected ? theme.COLORS.dangerLight : theme.COLORS.primaryMuted }
                  ]}
                  onPress={() => Alert.alert(
                    device.connected ? 'Disconnect Device' : 'Connect Device',
                    `Would you like to ${device.connected ? 'disconnect' : 'connect'} ${device.name}?`
                  )}
                >
                  <Text style={[
                    styles.deviceBtnText,
                    { color: device.connected ? theme.COLORS.danger : theme.COLORS.primary }
                  ]}>
                    {device.connected ? 'Disconnect' : 'Connect'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}

            <TouchableOpacity style={[styles.mainBtn, { backgroundColor: theme.COLORS.primary }]}>
              <MaterialCommunityIcons name="plus-circle" size={20} color="white" />
              <Text style={styles.btnText}>Add New Device</Text>
            </TouchableOpacity>

            <View style={styles.deviceInfo}>
              <Ionicons name="information-circle-outline" size={20} color={theme.COLORS.textSecondary} />
              <Text style={styles.deviceInfoText}>
                Connecting devices helps track your metrics automatically and improves health score accuracy.
              </Text>
            </View>
          </ScrollView>
        );

      // ============ BE A CAREGIVER TAB ============
      case 'Be a Caregiver':
        return (
          <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
            <View style={styles.caregiverHeader}>
              <View style={[styles.iconCircle, { backgroundColor: theme.COLORS.primaryMuted }]}>
                <MaterialCommunityIcons name="account-heart" size={32} color={theme.COLORS.primary} />
              </View>
              <Text style={styles.caregiverTitle}>Become a Caregiver</Text>
              <Text style={styles.caregiverSubtitle}>
                Help your loved ones manage their health journey. Connect with them to view their progress and provide support.
              </Text>
            </View>

            {/* My Patients List */}
            {myPatients.length > 0 && (
              <>
                <Text style={styles.menuLabel}>My Patients ({myPatients.length})</Text>
                {myPatients.map((patient) => (
                  <TouchableOpacity 
                    key={patient.id} 
                    style={styles.patientCard}
                    onPress={() => Alert.alert('Navigate', `Opening ${patient.name}'s dashboard...`)}
                  >
                    <View style={[styles.deviceIcon, { backgroundColor: theme.COLORS.successLight }]}>
                      <MaterialCommunityIcons name="account-check" size={24} color={theme.COLORS.success} />
                    </View>
                    
                    <View style={{ flex: 1, marginLeft: 15 }}>
                      <Text style={styles.patientName}>{patient.name}</Text>
                      <Text style={styles.patientInfo}>
                        {patient.patientId} • {patient.relation}
                      </Text>
                    </View>

                    <Ionicons name="chevron-forward" size={20} color={theme.COLORS.textTertiary} />
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Add New Patient Form */}
            <Text style={[styles.menuLabel, { marginTop: 25 }]}>Add New Patient</Text>
            
            <Text style={styles.inputLabel}>Your Name</Text>
            <TextInput 
              style={styles.input} 
              placeholder="Enter your full name"
              value={caregiverForm.name}
              onChangeText={(val) => setCaregiverForm({...caregiverForm, name: val})}
            />

            <Text style={styles.inputLabel}>Patient ID</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g., #H-1928"
              value={caregiverForm.patientId}
              onChangeText={(val) => setCaregiverForm({...caregiverForm, patientId: val})}
            />

            <Text style={styles.inputLabel}>Your Relationship</Text>
            <View style={styles.chipContainer}>
              {relationOptions.map((rel) => (
                <TouchableOpacity
                  key={rel}
                  style={[
                    styles.chip,
                    caregiverForm.relation === rel && styles.chipSelected
                  ]}
                  onPress={() => setCaregiverForm({...caregiverForm, relation: rel})}
                >
                  <Text style={[
                    styles.chipText,
                    caregiverForm.relation === rel && styles.chipTextSelected
                  ]}>
                    {rel}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity 
              style={[styles.mainBtn, { backgroundColor: theme.COLORS.primary }]}
              onPress={sendCaregiverRequest}
            >
              <Text style={styles.btnText}>Send Connection Request</Text>
            </TouchableOpacity>
          </ScrollView>
        );

      default:
        return (
          <ScrollView style={styles.tabContent}>
            <Text>Coming Soon...</Text>
          </ScrollView>
        );
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    }
    setTimeout(() => {
      router.replace('/(patient)/home');
    }, 300);
  };

  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={handleClose}>
      <View style={styles.modalOverlay}>
        <Animated.View 
          entering={SlideInRight.duration(400).springify()} 
          exiting={SlideOutLeft.duration(400).springify()} 
          style={styles.modalContainer}
        >
          {/* TOP NAV BAR */}
          <View style={styles.navBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingRight: 20 }}>
              {tabs.map((tab) => (
                <TouchableOpacity 
                  key={tab.name} 
                  onPress={() => setActiveTab(tab.name)}
                  style={[
                    styles.tabBtn, 
                    activeTab === tab.name && { borderBottomColor: theme.COLORS.primary, borderBottomWidth: 2 }
                  ]}
                >
                  <MaterialCommunityIcons 
                    name={tab.icon as any} 
                    size={20} 
                    color={activeTab === tab.name ? theme.COLORS.primary : theme.COLORS.textSecondary} 
                  />
                  <Text style={[
                    styles.tabText, 
                    activeTab === tab.name && { color: theme.COLORS.primary, fontWeight: 'bold' }
                  ]}>
                    {tab.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity onPress={handleClose} style={styles.closeCircle}>
              <Ionicons name="close" size={24} color={theme.COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* DYNAMIC CONTENT */}
          <View style={{ flex: 1, backgroundColor: theme.COLORS.background }}>{renderContent()}</View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    alignItems: 'flex-end' 
  },
  modalContainer: { 
    height: height * 0.9, 
    width: width * 0.9, 
    backgroundColor: theme.COLORS.background, 
    borderTopLeftRadius: 30, 
    borderBottomLeftRadius: 30, 
    overflow: 'hidden',
    ...theme.SHADOWS.large,
  },
  navBar: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingVertical: 15, 
    borderBottomWidth: 1, 
    borderBottomColor: theme.COLORS.separator, 
    paddingLeft: 10,
    backgroundColor: theme.COLORS.card,
  },
  closeCircle: { 
    padding: 8, 
    backgroundColor: theme.COLORS.background, 
    borderRadius: 20, 
    marginRight: 15,
    ...theme.SHADOWS.small,
  },
  tabBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 15, 
    paddingVertical: 10, 
    marginRight: 5 
  },
  tabText: { 
    marginLeft: 8, 
    fontSize: 13, 
    color: theme.COLORS.textSecondary 
  },
  tabContent: { 
    flex: 1, 
    padding: 20 
  },
  
  // General Styles
  menuLabel: { 
    ...theme.TYPOGRAPHY.label,
    color: theme.COLORS.textSecondary,
    marginBottom: 12, 
    marginTop: 20 
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  
  // Leaderboard
  leaderboardHeader: { alignItems: 'center', marginBottom: 20, marginTop: 10 },
  leaderboardTitle: { ...theme.TYPOGRAPHY.h2, color: theme.COLORS.textPrimary, marginBottom: 8 },
  motivationText: { ...theme.TYPOGRAPHY.body, color: theme.COLORS.textSecondary, textAlign: 'center', paddingHorizontal: 20 },
  tableHeader: { flexDirection: 'row', paddingHorizontal: 10, marginBottom: 10, marginTop: 15 },
  tableHeaderText: { ...theme.TYPOGRAPHY.small, fontWeight: 'bold', color: theme.COLORS.textTertiary },
  leaderRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 15, 
    backgroundColor: theme.COLORS.card, 
    borderRadius: 12, 
    marginBottom: 8,
    ...theme.SHADOWS.small,
  },
  leaderRowHighlight: { 
    backgroundColor: theme.COLORS.primaryMuted, 
    borderWidth: 1, 
    borderColor: theme.COLORS.primary 
  },
  rankBadge: { width: 40, alignItems: 'center' },
  rankEmoji: { fontSize: 20 },
  rankNum: { fontWeight: 'bold', color: theme.COLORS.textSecondary, fontSize: 16 },
  leaderName: { flex: 1, marginLeft: 15, ...theme.TYPOGRAPHY.bodyMedium, color: theme.COLORS.textPrimary },
  leaderNameBold: { fontWeight: 'bold', color: theme.COLORS.primary },
  scoreBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  leaderScore: { fontWeight: 'bold', fontSize: 14 },
  leaderboardFooter: { alignItems: 'center', marginTop: 30, paddingTop: 20, borderTopWidth: 1, borderTopColor: theme.COLORS.separator },
  footerText: { ...theme.TYPOGRAPHY.small, color: theme.COLORS.textTertiary, marginTop: 5 },
  
  // History
  calendarContainer: { 
    backgroundColor: theme.COLORS.card, 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 20,
    ...theme.SHADOWS.small,
  },
  weekDays: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 10 },
  weekDayText: { fontSize: 12, fontWeight: 'bold', color: theme.COLORS.textTertiary, width: width * 0.1, textAlign: 'center' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'center' },
  calDay: { width: width * 0.09, height: width * 0.09, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  calDayNum: { fontSize: 12, fontWeight: 'bold' },
  legendRow: { flexDirection: 'row', gap: 15, marginTop: 15, justifyContent: 'center', flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: theme.COLORS.textSecondary },
  chartContainer: { marginBottom: 20 },
  chartMock: { backgroundColor: theme.COLORS.card, borderRadius: 16, padding: 20, minHeight: 180, ...theme.SHADOWS.small },
  chartLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 100, marginBottom: 15 },
  chartPoint: { alignItems: 'center', gap: 8 },
  chartDot: { width: 10, height: 10, borderRadius: 5 },
  chartLabel: { fontSize: 10, color: theme.COLORS.textSecondary },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  chartMonth: { fontSize: 10, color: theme.COLORS.textTertiary },
  statsGrid: { flexDirection: 'row', gap: 15 },
  statCard: { flex: 1, backgroundColor: theme.COLORS.card, padding: 15, borderRadius: 16, alignItems: 'center', ...theme.SHADOWS.small },
  statValue: { fontSize: 24, fontWeight: 'bold', color: theme.COLORS.textPrimary },
  statLabel: { fontSize: 12, color: theme.COLORS.textSecondary, marginTop: 4 },

  // Devices
  deviceCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: theme.COLORS.card, 
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 12,
    ...theme.SHADOWS.small,
  },
  deviceIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  deviceName: { ...theme.TYPOGRAPHY.bodyMedium, color: theme.COLORS.textPrimary },
  deviceStatus: { ...theme.TYPOGRAPHY.small, color: theme.COLORS.textSecondary, marginTop: 2 },
  deviceBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 },
  deviceBtnText: { fontSize: 12, fontWeight: 'bold' },
  mainBtn: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: 16, 
    borderRadius: 16, 
    marginTop: 10,
    gap: 8,
    ...theme.SHADOWS.medium,
  },
  btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  deviceInfo: { flexDirection: 'row', gap: 10, marginTop: 20, padding: 15, backgroundColor: theme.COLORS.infoLight, borderRadius: 12 },
  deviceInfoText: { flex: 1, fontSize: 13, color: theme.COLORS.textSecondary, lineHeight: 18 },

  // Caregiver
  caregiverHeader: { alignItems: 'center', marginBottom: 20, marginTop: 10 },
  caregiverTitle: { ...theme.TYPOGRAPHY.h2, color: theme.COLORS.textPrimary, marginBottom: 8 },
  caregiverSubtitle: { ...theme.TYPOGRAPHY.body, color: theme.COLORS.textSecondary, textAlign: 'center', paddingHorizontal: 10 },
  patientCard: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    backgroundColor: theme.COLORS.card, 
    padding: 16, 
    borderRadius: 16, 
    marginBottom: 12,
    ...theme.SHADOWS.small,
  },
  patientName: { ...theme.TYPOGRAPHY.bodyMedium, color: theme.COLORS.textPrimary },
  patientInfo: { ...theme.TYPOGRAPHY.small, color: theme.COLORS.textSecondary, marginTop: 2 },
  inputLabel: { ...theme.TYPOGRAPHY.label, color: theme.COLORS.textPrimary, marginBottom: 8, marginTop: 15 },
  input: { 
    backgroundColor: theme.COLORS.card, 
    padding: 15, 
    borderRadius: 12, 
    marginBottom: 5, 
    borderWidth: 1, 
    borderColor: theme.COLORS.border,
    color: theme.COLORS.textPrimary,
  },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 20 },
  chip: { 
    paddingHorizontal: 16, 
    paddingVertical: 10, 
    borderRadius: 20, 
    borderWidth: 1, 
    borderColor: theme.COLORS.border, 
    backgroundColor: theme.COLORS.card 
  },
  chipSelected: { 
    backgroundColor: theme.COLORS.primary, 
    borderColor: theme.COLORS.primary 
  },
  chipText: { fontSize: 13, color: theme.COLORS.textSecondary },
  chipTextSelected: { color: 'white', fontWeight: 'bold' },
});