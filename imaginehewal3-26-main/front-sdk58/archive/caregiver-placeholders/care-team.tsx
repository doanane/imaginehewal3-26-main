import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Modal,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { theme, GRADIENTS } from '../../constants/theme';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { ActivityIndicator, Image, Ionicons, LinearGradient, MaterialIcons, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from '../../components/themed';

interface TeamMember {
  id: number;
  name: string;
  role: string;
  email: string;
  phone?: string;
  specialty?: string;
  is_primary: boolean;
  status: 'active' | 'inactive';
  avatar_url?: string;
  last_active?: string;
}

interface PatientTeam {
  patient_id: number;
  patient_name: string;
  team_members: TeamMember[];
}

export default function CareTeamScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [patientTeams, setPatientTeams] = useState<PatientTeam[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<PatientTeam | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [formData, setFormData] = useState({
    patient_id: '',
    name: '',
    role: '',
    email: '',
    phone: '',
    specialty: '',
    is_primary: false,
  });

  const fetchCareTeams = async () => {
    try {
      setLoading(true);
      
      // TODO: Replace with actual API calls
      // Mock data for now
      const mockTeams: PatientTeam[] = [
        {
          patient_id: 1,
          patient_name: 'John Doe',
          team_members: [
            {
              id: 1,
              name: 'Dr. Sarah Johnson',
              role: 'Primary Doctor',
              email: 'sarah.j@hospital.com',
              phone: '+1234567890',
              specialty: 'Cardiology',
              is_primary: true,
              status: 'active',
              last_active: '2 hours ago',
            },
            {
              id: 2,
              name: 'Nurse Jane Smith',
              role: 'Primary Nurse',
              email: 'jane.s@hospital.com',
              phone: '+1234567891',
              specialty: 'Geriatric Care',
              is_primary: false,
              status: 'active',
              last_active: '30 minutes ago',
            },
            {
              id: 3,
              name: 'Dr. Michael Chen',
              role: 'Specialist',
              email: 'michael.c@hospital.com',
              phone: '+1234567892',
              specialty: 'Endocrinology',
              is_primary: false,
              status: 'active',
              last_active: '1 day ago',
            },
          ],
        },
        {
          patient_id: 2,
          patient_name: 'Jane Smith',
          team_members: [
            {
              id: 4,
              name: 'Dr. Robert Wilson',
              role: 'Primary Doctor',
              email: 'robert.w@hospital.com',
              phone: '+1234567893',
              specialty: 'Neurology',
              is_primary: true,
              status: 'active',
              last_active: '5 hours ago',
            },
            {
              id: 5,
              name: 'Therapist Amy Lee',
              role: 'Physical Therapist',
              email: 'amy.l@rehab.com',
              phone: '+1234567894',
              specialty: 'Physical Therapy',
              is_primary: false,
              status: 'active',
              last_active: '2 days ago',
            },
          ],
        },
      ];

      setPatientTeams(mockTeams);
    } catch (error) {
      console.error('Error fetching care teams:', error);
      Alert.alert('Error', 'Failed to load care team data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCareTeams();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCareTeams();
  };

  const handleAddTeamMember = () => {
    // TODO: Implement API call
    Alert.alert('Success', 'Team member added successfully');
    setShowAddModal(false);
    setFormData({
      patient_id: '',
      name: '',
      role: '',
      email: '',
      phone: '',
      specialty: '',
      is_primary: false,
    });
  };

  const handleRemoveTeamMember = (patientId: number, memberId: number) => {
    Alert.alert(
      'Remove Team Member',
      'Are you sure you want to remove this team member?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            // TODO: Implement API call
            setPatientTeams(teams =>
              teams.map(team =>
                team.patient_id === patientId
                  ? {
                      ...team,
                      team_members: team.team_members.filter(m => m.id !== memberId),
                    }
                  : team
              )
            );
          },
        },
      ]
    );
  };

  const getRoleColor = (role: string) => {
    switch (role.toLowerCase()) {
      case 'doctor':
      case 'primary doctor':
        return theme.COLORS.primary;
      case 'nurse':
        return theme.COLORS.info;
      case 'therapist':
        return theme.COLORS.success;
      case 'specialist':
        return theme.COLORS.warning;
      default:
        return theme.COLORS.textTertiary;
    }
  };

  const getStatusColor = (status: string) => {
    return status === 'active' ? theme.COLORS.success : theme.COLORS.textTertiary;
  };

  const filteredTeams = patientTeams.filter(team =>
    team.patient_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    team.team_members.some(member =>
      member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.role.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  if (loading && patientTeams.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.COLORS.primary} />
        <Text style={styles.loadingText}>Loading care teams...</Text>
      </View>
    );
  }

  return (
    <LinearGradient
      colors={GRADIENTS.authBackground}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          style={styles.container}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={theme.COLORS.textOnDark} />
            </TouchableOpacity>
            <Text style={styles.title}>Care Teams</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => setShowAddModal(true)}
            >
              <Ionicons name="person-add" size={24} color={theme.COLORS.primary} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={theme.COLORS.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search patients or team members..."
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

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {patientTeams.reduce((total, team) => total + team.team_members.length, 0)}
              </Text>
              <Text style={styles.statLabel}>Total Members</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.COLORS.success }]}>
                {patientTeams.reduce(
                  (total, team) =>
                    total + team.team_members.filter(m => m.status === 'active').length,
                  0
                )}
              </Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{patientTeams.length}</Text>
              <Text style={styles.statLabel}>Patients</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.COLORS.primary }]}>
                {patientTeams.reduce(
                  (total, team) => total + team.team_members.filter(m => m.is_primary).length,
                  0
                )}
              </Text>
              <Text style={styles.statLabel}>Primary</Text>
            </View>
          </View>

          {/* Patient Teams */}
          {filteredTeams.map((team) => (
            <View key={team.patient_id} style={styles.teamCard}>
              <View style={styles.teamHeader}>
                <View style={styles.patientInfo}>
                  <View style={styles.patientAvatar}>
                    <Text style={styles.patientInitials}>
                      {team.patient_name
                        .split(' ')
                        .map(n => n[0])
                        .join('')}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.patientName}>{team.patient_name}</Text>
                    <Text style={styles.teamSize}>
                      {team.team_members.length} team members
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={styles.addMemberButton}
                  onPress={() => {
                    setSelectedPatient(team);
                    setFormData(prev => ({ ...prev, patient_id: team.patient_id.toString() }));
                    setShowAddModal(true);
                  }}
                >
                  <Ionicons name="add" size={20} color={theme.COLORS.primary} />
                </TouchableOpacity>
              </View>

              <View style={styles.membersList}>
                {team.team_members.map((member) => (
                  <View key={member.id} style={styles.memberCard}>
                    <View style={styles.memberInfo}>
                      <View style={styles.memberAvatar}>
                        {member.avatar_url ? (
                          <Image
                            source={{ uri: member.avatar_url }}
                            style={styles.avatarImage}
                          />
                        ) : (
                          <Text style={styles.memberInitials}>
                            {member.name
                              .split(' ')
                              .map(n => n[0])
                              .join('')}
                          </Text>
                        )}
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: getStatusColor(member.status) },
                          ]}
                        />
                      </View>
                      <View style={styles.memberDetails}>
                        <View style={styles.memberHeader}>
                          <Text style={styles.memberName}>{member.name}</Text>
                          {member.is_primary && (
                            <View style={styles.primaryBadge}>
                              <Text style={styles.primaryText}>PRIMARY</Text>
                            </View>
                          )}
                        </View>
                        <Text style={[styles.memberRole, { color: getRoleColor(member.role) }]}>
                          {member.role}
                        </Text>
                        {member.specialty && (
                          <Text style={styles.memberSpecialty}>{member.specialty}</Text>
                        )}
                        <View style={styles.memberContact}>
                          {member.email && (
                            <View style={styles.contactItem}>
                              <Ionicons name="mail" size={12} color={theme.COLORS.textSecondary} />
                              <Text style={styles.contactText}>{member.email}</Text>
                            </View>
                          )}
                          {member.phone && (
                            <View style={styles.contactItem}>
                              <Ionicons name="call" size={12} color={theme.COLORS.textSecondary} />
                              <Text style={styles.contactText}>{member.phone}</Text>
                            </View>
                          )}
                        </View>
                        {member.last_active && (
                          <Text style={styles.lastActive}>
                            Last active: {member.last_active}
                          </Text>
                        )}
                      </View>
                    </View>
                    <View style={styles.memberActions}>
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => {
                          // TODO: Implement contact action
                          Alert.alert('Contact', `Contact ${member.name}`);
                        }}
                      >
                        <Ionicons name="chatbubble" size={20} color={theme.COLORS.primary} />
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionButton, styles.removeButton]}
                        onPress={() => handleRemoveTeamMember(team.patient_id, member.id)}
                      >
                        <Ionicons name="trash" size={20} color={theme.COLORS.danger} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          ))}

          {filteredTeams.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialIcons name="group" size={64} color={theme.COLORS.textTertiary} />
              <Text style={styles.emptyText}>
                {searchQuery ? 'No results found' : 'No care teams yet'}
              </Text>
              <Text style={styles.emptySubtext}>
                {searchQuery
                  ? 'Try a different search term'
                  : 'Add team members to get started'}
              </Text>
              <TouchableOpacity
                style={styles.createButton}
                onPress={() => setShowAddModal(true)}
              >
                <Text style={styles.createButtonText}>Add Team Member</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Add Team Member Modal */}
        <Modal
          visible={showAddModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAddModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Add Team Member</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <Ionicons name="close" size={24} color={theme.COLORS.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalForm}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Patient *</Text>
                  <View style={styles.patientSelect}>
                    <Text style={styles.patientSelectText}>
                      {selectedPatient
                        ? selectedPatient.patient_name
                        : 'Select a patient'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={theme.COLORS.textSecondary} />
                  </View>
                  {!selectedPatient && (
                    <ScrollView horizontal style={styles.patientOptions}>
                      {patientTeams.map(team => (
                        <TouchableOpacity
                          key={team.patient_id}
                          style={styles.patientOption}
                          onPress={() => {
                            setSelectedPatient(team);
                            setFormData(prev => ({
                              ...prev,
                              patient_id: team.patient_id.toString(),
                            }));
                          }}
                        >
                          <Text style={styles.patientOptionText}>
                            {team.patient_name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  )}
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Name *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter team member's name"
                    value={formData.name}
                    onChangeText={text => setFormData({ ...formData, name: text })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Role *</Text>
                  <View style={styles.roleOptions}>
                    {['Doctor', 'Nurse', 'Therapist', 'Specialist', 'Other'].map(role => (
                      <TouchableOpacity
                        key={role}
                        style={[
                          styles.roleOption,
                          formData.role === role && styles.roleOptionActive,
                        ]}
                        onPress={() => setFormData({ ...formData, role })}
                      >
                        <Text
                          style={[
                            styles.roleOptionText,
                            formData.role === role && styles.roleOptionTextActive,
                          ]}
                        >
                          {role}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter email address"
                    value={formData.email}
                    onChangeText={text => setFormData({ ...formData, email: text })}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Phone</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter phone number"
                    value={formData.phone}
                    onChangeText={text => setFormData({ ...formData, phone: text })}
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Specialty</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter specialty (e.g., Cardiology)"
                    value={formData.specialty}
                    onChangeText={text => setFormData({ ...formData, specialty: text })}
                  />
                </View>

                <View style={styles.checkboxGroup}>
                  <TouchableOpacity
                    style={styles.checkbox}
                    onPress={() =>
                      setFormData({ ...formData, is_primary: !formData.is_primary })
                    }
                  >
                    <View
                      style={[
                        styles.checkboxBox,
                        formData.is_primary && styles.checkboxBoxChecked,
                      ]}
                    >
                      {formData.is_primary && (
                        <Ionicons name="checkmark" size={16} color={theme.COLORS.textOnPrimary} />
                      )}
                    </View>
                    <Text style={styles.checkboxLabel}>Set as primary care provider</Text>
                  </TouchableOpacity>
                </View>

                <TouchableOpacity style={styles.submitButton} onPress={handleAddTeamMember}>
                  <Text style={styles.submitButtonText}>Add to Team</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: theme.SPACING.lg,
    paddingTop: theme.SPACING.xl,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: theme.COLORS.background,
  },
  loadingText: {
    marginTop: theme.SPACING.md,
    color: theme.COLORS.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.SPACING.xl,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.COLORS.textOnDark,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    paddingHorizontal: theme.SPACING.md,
    paddingVertical: theme.SPACING.sm,
    marginBottom: theme.SPACING.xl,
    ...theme.SHADOWS.small,
  },
  searchInput: {
    flex: 1,
    marginLeft: theme.SPACING.sm,
    fontSize: 16,
    color: theme.COLORS.textOnDark,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.SPACING.xl,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.COLORS.textOnDark,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: theme.COLORS.textSecondary,
    textAlign: 'center',
  },
  teamCard: {
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.lg,
    marginBottom: theme.SPACING.xl,
    ...theme.SHADOWS.medium,
  },
  teamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.SPACING.lg,
  },
  patientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.SPACING.md,
  },
  patientAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patientInitials: {
    color: theme.COLORS.textOnPrimary,
    fontSize: 18,
    fontWeight: '600',
  },
  patientName: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.COLORS.textOnDark,
  },
  teamSize: {
    fontSize: 14,
    color: theme.COLORS.textSecondary,
    marginTop: 2,
  },
  addMemberButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  membersList: {
    gap: theme.SPACING.md,
  },
  memberCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: theme.LAYOUT.borderRadius.md,
    padding: theme.SPACING.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  memberInfo: {
    flexDirection: 'row',
    gap: theme.SPACING.md,
    flex: 1,
  },
  memberAvatar: {
    position: 'relative',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  memberInitials: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: theme.COLORS.info,
    color: theme.COLORS.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 48,
  },
  statusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: theme.COLORS.card,
  },
  memberDetails: {
    flex: 1,
  },
  memberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.SPACING.sm,
    marginBottom: 4,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.COLORS.textOnDark,
    flex: 1,
  },
  primaryBadge: {
    backgroundColor: theme.COLORS.primaryLight,
    paddingHorizontal: theme.SPACING.xs,
    paddingVertical: 2,
    borderRadius: theme.LAYOUT.borderRadius.sm,
  },
  primaryText: {
    fontSize: 10,
    color: theme.COLORS.primary,
    fontWeight: '700',
  },
  memberRole: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 2,
  },
  memberSpecialty: {
    fontSize: 12,
    color: theme.COLORS.textSecondary,
    marginBottom: theme.SPACING.sm,
  },
  memberContact: {
    gap: theme.SPACING.xs,
    marginBottom: theme.SPACING.xs,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  contactText: {
    fontSize: 12,
    color: theme.COLORS.textSecondary,
  },
  lastActive: {
    fontSize: 11,
    color: theme.COLORS.textTertiary,
  },
  memberActions: {
    gap: theme.SPACING.sm,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeButton: {
    backgroundColor: `${theme.COLORS.danger}20`,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.SPACING.xxl,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.COLORS.textOnDark,
    marginTop: theme.SPACING.md,
    marginBottom: theme.SPACING.xs,
  },
  emptySubtext: {
    fontSize: 14,
    color: theme.COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: theme.SPACING.xl,
  },
  createButton: {
    backgroundColor: theme.COLORS.primary,
    paddingHorizontal: theme.SPACING.xl,
    paddingVertical: theme.SPACING.md,
    borderRadius: theme.LAYOUT.borderRadius.md,
  },
  createButtonText: {
    color: theme.COLORS.textOnPrimary,
    fontWeight: '600',
    fontSize: 16,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: theme.COLORS.background,
    borderTopLeftRadius: theme.LAYOUT.borderRadius.xl,
    borderTopRightRadius: theme.LAYOUT.borderRadius.xl,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.COLORS.separator,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.COLORS.textPrimary,
  },
  modalForm: {
    padding: theme.SPACING.lg,
  },
  inputGroup: {
    marginBottom: theme.SPACING.lg,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.COLORS.textPrimary,
    marginBottom: theme.SPACING.sm,
  },
  patientSelect: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.COLORS.inputBackground,
    borderRadius: theme.LAYOUT.borderRadius.md,
    padding: theme.SPACING.md,
  },
  patientSelectText: {
    fontSize: 16,
    color: theme.COLORS.textPrimary,
  },
  patientOptions: {
    marginTop: theme.SPACING.sm,
  },
  patientOption: {
    backgroundColor: theme.COLORS.inputBackground,
    borderRadius: theme.LAYOUT.borderRadius.md,
    paddingHorizontal: theme.SPACING.md,
    paddingVertical: theme.SPACING.sm,
    marginRight: theme.SPACING.sm,
  },
  patientOptionText: {
    fontSize: 14,
    color: theme.COLORS.textPrimary,
  },
  input: {
    backgroundColor: theme.COLORS.inputBackground,
    borderRadius: theme.LAYOUT.borderRadius.md,
    padding: theme.SPACING.md,
    fontSize: 16,
    color: theme.COLORS.textPrimary,
  },
  roleOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.SPACING.sm,
  },
  roleOption: {
    backgroundColor: theme.COLORS.inputBackground,
    paddingHorizontal: theme.SPACING.md,
    paddingVertical: theme.SPACING.sm,
    borderRadius: theme.LAYOUT.borderRadius.md,
  },
  roleOptionActive: {
    backgroundColor: theme.COLORS.primary,
  },
  roleOptionText: {
    fontSize: 14,
    color: theme.COLORS.textPrimary,
  },
  roleOptionTextActive: {
    color: theme.COLORS.textOnPrimary,
  },
  checkboxGroup: {
    marginBottom: theme.SPACING.lg,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.SPACING.sm,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    backgroundColor: theme.COLORS.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxBoxChecked: {
    backgroundColor: theme.COLORS.primary,
  },
  checkboxLabel: {
    fontSize: 14,
    color: theme.COLORS.textPrimary,
  },
  submitButton: {
    backgroundColor: theme.COLORS.primary,
    padding: theme.SPACING.lg,
    borderRadius: theme.LAYOUT.borderRadius.md,
    alignItems: 'center',
  },
  submitButtonText: {
    color: theme.COLORS.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});