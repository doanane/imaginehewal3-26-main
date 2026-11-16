// front/app/(caregiver)/patients.tsx - Professional Version
import * as MediaLibrary from 'expo-media-library';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Dimensions,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import Animated, { FadeInDown, SlideInUp } from 'react-native-reanimated';
import { theme } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import api, { AssignedPatient, PatientAccessRequest } from '../../services/api';
import { ActivityIndicator, Image, Ionicons, LinearGradient, Pressable, RefreshControl, ScrollView, StatusBar, Text, TextInput, TouchableOpacity, View } from '../../components/themed';

const { width } = Dimensions.get('window');

interface PatientStats {
  total: number;
  active: number;
  critical: number;
  pending: number;
}

const PatientsScreen = () => {
  const router = useRouter();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [patients, setPatients] = useState<AssignedPatient[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'critical' | 'stable' | 'pending'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addPatientMethod, setAddPatientMethod] = useState<'id' | 'qr' | 'invite'>('id');
  const [patientId, setPatientId] = useState('');
  const [relationshipType, setRelationshipType] = useState('family_member');
  const [addingPatient, setAddingPatient] = useState(false);
  const [stats, setStats] = useState<PatientStats>({
    total: 0,
    active: 0,
    critical: 0,
    pending: 0
  });
  const [showExportOptions, setShowExportOptions] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<AssignedPatient | null>(null);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const data = await api.getAssignedPatients();
      setPatients(data || []);
      
      // Calculate stats
      const stats: PatientStats = {
        total: data?.length || 0,
        active: data?.filter(p => p.status === 'active' || p.status === 'stable').length || 0,
        critical: data?.filter(p => p.status === 'critical').length || 0,
        pending: data?.filter(p => p.status === 'pending').length || 0
      };
      setStats(stats);
      
    } catch (error: any) {
      console.error('Error fetching patients:', error);
      
      // Handle session expiration
      if (error.message?.includes('session has expired') || error.message?.includes('log in again')) {
        Alert.alert(
          'Session Expired',
          'Your session has expired. Please log in again.',
          [
            {
              text: 'OK',
              onPress: () => router.replace('/(auth)/login')
            }
          ]
        );
      } else {
        Alert.alert(
          'Notice',
          'Using offline data. Some information may not be up to date.',
          [{ text: 'OK' }]
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPatients();
    
    // Set up real-time updates (WebSocket would be ideal here)
    const interval = setInterval(fetchPatients, 30000); // Poll every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPatients();
  }, []);

  const handleConnectPatient = async () => {
    if (!patientId.trim()) {
      Alert.alert('Error', 'Please enter a patient ID');
      return;
    }

    try {
      setAddingPatient(true);
      
      if (addPatientMethod === 'id') {
        await api.connectWithPatient({ 
          patient_caregiver_id: patientId.trim()
        });
        
        Alert.alert(
          'Connection Request Sent',
          'The patient has been notified. They need to approve your request.',
          [{ 
            text: 'OK', 
            onPress: () => {
              setShowAddModal(false);
              setPatientId('');
              fetchPatients();
            }
          }]
        );
      } else if (addPatientMethod === 'invite') {
        const requestData: PatientAccessRequest = {
          patient_id: patientId.trim(),
          relationship_type: relationshipType
        };
        
        await api.requestPatientAccess(requestData);
        
        Alert.alert(
          'Access Request Sent',
          'The patient will receive your request and can approve it from their app.',
          [{ 
            text: 'OK', 
            onPress: () => {
              setShowAddModal(false);
              setPatientId('');
              fetchPatients();
            }
          }]
        );
      }
      
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to connect with patient');
    } finally {
      setAddingPatient(false);
    }
  };

  const handleScanQR = () => {
    // In a real app, you would integrate a QR scanner here
    Alert.alert('QR Scanner', 'QR scanning functionality would open here');
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'critical': return theme.COLORS.danger;
      case 'stable': return theme.COLORS.success;
      case 'active': return theme.COLORS.success;
      case 'pending': return theme.COLORS.warning;
      default: return theme.COLORS.textTertiary;
    }
  };

  const getStatusBg = (status: string) => {
    switch (status.toLowerCase()) {
      case 'critical': return theme.COLORS.dangerLight;
      case 'stable': return theme.COLORS.successLight;
      case 'active': return theme.COLORS.successLight;
      case 'pending': return theme.COLORS.warningLight;
      default: return theme.COLORS.background;
    }
  };

  const filteredPatients = patients.filter(patient => {
    const matchesSearch = 
      patient.patient_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
      patient.patient_id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.email?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeFilter === 'all') return matchesSearch;
    return matchesSearch && patient.status?.toLowerCase() === activeFilter;
  });

  const handleExportPatientData = async (patient: AssignedPatient) => {
    try {
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Need permission to save files');
        return;
      }

      // TODO: FileSystem API needs proper configuration
      Alert.alert(
        'Export Not Available',
        'File export functionality is currently being configured.'
      );
      
    } catch (error) {
      console.error('Export error:', error);
      Alert.alert('Export Failed', 'Could not export patient data');
    }
  };

  const handleExportAsPDF = async (patient: AssignedPatient) => {
    Alert.alert('PDF Export', 'PDF generation would require a backend service or PDF library integration');
  };

  const handleSendMessage = (patient: AssignedPatient) => {
    router.push({
      pathname: '/(patient)/thread',
      params: { userId: String(patient.id), name: patient.patient_name }
    });
  };

  const handleViewPatient = (patient: AssignedPatient) => {
    router.push({
      pathname: '/(caregiver)/patient-detail',
      params: { id: String(patient.id), name: patient.patient_name }
    });
  };

  const handleRemovePatient = async (patient: AssignedPatient) => {
    Alert.alert(
      'Remove Patient',
      `Are you sure you want to remove ${patient.patient_name} from your care?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Remove', 
          style: 'destructive',
          onPress: async () => {
            try {
              await api.removePatientConnection(patient.id);
              fetchPatients();
              Alert.alert('Success', 'Patient removed successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to remove patient');
            }
          }
        }
      ]
    );
  };

  const renderStatCard = (title: string, value: number, color: string, icon: string) => (
    <View style={styles.statCard}>
      <View style={[styles.statIcon, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <View>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={styles.statLabel}>{title}</Text>
      </View>
    </View>
  );

  const renderPatientCard = (patient: AssignedPatient, index: number) => (
    <Animated.View 
      entering={FadeInDown.delay(index * 50)}
      style={styles.patientCard}
    >
      <View style={styles.patientCardHeader}>
        <TouchableOpacity 
          style={styles.patientInfoSection}
          onPress={() => handleViewPatient(patient)}
          activeOpacity={0.7}
        >
          <Image 
            source={{ 
              uri: `https://ui-avatars.com/api/?name=${patient.patient_name}&background=${theme.COLORS.primary.replace('#', '')}&color=fff&size=128`
            }}
            style={styles.patientAvatar}
          />
          <View style={styles.patientTextInfo}>
            <View style={styles.nameStatusRow}>
              <Text style={styles.patientName} numberOfLines={1}>
                {patient.patient_name}
              </Text>
              <View style={[styles.statusBadge, { backgroundColor: getStatusBg(patient.status) }]}>
                <Text style={[styles.statusText, { color: getStatusColor(patient.status) }]}>
                  {patient.status.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.patientId}>ID: {patient.patient_id}</Text>
            <View style={styles.patientMeta}>
              {patient.age && (
                <Text style={styles.patientMetaText}>{patient.age}y • {patient.gender}</Text>
              )}
              {patient.last_checkup && (
                <Text style={styles.lastCheckup}>
                  <Ionicons name="time-outline" size={12} color={theme.COLORS.textTertiary} />
                  {' '}{new Date(patient.last_checkup).toLocaleDateString()}
                </Text>
              )}
            </View>
          </View>
        </TouchableOpacity>
        
        <View style={styles.patientActions}>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => handleSendMessage(patient)}
          >
            <Ionicons name="chatbubble-outline" size={20} color={theme.COLORS.primary} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => {
              setSelectedPatient(patient);
              setShowExportOptions(true);
            }}
          >
            <Ionicons name="download-outline" size={20} color={theme.COLORS.textSecondary} />
          </TouchableOpacity>
          {patient.status !== 'pending' && (
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => handleRemovePatient(patient)}
            >
              <Ionicons name="trash-outline" size={20} color={theme.COLORS.danger} />
            </TouchableOpacity>
          )}
        </View>
      </View>
      
      {patient.health_score !== undefined && (
        <View style={styles.healthScoreSection}>
          <Text style={styles.healthScoreLabel}>Health Score</Text>
          <View style={styles.scoreBarContainer}>
            <View style={styles.scoreBarBackground}>
              <View 
                style={[
                  styles.scoreBarFill,
                  { 
                    width: `${patient.health_score}%`,
                    backgroundColor: patient.health_score > 70 ? theme.COLORS.success : 
                                   patient.health_score > 40 ? theme.COLORS.warning : 
                                   theme.COLORS.danger
                  }
                ]}
              />
            </View>
            <Text style={[
              styles.scoreValue,
              { 
                color: patient.health_score > 70 ? theme.COLORS.success : 
                       patient.health_score > 40 ? theme.COLORS.warning : 
                       theme.COLORS.danger
              }
            ]}>
              {patient.health_score}/100
            </Text>
          </View>
        </View>
      )}
      
      {patient.conditions && patient.conditions.length > 0 && (
        <View style={styles.conditionsSection}>
          <Text style={styles.sectionLabel}>Conditions</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {patient.conditions.map((condition, idx) => (
              <View key={idx} style={styles.conditionTag}>
                <Text style={styles.conditionText}>{condition}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}
      
      <View style={styles.patientCardFooter}>
        <TouchableOpacity 
          style={styles.viewDetailsButton}
          onPress={() => handleViewPatient(patient)}
        >
          <Text style={styles.viewDetailsText}>View Details</Text>
          <Ionicons name="chevron-forward" size={16} color={theme.COLORS.primary} />
        </TouchableOpacity>
        
        {patient.status === 'pending' && (
          <View style={styles.pendingBadge}>
            <Ionicons name="time-outline" size={14} color={theme.COLORS.warning} />
            <Text style={styles.pendingText}>Awaiting Approval</Text>
          </View>
        )}
      </View>
    </Animated.View>
  );

  if (loading && patients.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.COLORS.primary} />
        <Text style={styles.loadingText}>Loading Patients...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <LinearGradient
        colors={['#ffffff', '#f8fafc']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View style={styles.headerLeftSection}>
            <TouchableOpacity 
              style={styles.backButton}
              onPress={() => router.back()}
            >
              <Ionicons name="arrow-back" size={24} color={theme.COLORS.textPrimary} />
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>Patient Management</Text>
              <Text style={styles.headerSubtitle}>Monitor and manage all patients</Text>
            </View>
          </View>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => setShowAddModal(true)}
          >
            <Ionicons name="person-add" size={24} color={theme.COLORS.primary} />
          </TouchableOpacity>
        </View>
        
        {/* Stats */}
        <View style={styles.statsContainer}>
          {renderStatCard('Total', stats.total, theme.COLORS.primary, 'people')}
          {renderStatCard('Active', stats.active, theme.COLORS.success, 'checkmark-circle')}
          {renderStatCard('Critical', stats.critical, theme.COLORS.danger, 'warning')}
          {renderStatCard('Pending', stats.pending, theme.COLORS.warning, 'time')}
        </View>
        
        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.COLORS.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search patients by name or ID..."
            placeholderTextColor={theme.COLORS.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={theme.COLORS.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
        
        {/* Filters */}
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          style={styles.filterScroll}
        >
          {(['all', 'critical', 'stable', 'pending'] as const).map((filter) => (
            <TouchableOpacity
              key={filter}
              style={[
                styles.filterChip,
                activeFilter === filter && styles.filterChipActive
              ]}
              onPress={() => setActiveFilter(filter)}
            >
              <Text style={[
                styles.filterText,
                activeFilter === filter && styles.filterTextActive
              ]}>
                {filter.charAt(0).toUpperCase() + filter.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </LinearGradient>

      {/* Patient List */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {filteredPatients.length > 0 ? (
          <View style={styles.patientList}>
            {filteredPatients.map((patient, index) => (
              <View key={patient.patient_id || index}>
                {renderPatientCard(patient, index)}
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={80} color={theme.COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>
              {searchQuery ? 'No patients found' : 'No patients yet'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'Try a different search term' : 'Add your first patient to get started'}
            </Text>
            <TouchableOpacity 
              style={styles.emptyActionButton}
              onPress={() => setShowAddModal(true)}
            >
              <Text style={styles.emptyActionText}>Add Patient</Text>
            </TouchableOpacity>
          </View>
        )}
        
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Add Patient Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowAddModal(false)}>
          <Animated.View 
            entering={SlideInUp}
            style={styles.modalContainer}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Connect with Patient</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
                <Ionicons name="close" size={24} color={theme.COLORS.textPrimary} />
              </TouchableOpacity>
            </View>
            
            <View style={styles.methodSelector}>
              <TouchableOpacity 
                style={[
                  styles.methodButton,
                  addPatientMethod === 'id' && styles.methodButtonActive
                ]}
                onPress={() => setAddPatientMethod('id')}
              >
                <Ionicons 
                  name="id-card" 
                  size={24} 
                  color={addPatientMethod === 'id' ? theme.COLORS.primary : theme.COLORS.textSecondary} 
                />
                <Text style={[
                  styles.methodText,
                  addPatientMethod === 'id' && styles.methodTextActive
                ]}>By ID</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.methodButton,
                  addPatientMethod === 'qr' && styles.methodButtonActive
                ]}
                onPress={handleScanQR}
              >
                <Ionicons 
                  name="qr-code" 
                  size={24} 
                  color={addPatientMethod === 'qr' ? theme.COLORS.primary : theme.COLORS.textSecondary} 
                />
                <Text style={[
                  styles.methodText,
                  addPatientMethod === 'qr' && styles.methodTextActive
                ]}>Scan QR</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[
                  styles.methodButton,
                  addPatientMethod === 'invite' && styles.methodButtonActive
                ]}
                onPress={() => setAddPatientMethod('invite')}
              >
                <Ionicons 
                  name="mail" 
                  size={24} 
                  color={addPatientMethod === 'invite' ? theme.COLORS.primary : theme.COLORS.textSecondary} 
                />
                <Text style={[
                  styles.methodText,
                  addPatientMethod === 'invite' && styles.methodTextActive
                ]}>Invite</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.modalForm}>
              <Text style={styles.inputLabel}>
                {addPatientMethod === 'id' ? 'Patient Caregiver ID' : 
                 addPatientMethod === 'invite' ? 'Patient ID' : 'Scan QR Code'}
              </Text>
              
              {addPatientMethod !== 'qr' ? (
                <TextInput
                  style={styles.modalInput}
                  placeholder={addPatientMethod === 'id' ? 'Enter patient caregiver ID' : 'Enter patient ID'}
                  placeholderTextColor={theme.COLORS.textTertiary}
                  value={patientId}
                  onChangeText={setPatientId}
                  autoCapitalize="characters"
                />
              ) : (
                <TouchableOpacity style={styles.qrScannerPlaceholder} onPress={handleScanQR}>
                  <Ionicons name="qr-code-outline" size={64} color={theme.COLORS.textTertiary} />
                  <Text style={styles.qrScannerText}>Tap to scan QR code</Text>
                </TouchableOpacity>
              )}
              
              {addPatientMethod !== 'qr' && (
                <>
                  <Text style={styles.inputLabel}>Your Relationship</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.relationshipScroll}>
                    {['family_member', 'professional', 'friend', 'guardian', 'other'].map((rel) => (
                      <TouchableOpacity
                        key={rel}
                        style={[
                          styles.relationshipOption,
                          relationshipType === rel && styles.relationshipOptionActive
                        ]}
                        onPress={() => setRelationshipType(rel)}
                      >
                        <Text style={[
                          styles.relationshipText,
                          relationshipType === rel && styles.relationshipTextActive
                        ]}>
                          {rel.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </>
              )}
              
              <TouchableOpacity 
                style={[
                  styles.connectButton,
                  (!patientId.trim() && addPatientMethod !== 'qr') && styles.connectButtonDisabled
                ]}
                onPress={addPatientMethod === 'qr' ? handleScanQR : handleConnectPatient}
                disabled={(!patientId.trim() && addPatientMethod !== 'qr') || addingPatient}
              >
                {addingPatient ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <>
                    <Ionicons 
                      name={addPatientMethod === 'qr' ? 'scan' : 'link'} 
                      size={20} 
                      color="#ffffff" 
                    />
                    <Text style={styles.connectButtonText}>
                      {addPatientMethod === 'qr' ? 'Scan QR Code' : 
                       addPatientMethod === 'invite' ? 'Send Invitation' : 'Connect Patient'}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* Export Options Modal */}
      <Modal
        visible={showExportOptions}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowExportOptions(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowExportOptions(false)}>
          <View style={styles.exportModal}>
            <Text style={styles.exportModalTitle}>
              Export {selectedPatient?.patient_name}'s Data
            </Text>
            
            <TouchableOpacity 
              style={styles.exportOption}
              onPress={() => {
                if (selectedPatient) {
                  handleExportPatientData(selectedPatient);
                  setShowExportOptions(false);
                }
              }}
            >
              <Ionicons name="document-text" size={24} color={theme.COLORS.primary} />
              <View style={styles.exportOptionText}>
                <Text style={styles.exportOptionTitle}>Export as JSON</Text>
                <Text style={styles.exportOptionDesc}>Export patient data in JSON format</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.exportOption}
              onPress={() => {
                if (selectedPatient) {
                  handleExportAsPDF(selectedPatient);
                  setShowExportOptions(false);
                }
              }}
            >
              <Ionicons name="document" size={24} color={theme.COLORS.primary} />
              <View style={styles.exportOptionText}>
                <Text style={styles.exportOptionTitle}>Export as PDF</Text>
                <Text style={styles.exportOptionDesc}>Generate a PDF report</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.exportOption}
              onPress={() => {
                // In a real app, you might export medical records
                Alert.alert('Medical Records', 'Medical records export would require hospital system integration');
                setShowExportOptions(false);
              }}
            >
              <Ionicons name="medical" size={24} color={theme.COLORS.primary} />
              <View style={styles.exportOptionText}>
                <Text style={styles.exportOptionTitle}>Medical Records</Text>
                <Text style={styles.exportOptionDesc}>Export full medical history</Text>
              </View>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.cancelExportButton}
              onPress={() => setShowExportOptions(false)}
            >
              <Text style={styles.cancelExportText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: theme.SPACING.md,
    color: theme.COLORS.textSecondary,
    fontSize: 16,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : StatusBar.currentHeight,
    paddingHorizontal: theme.SPACING.lg,
    paddingBottom: theme.SPACING.md,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.SPACING.md,
  },
  headerLeftSection: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    marginRight: theme.SPACING.md,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.COLORS.textPrimary,
  },
  headerSubtitle: {
    fontSize: 14,
    color: theme.COLORS.textSecondary,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: theme.SPACING.lg,
    marginBottom: theme.SPACING.lg,
  },
  statCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: theme.SPACING.sm,
    width: (width - theme.SPACING.lg * 2 - theme.SPACING.sm * 3) / 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.COLORS.textPrimary,
  },
  statLabel: {
    fontSize: 10,
    color: theme.COLORS.textSecondary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    marginHorizontal: theme.SPACING.lg,
    paddingHorizontal: theme.SPACING.md,
    height: 44,
    borderRadius: 12,
    marginBottom: theme.SPACING.md,
  },
  searchInput: {
    flex: 1,
    marginLeft: theme.SPACING.sm,
    fontSize: 16,
    color: theme.COLORS.textPrimary,
  },
  filterScroll: {
    paddingHorizontal: theme.SPACING.lg,
    paddingBottom: theme.SPACING.md,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginRight: theme.SPACING.sm,
  },
  filterChipActive: {
    backgroundColor: theme.COLORS.primary,
  },
  filterText: {
    fontSize: 14,
    color: theme.COLORS.textSecondary,
    fontWeight: '500',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  scrollView: {
    flex: 1,
  },
  patientList: {
    padding: theme.SPACING.lg,
  },
  patientCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: theme.SPACING.md,
    marginBottom: theme.SPACING.md,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  patientCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  patientInfoSection: {
    flexDirection: 'row',
    flex: 1,
  },
  patientAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: '#f1f5f9',
  },
  patientTextInfo: {
    marginLeft: theme.SPACING.md,
    flex: 1,
  },
  nameStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  patientName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.COLORS.textPrimary,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  patientId: {
    fontSize: 12,
    color: theme.COLORS.textTertiary,
    marginBottom: 4,
  },
  patientMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  patientMetaText: {
    fontSize: 12,
    color: theme.COLORS.textSecondary,
    marginRight: 8,
  },
  lastCheckup: {
    fontSize: 12,
    color: theme.COLORS.textTertiary,
  },
  patientActions: {
    flexDirection: 'column',
    justifyContent: 'space-between',
    marginLeft: theme.SPACING.sm,
  },
  actionButton: {
    padding: 8,
  },
  healthScoreSection: {
    marginTop: theme.SPACING.md,
  },
  healthScoreLabel: {
    fontSize: 12,
    color: theme.COLORS.textSecondary,
    marginBottom: 4,
  },
  scoreBarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  scoreBarBackground: {
    flex: 1,
    height: 6,
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    marginRight: theme.SPACING.sm,
    overflow: 'hidden',
  },
  scoreBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  scoreValue: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  conditionsSection: {
    marginTop: theme.SPACING.md,
  },
  sectionLabel: {
    fontSize: 12,
    color: theme.COLORS.textSecondary,
    marginBottom: 8,
  },
  conditionTag: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 8,
  },
  conditionText: {
    fontSize: 12,
    color: theme.COLORS.textSecondary,
  },
  patientCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: theme.SPACING.md,
    paddingTop: theme.SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  viewDetailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewDetailsText: {
    fontSize: 14,
    color: theme.COLORS.primary,
    fontWeight: '600',
    marginRight: 4,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.COLORS.warningLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  pendingText: {
    fontSize: 12,
    color: theme.COLORS.warning,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.SPACING.xl * 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.COLORS.textPrimary,
    marginTop: theme.SPACING.md,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.COLORS.textSecondary,
    marginTop: theme.SPACING.sm,
    marginBottom: theme.SPACING.lg,
    textAlign: 'center',
  },
  emptyActionButton: {
    backgroundColor: theme.COLORS.primary,
    paddingHorizontal: theme.SPACING.xl,
    paddingVertical: theme.SPACING.md,
    borderRadius: 12,
  },
  emptyActionText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: theme.SPACING.lg,
    minHeight: '60%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.SPACING.xl,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.COLORS.textPrimary,
  },
  methodSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.SPACING.xl,
  },
  methodButton: {
    flex: 1,
    alignItems: 'center',
    padding: theme.SPACING.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.COLORS.border,
    marginHorizontal: 4,
  },
  methodButtonActive: {
    borderColor: theme.COLORS.primary,
    backgroundColor: theme.COLORS.primary + '10',
  },
  methodText: {
    marginTop: 8,
    fontSize: 12,
    color: theme.COLORS.textSecondary,
    fontWeight: '500',
  },
  methodTextActive: {
    color: theme.COLORS.primary,
    fontWeight: 'bold',
  },
  modalForm: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.COLORS.textPrimary,
    marginBottom: theme.SPACING.sm,
  },
  modalInput: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: theme.SPACING.md,
    fontSize: 16,
    color: theme.COLORS.textPrimary,
    borderWidth: 1,
    borderColor: theme.COLORS.border,
    marginBottom: theme.SPACING.lg,
  },
  qrScannerPlaceholder: {
    height: 200,
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    borderWidth: 2,
    borderColor: theme.COLORS.border,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: theme.SPACING.lg,
  },
  qrScannerText: {
    marginTop: theme.SPACING.md,
    color: theme.COLORS.textTertiary,
    fontSize: 14,
  },
  relationshipScroll: {
    marginBottom: theme.SPACING.xl,
  },
  relationshipOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginRight: 8,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  relationshipOptionActive: {
    backgroundColor: theme.COLORS.primary + '10',
    borderColor: theme.COLORS.primary,
  },
  relationshipText: {
    fontSize: 14,
    color: theme.COLORS.textSecondary,
  },
  relationshipTextActive: {
    color: theme.COLORS.primary,
    fontWeight: '600',
  },
  connectButton: {
    backgroundColor: theme.COLORS.primary,
    padding: theme.SPACING.md,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
  },
  connectButtonDisabled: {
    opacity: 0.5,
  },
  connectButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  exportModal: {
    backgroundColor: '#ffffff',
    margin: theme.SPACING.xl,
    borderRadius: 24,
    padding: theme.SPACING.lg,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  exportModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.COLORS.textPrimary,
    marginBottom: theme.SPACING.lg,
    textAlign: 'center',
  },
  exportOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.SPACING.md,
    borderRadius: 12,
    backgroundColor: '#f8fafc',
    marginBottom: theme.SPACING.md,
  },
  exportOptionText: {
    marginLeft: theme.SPACING.md,
  },
  exportOptionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.COLORS.textPrimary,
  },
  exportOptionDesc: {
    fontSize: 12,
    color: theme.COLORS.textSecondary,
  },
  cancelExportButton: {
    padding: theme.SPACING.md,
    alignItems: 'center',
    marginTop: theme.SPACING.sm,
  },
  cancelExportText: {
    fontSize: 16,
    color: theme.COLORS.textSecondary,
    fontWeight: '600',
  },
});

export default PatientsScreen;