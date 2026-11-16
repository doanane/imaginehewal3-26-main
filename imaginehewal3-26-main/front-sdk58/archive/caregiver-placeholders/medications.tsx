import React, { useState } from 'react';
import { StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons, MaterialCommunityIcons, ScrollView, Text, TouchableOpacity, View } from '../../components/themed';

const brandColor = 'rgb(173, 0, 35)';

export default function MedicationsScreen() {
  const router = useRouter();
  
  const [medications, setMedications] = useState([
    {
      id: '1',
      name: 'Lisinopril',
      patient: 'Alex Morgan',
      dosage: '10mg',
      frequency: 'Once daily',
      time: '08:00 AM',
      status: 'active',
      adherence: 95,
      refills: 2,
      nextRefill: 'Jan 30, 2024'
    },
    {
      id: '2',
      name: 'Metformin',
      patient: 'Alex Morgan',
      dosage: '500mg',
      frequency: 'Twice daily',
      time: '08:00 AM, 08:00 PM',
      status: 'active',
      adherence: 88,
      refills: 1,
      nextRefill: 'Feb 5, 2024'
    },
    {
      id: '3',
      name: 'Atorvastatin',
      patient: 'Sarah Jenkins',
      dosage: '20mg',
      frequency: 'Once daily',
      time: '09:00 PM',
      status: 'active',
      adherence: 92,
      refills: 3,
      nextRefill: 'Feb 15, 2024'
    },
    {
      id: '4',
      name: 'Albuterol',
      patient: 'Robert Chen',
      dosage: '2 puffs',
      frequency: 'As needed',
      time: 'PRN',
      status: 'active',
      adherence: 100,
      refills: 1,
      nextRefill: 'Jan 25, 2024'
    },
    {
      id: '5',
      name: 'Warfarin',
      patient: 'Alex Morgan',
      dosage: '5mg',
      frequency: 'Once daily',
      time: '06:00 PM',
      status: 'discontinued',
      adherence: 0,
      refills: 0,
      nextRefill: 'N/A'
    }
  ]);

  const [selectedFilter, setSelectedFilter] = useState('all');

  const getAdherenceColor = (adherence: number) => {
    if (adherence >= 90) return '#10B981';
    if (adherence >= 75) return '#F59E0B';
    return '#EF4444';
  };

  const getStatusColor = (status: string) => {
    return status === 'active' ? '#10B981' : '#666';
  };

  const handleRefillRequest = (medicationId: string) => {
    Alert.alert(
      'Request Refill',
      'Send refill request to pharmacy?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Request',
          onPress: () => {
            Alert.alert('Success', 'Refill request sent to pharmacy');
          }
        }
      ]
    );
  };

  const handleLogDose = (medicationId: string) => {
    Alert.alert('Log Dose', 'Dose logged successfully');
  };

  const filteredMedications = selectedFilter === 'all' 
    ? medications 
    : selectedFilter === 'active' 
    ? medications.filter(med => med.status === 'active')
    : medications.filter(med => med.status === 'discontinued');

  const stats = {
    total: medications.length,
    active: medications.filter(m => m.status === 'active').length,
    lowAdherence: medications.filter(m => m.adherence < 80).length,
    needsRefill: medications.filter(m => m.refills < 2).length
  };

  const upcomingRefills = medications
    .filter(m => m.status === 'active' && m.refills > 0)
    .sort((a, b) => new Date(a.nextRefill).getTime() - new Date(b.nextRefill).getTime())
    .slice(0, 3);

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Medications</Text>
        <TouchableOpacity style={styles.addButton}>
          <Ionicons name="add" size={24} color={brandColor} />
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#10B981' }]}>{stats.active}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#EF4444' }]}>{stats.lowAdherence}</Text>
          <Text style={styles.statLabel}>Low Adherence</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: brandColor }]}>{stats.needsRefill}</Text>
          <Text style={styles.statLabel}>Needs Refill</Text>
        </View>
      </View>

      <View style={styles.filterContainer}>
        <TouchableOpacity 
          style={[styles.filterButton, selectedFilter === 'all' && styles.filterActive]}
          onPress={() => setSelectedFilter('all')}
        >
          <Text style={[styles.filterText, selectedFilter === 'all' && styles.filterActiveText]}>
            All
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterButton, selectedFilter === 'active' && styles.filterActive]}
          onPress={() => setSelectedFilter('active')}
        >
          <Text style={[styles.filterText, selectedFilter === 'active' && styles.filterActiveText]}>
            Active
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterButton, selectedFilter === 'discontinued' && styles.filterActive]}
          onPress={() => setSelectedFilter('discontinued')}
        >
          <Text style={[styles.filterText, selectedFilter === 'discontinued' && styles.filterActiveText]}>
            Discontinued
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterButton, selectedFilter === 'refill' && styles.filterActive]}
          onPress={() => setSelectedFilter('refill')}
        >
          <Text style={[styles.filterText, selectedFilter === 'refill' && styles.filterActiveText]}>
            Needs Refill
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Medication List ({filteredMedications.length})</Text>
        
        {filteredMedications.map((medication) => (
          <TouchableOpacity key={medication.id} style={styles.medicationCard}>
            <View style={[
              styles.medicationStatus,
              { backgroundColor: `${getStatusColor(medication.status)}20` }
            ]}>
              <MaterialCommunityIcons 
                name="pill" 
                size={20} 
                color={getStatusColor(medication.status)} 
              />
            </View>
            
            <View style={styles.medicationInfo}>
              <View style={styles.medicationHeader}>
                <Text style={styles.medicationName}>{medication.name}</Text>
                <View style={[
                  styles.adherenceBadge,
                  { backgroundColor: `${getAdherenceColor(medication.adherence)}20` }
                ]}>
                  <Text style={[
                    styles.adherenceText,
                    { color: getAdherenceColor(medication.adherence) }
                  ]}>
                    {medication.adherence}%
                  </Text>
                </View>
              </View>
              
              <Text style={styles.medicationPatient}>{medication.patient}</Text>
              
              <View style={styles.medicationDetails}>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Dosage</Text>
                  <Text style={styles.detailValue}>{medication.dosage}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Frequency</Text>
                  <Text style={styles.detailValue}>{medication.frequency}</Text>
                </View>
                <View style={styles.detailItem}>
                  <Text style={styles.detailLabel}>Time</Text>
                  <Text style={styles.detailValue}>{medication.time}</Text>
                </View>
              </View>
              
              <View style={styles.medicationFooter}>
                <View style={styles.refillInfo}>
                  <Ionicons name="refresh-circle-outline" size={14} color="#666" />
                  <Text style={styles.refillText}>
                    {medication.refills} refills • Next: {medication.nextRefill}
                  </Text>
                </View>
                
                <View style={styles.medicationActions}>
                  {medication.status === 'active' && (
                    <>
                      <TouchableOpacity 
                        style={styles.actionButton}
                        onPress={() => handleLogDose(medication.id)}
                      >
                        <Ionicons name="checkmark-circle-outline" size={18} color="#10B981" />
                      </TouchableOpacity>
                      <TouchableOpacity 
                        style={styles.actionButton}
                        onPress={() => handleRefillRequest(medication.id)}
                      >
                        <Ionicons name="refresh-outline" size={18} color={brandColor} />
                      </TouchableOpacity>
                    </>
                  )}
                  <TouchableOpacity style={styles.actionButton}>
                    <Ionicons name="ellipsis-vertical" size={18} color="#999" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {filteredMedications.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="pill-off" size={64} color="#CCC" />
            <Text style={styles.emptyText}>No medications found</Text>
            <Text style={styles.emptySubtext}>Try a different filter</Text>
          </View>
        )}
      </View>

      {upcomingRefills.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Upcoming Refills</Text>
          
          {upcomingRefills.map((medication) => (
            <View key={medication.id} style={styles.refillCard}>
              <View style={styles.refillInfoMain}>
                <Text style={styles.refillMedication}>{medication.name}</Text>
                <Text style={styles.refillPatient}>{medication.patient}</Text>
              </View>
              <View style={styles.refillDateContainer}>
                <Text style={styles.refillDate}>{medication.nextRefill}</Text>
                <TouchableOpacity 
                  style={styles.refillButton}
                  onPress={() => handleRefillRequest(medication.id)}
                >
                  <Text style={styles.refillButtonText}>Request</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction}>
            <View style={[styles.quickIcon, { backgroundColor: `${brandColor}20` }]}>
              <Ionicons name="add-circle-outline" size={24} color={brandColor} />
            </View>
            <Text style={styles.quickText}>Add Med</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickAction}>
            <View style={[styles.quickIcon, { backgroundColor: '#10B98120' }]}>
              <Ionicons name="calendar-outline" size={24} color="#10B981" />
            </View>
            <Text style={styles.quickText}>Schedule</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickAction}>
            <View style={[styles.quickIcon, { backgroundColor: '#3B82F620' }]}>
              <Ionicons name="document-text-outline" size={24} color="#3B82F6" />
            </View>
            <Text style={styles.quickText}>History</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickAction}>
            <View style={[styles.quickIcon, { backgroundColor: '#8B5CF620' }]}>
              <MaterialCommunityIcons name="hospital-box" size={24} color="#8B5CF6" />
            </View>
            <Text style={styles.quickText}>Pharmacy</Text>
          </TouchableOpacity>
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
  addButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  
  statsContainer: { flexDirection: 'row', backgroundColor: 'white', padding: 20 },
  statCard: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 5 },
  statLabel: { fontSize: 12, color: '#666' },
  
  filterContainer: { flexDirection: 'row', backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 15, gap: 10 },
  filterButton: { flex: 1, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center' },
  filterActive: { backgroundColor: 'rgb(173, 0, 35)' },
  filterText: { fontSize: 14, color: '#666', fontWeight: '500' },
  filterActiveText: { color: 'white' },
  
  section: { backgroundColor: 'white', padding: 20, marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 15 },
  
  medicationCard: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  medicationStatus: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  medicationInfo: { flex: 1 },
  medicationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  medicationName: { fontSize: 16, fontWeight: '600', color: '#1A1A1A' },
  adherenceBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  adherenceText: { fontSize: 12, fontWeight: 'bold' },
  medicationPatient: { fontSize: 12, color: '#666', marginTop: 2 },
  medicationDetails: { flexDirection: 'row', marginTop: 8 },
  detailItem: { flex: 1 },
  detailLabel: { fontSize: 10, color: '#999', marginBottom: 2 },
  detailValue: { fontSize: 12, color: '#1A1A1A', fontWeight: '500' },
  medicationFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
  refillInfo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  refillText: { fontSize: 12, color: '#666' },
  medicationActions: { flexDirection: 'row', gap: 8 },
  actionButton: { padding: 4 },
  
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#999', marginTop: 16 },
  emptySubtext: { fontSize: 13, color: '#BBB', marginTop: 4 },
  
  refillCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, backgroundColor: '#F8F9FA', borderRadius: 8, marginBottom: 8 },
  refillInfoMain: { flex: 1 },
  refillMedication: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  refillPatient: { fontSize: 12, color: '#666', marginTop: 2 },
  refillDateContainer: { alignItems: 'flex-end' },
  refillDate: { fontSize: 12, color: '#666', marginBottom: 4 },
  refillButton: { backgroundColor: brandColor, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 6 },
  refillButtonText: { fontSize: 12, color: 'white', fontWeight: '500' },
  
  quickActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  quickAction: { alignItems: 'center', flex: 1 },
  quickIcon: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  quickText: { fontSize: 12, color: '#666', textAlign: 'center' }
});