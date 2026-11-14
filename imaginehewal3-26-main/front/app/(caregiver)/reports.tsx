import React, { useState } from 'react';
import { StyleSheet, View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function ReportsScreen() {
  const router = useRouter();
  const brandColor = 'rgb(173, 0, 35)';
  
  const [reports, setReports] = useState([
    {
      id: '1',
      title: 'Weekly Health Summary',
      patient: 'Alex Morgan',
      date: 'Jan 15, 2024',
      type: 'summary',
      status: 'generated'
    },
    {
      id: '2',
      title: 'Medication Adherence Report',
      patient: 'Sarah Jenkins',
      date: 'Jan 14, 2024',
      type: 'medication',
      status: 'pending'
    },
    {
      id: '3',
      title: 'Monthly Progress Report',
      patient: 'Robert Chen',
      date: 'Jan 10, 2024',
      type: 'progress',
      status: 'generated'
    },
    {
      id: '4',
      title: 'Lab Results Analysis',
      patient: 'Alex Morgan',
      date: 'Jan 8, 2024',
      type: 'lab',
      status: 'generated'
    },
    {
      id: '5',
      title: 'Vital Signs Trend',
      patient: 'All Patients',
      date: 'Jan 5, 2024',
      type: 'trend',
      status: 'generated'
    }
  ]);

  const [selectedFilter, setSelectedFilter] = useState('all');

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'summary': return brandColor;
      case 'medication': return '#F59E0B';
      case 'progress': return '#10B981';
      case 'lab': return '#3B82F6';
      case 'trend': return '#8B5CF6';
      default: return '#666';
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'summary': return 'document-text';
      case 'medication': return 'medical';
      case 'progress': return 'trending-up';
      case 'lab': return 'flask';
      case 'trend': return 'analytics';
      default: return 'document';
    }
  };

  const handleGenerateReport = () => {
    Alert.alert(
      'Generate Report',
      'Select report type:',
      [
        { text: 'Weekly Summary', onPress: () => console.log('Weekly Summary') },
        { text: 'Medication Report', onPress: () => console.log('Medication Report') },
        { text: 'Progress Report', onPress: () => console.log('Progress Report') },
        { text: 'Cancel', style: 'cancel' }
      ]
    );
  };

  const handleShareReport = (reportId: string) => {
    Alert.alert('Share Report', 'Report sharing options...');
  };

  const filteredReports = selectedFilter === 'all' 
    ? reports 
    : reports.filter(report => report.type === selectedFilter);

  const stats = {
    total: reports.length,
    generated: reports.filter(r => r.status === 'generated').length,
    pending: reports.filter(r => r.status === 'pending').length,
    thisWeek: 3
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Health Reports</Text>
        <TouchableOpacity 
          style={styles.generateButton}
          onPress={handleGenerateReport}
        >
          <Ionicons name="add" size={24} color={brandColor} />
        </TouchableOpacity>
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{stats.total}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#10B981' }]}>{stats.generated}</Text>
          <Text style={styles.statLabel}>Generated</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: '#F59E0B' }]}>{stats.pending}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statValue, { color: brandColor }]}>{stats.thisWeek}</Text>
          <Text style={styles.statLabel}>This Week</Text>
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
          style={[styles.filterButton, selectedFilter === 'summary' && styles.filterActive]}
          onPress={() => setSelectedFilter('summary')}
        >
          <Text style={[styles.filterText, selectedFilter === 'summary' && styles.filterActiveText]}>
            Summary
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterButton, selectedFilter === 'medication' && styles.filterActive]}
          onPress={() => setSelectedFilter('medication')}
        >
          <Text style={[styles.filterText, selectedFilter === 'medication' && styles.filterActiveText]}>
            Medication
          </Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterButton, selectedFilter === 'progress' && styles.filterActive]}
          onPress={() => setSelectedFilter('progress')}
        >
          <Text style={[styles.filterText, selectedFilter === 'progress' && styles.filterActiveText]}>
            Progress
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Reports</Text>
        
        {filteredReports.map((report) => (
          <TouchableOpacity key={report.id} style={styles.reportCard}>
            <View style={[
              styles.reportIcon,
              { backgroundColor: `${getTypeColor(report.type)}20` }
            ]}>
              <Ionicons 
                name={getTypeIcon(report.type) as any} 
                size={20} 
                color={getTypeColor(report.type)} 
              />
            </View>
            
            <View style={styles.reportInfo}>
              <Text style={styles.reportTitle}>{report.title}</Text>
              <View style={styles.reportMeta}>
                <Text style={styles.reportPatient}>{report.patient}</Text>
                <Text style={styles.reportDate}>{report.date}</Text>
              </View>
              <View style={styles.reportStatus}>
                <View style={[
                  styles.statusBadge,
                  { backgroundColor: report.status === 'generated' ? '#10B98120' : '#F59E0B20' }
                ]}>
                  <Text style={[
                    styles.statusText,
                    { color: report.status === 'generated' ? '#10B981' : '#F59E0B' }
                  ]}>
                    {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                  </Text>
                </View>
              </View>
            </View>
            
            <View style={styles.reportActions}>
              <TouchableOpacity 
                style={styles.actionButton}
                onPress={() => handleShareReport(report.id)}
              >
                <Ionicons name="share-outline" size={18} color="#666" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton}>
                <Ionicons name="download-outline" size={18} color="#666" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        ))}

        {filteredReports.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialCommunityIcons name="file-document-outline" size={64} color="#CCC" />
            <Text style={styles.emptyText}>No reports found</Text>
            <Text style={styles.emptySubtext}>Try a different filter</Text>
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        
        <View style={styles.quickActions}>
          <TouchableOpacity style={styles.quickAction}>
            <View style={[styles.quickIcon, { backgroundColor: `${brandColor}20` }]}>
              <Ionicons name="print-outline" size={24} color={brandColor} />
            </View>
            <Text style={styles.quickText}>Print</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickAction}>
            <View style={[styles.quickIcon, { backgroundColor: '#10B98120' }]}>
              <Ionicons name="mail-outline" size={24} color="#10B981" />
            </View>
            <Text style={styles.quickText}>Email</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickAction}>
            <View style={[styles.quickIcon, { backgroundColor: '#3B82F620' }]}>
              <Ionicons name="cloud-upload-outline" size={24} color="#3B82F6" />
            </View>
            <Text style={styles.quickText}>Upload</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.quickAction}>
            <View style={[styles.quickIcon, { backgroundColor: '#8B5CF620' }]}>
              <Ionicons name="archive-outline" size={24} color="#8B5CF6" />
            </View>
            <Text style={styles.quickText}>Archive</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Report Templates</Text>
        
        <View style={styles.templatesContainer}>
          <TouchableOpacity style={styles.templateCard}>
            <Ionicons name="calendar-outline" size={24} color={brandColor} />
            <Text style={styles.templateTitle}>Weekly Summary</Text>
            <Text style={styles.templateDesc}>Patient health overview</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.templateCard}>
            <MaterialCommunityIcons name="pill" size={24} color="#F59E0B" />
            <Text style={styles.templateTitle}>Medication Report</Text>
            <Text style={styles.templateDesc}>Adherence analytics</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.templateCard}>
            <Ionicons name="trending-up-outline" size={24} color="#10B981" />
            <Text style={styles.templateTitle}>Progress Report</Text>
            <Text style={styles.templateDesc}>Monthly progress</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.templateCard}>
            <MaterialCommunityIcons name="flask" size={24} color="#3B82F6" />
            <Text style={styles.templateTitle}>Lab Analysis</Text>
            <Text style={styles.templateDesc}>Test results</Text>
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
  generateButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  
  statsContainer: { flexDirection: 'row', backgroundColor: 'white', padding: 20 },
  statCard: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 5 },
  statLabel: { fontSize: 12, color: '#666' },
  
  filterContainer: { flexDirection: 'row', backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 15, gap: 10 },
  filterButton: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F3F4F6' },
  filterActive: { backgroundColor: 'rgb(173, 0, 35)' },
  filterText: { fontSize: 14, color: '#666', fontWeight: '500' },
  filterActiveText: { color: 'white' },
  
  section: { backgroundColor: 'white', padding: 20, marginTop: 10 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', color: '#1A1A1A', marginBottom: 15 },
  
  reportCard: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  reportIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  reportInfo: { flex: 1 },
  reportTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A1A' },
  reportMeta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  reportPatient: { fontSize: 12, color: '#666' },
  reportDate: { fontSize: 12, color: '#666' },
  reportStatus: { marginTop: 6 },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  reportActions: { flexDirection: 'row', gap: 8 },
  actionButton: { padding: 8 },
  
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#999', marginTop: 16 },
  emptySubtext: { fontSize: 13, color: '#BBB', marginTop: 4 },
  
  quickActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  quickAction: { alignItems: 'center', flex: 1 },
  quickIcon: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  quickText: { fontSize: 12, color: '#666', textAlign: 'center' },
  
  templatesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  templateCard: { width: '48%', backgroundColor: '#F8F9FA', padding: 16, borderRadius: 12, alignItems: 'center' },
  templateTitle: { fontSize: 14, fontWeight: '600', color: '#1A1A1A', marginTop: 8, textAlign: 'center' },
  templateDesc: { fontSize: 12, color: '#666', marginTop: 2, textAlign: 'center' }
});