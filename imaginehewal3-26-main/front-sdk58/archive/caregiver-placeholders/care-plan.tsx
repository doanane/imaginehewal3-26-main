import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Modal,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { theme, GRADIENTS } from '../../constants/theme';
import api from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { ActivityIndicator, Ionicons, LinearGradient, MaterialIcons, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from '../../components/themed';

interface CarePlan {
  id: number;
  patient_id: number;
  patient_name: string;
  title: string;
  description: string;
  goals: string[];
  interventions: Intervention[];
  status: 'active' | 'completed' | 'archived';
  start_date: string;
  end_date?: string;
  created_at: string;
  updated_at: string;
}

interface Intervention {
  id: number;
  title: string;
  description: string;
  frequency: string;
  assigned_to: string;
  status: 'pending' | 'in_progress' | 'completed';
  notes?: string;
}

export default function CarePlanScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [carePlans, setCarePlans] = useState<CarePlan[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<CarePlan | null>(null);
  const [formData, setFormData] = useState({
    patient_id: '',
    title: '',
    description: '',
    goals: [''],
    interventions: [{
      title: '',
      description: '',
      frequency: 'daily',
      assigned_to: user?.full_name || '',
      status: 'pending' as const,
    }],
  });

  const fetchCarePlans = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      // const response = await api.getCarePlans();
      // setCarePlans(response);
      
      // Mock data for now
      setCarePlans([
        {
          id: 1,
          patient_id: 1,
          patient_name: 'John Doe',
          title: 'Diabetes Management Plan',
          description: 'Comprehensive plan for managing diabetes through medication, diet, and exercise',
          goals: [
            'Maintain blood glucose levels between 80-130 mg/dL',
            'Lose 5kg in 3 months',
            'Walk 30 minutes daily',
            'Attend all follow-up appointments'
          ],
          interventions: [
            {
              id: 1,
              title: 'Blood Glucose Monitoring',
              description: 'Check blood sugar levels 3 times daily',
              frequency: '3x daily',
              assigned_to: 'Caregiver',
              status: 'in_progress',
              notes: 'Before meals and bedtime'
            },
            {
              id: 2,
              title: 'Medication Administration',
              description: 'Administer insulin as prescribed',
              frequency: '2x daily',
              assigned_to: 'Caregiver',
              status: 'pending',
              notes: 'Morning and evening doses'
            }
          ],
          status: 'active',
          start_date: '2024-01-01',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-15T00:00:00Z'
        }
      ]);
    } catch (error) {
      Alert.alert('Error', 'Failed to load care plans');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchCarePlans();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchCarePlans();
  };

  const handleCreatePlan = () => {
    // TODO: Implement API call
    Alert.alert('Success', 'Care plan created successfully');
    setShowModal(false);
    fetchCarePlans();
  };

  const handleGoalChange = (index: number, value: string) => {
    const newGoals = [...formData.goals];
    newGoals[index] = value;
    setFormData({ ...formData, goals: newGoals });
  };

  const addGoal = () => {
    setFormData({ ...formData, goals: [...formData.goals, ''] });
  };

  const removeGoal = (index: number) => {
    const newGoals = formData.goals.filter((_, i) => i !== index);
    setFormData({ ...formData, goals: newGoals });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return theme.COLORS.success;
      case 'completed': return theme.COLORS.info;
      case 'archived': return theme.COLORS.textTertiary;
      default: return theme.COLORS.textTertiary;
    }
  };

  const getInterventionStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return theme.COLORS.success;
      case 'in_progress': return theme.COLORS.info;
      case 'pending': return theme.COLORS.warning;
      default: return theme.COLORS.textTertiary;
    }
  };

  if (loading && carePlans.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.COLORS.primary} />
        <Text style={styles.loadingText}>Loading care plans...</Text>
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
            <Text style={styles.title}>Care Plans</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => setShowModal(true)}
            >
              <Ionicons name="add" size={24} color={theme.COLORS.primary} />
            </TouchableOpacity>
          </View>

          {/* Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{carePlans.length}</Text>
              <Text style={styles.statLabel}>Total Plans</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.COLORS.success }]}>
                {carePlans.filter(p => p.status === 'active').length}
              </Text>
              <Text style={styles.statLabel}>Active</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.COLORS.info }]}>
                {carePlans.filter(p => p.status === 'completed').length}
              </Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
          </View>

          {/* Care Plans List */}
          {carePlans.map((plan) => (
            <TouchableOpacity
              key={plan.id}
              style={styles.planCard}
              onPress={() => setSelectedPlan(plan)}
            >
              <View style={styles.planHeader}>
                <View style={styles.planTitleContainer}>
                  <Text style={styles.planTitle}>{plan.title}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(plan.status)}20` }]}>
                    <Text style={[styles.statusText, { color: getStatusColor(plan.status) }]}>
                      {plan.status.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.patientName}>{plan.patient_name}</Text>
              </View>
              
              <Text style={styles.planDescription} numberOfLines={2}>
                {plan.description}
              </Text>

              <View style={styles.goalsContainer}>
                <Text style={styles.sectionLabel}>Goals:</Text>
                {plan.goals.slice(0, 2).map((goal, index) => (
                  <View key={index} style={styles.goalItem}>
                    <Ionicons name="checkmark-circle-outline" size={16} color={theme.COLORS.success} />
                    <Text style={styles.goalText}>{goal}</Text>
                  </View>
                ))}
                {plan.goals.length > 2 && (
                  <Text style={styles.moreText}>+{plan.goals.length - 2} more goals</Text>
                )}
              </View>

              <View style={styles.interventionsContainer}>
                <Text style={styles.sectionLabel}>Interventions:</Text>
                {plan.interventions.slice(0, 2).map((intervention) => (
                  <View key={intervention.id} style={styles.interventionItem}>
                    <View style={styles.interventionHeader}>
                      <Text style={styles.interventionTitle}>{intervention.title}</Text>
                      <View style={[styles.interventionStatus, { backgroundColor: `${getInterventionStatusColor(intervention.status)}20` }]}>
                        <Text style={[styles.interventionStatusText, { color: getInterventionStatusColor(intervention.status) }]}>
                          {intervention.status.replace('_', ' ').toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.interventionDescription}>{intervention.description}</Text>
                    <View style={styles.interventionMeta}>
                      <Text style={styles.interventionFrequency}>{intervention.frequency}</Text>
                      <Text style={styles.interventionAssigned}>Assigned to: {intervention.assigned_to}</Text>
                    </View>
                  </View>
                ))}
              </View>

              <View style={styles.planFooter}>
                <Text style={styles.planDate}>
                  Started: {new Date(plan.start_date).toLocaleDateString()}
                </Text>
                <TouchableOpacity style={styles.viewButton}>
                  <Text style={styles.viewButtonText}>View Details</Text>
                  <Ionicons name="chevron-forward" size={16} color={theme.COLORS.primary} />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))}

          {carePlans.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialIcons name="assignment" size={64} color={theme.COLORS.textTertiary} />
              <Text style={styles.emptyText}>No care plans yet</Text>
              <Text style={styles.emptySubtext}>
                Create your first care plan to get started
              </Text>
              <TouchableOpacity 
                style={styles.createButton}
                onPress={() => setShowModal(true)}
              >
                <Text style={styles.createButtonText}>Create Care Plan</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Create Plan Modal */}
        <Modal
          visible={showModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create Care Plan</Text>
                <TouchableOpacity onPress={() => setShowModal(false)}>
                  <Ionicons name="close" size={24} color={theme.COLORS.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalForm}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Patient ID *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter patient ID"
                    value={formData.patient_id}
                    onChangeText={(text) => setFormData({ ...formData, patient_id: text })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Title *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter plan title"
                    value={formData.title}
                    onChangeText={(text) => setFormData({ ...formData, title: text })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Enter plan description"
                    value={formData.description}
                    onChangeText={(text) => setFormData({ ...formData, description: text })}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.label}>Goals</Text>
                    <TouchableOpacity onPress={addGoal} style={styles.addSmallButton}>
                      <Ionicons name="add" size={20} color={theme.COLORS.primary} />
                    </TouchableOpacity>
                  </View>
                  {formData.goals.map((goal, index) => (
                    <View key={index} style={styles.goalInputRow}>
                      <TextInput
                        style={[styles.input, styles.goalInput]}
                        placeholder={`Goal ${index + 1}`}
                        value={goal}
                        onChangeText={(text) => handleGoalChange(index, text)}
                      />
                      {formData.goals.length > 1 && (
                        <TouchableOpacity
                          onPress={() => removeGoal(index)}
                          style={styles.removeButton}
                        >
                          <Ionicons name="trash-outline" size={20} color={theme.COLORS.danger} />
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>

                <TouchableOpacity style={styles.submitButton} onPress={handleCreatePlan}>
                  <Text style={styles.submitButtonText}>Create Care Plan</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* View Plan Modal */}
        <Modal
          visible={!!selectedPlan}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setSelectedPlan(null)}
        >
          {selectedPlan && (
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, styles.viewModalContent]}>
                <ScrollView>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>{selectedPlan.title}</Text>
                    <TouchableOpacity onPress={() => setSelectedPlan(null)}>
                      <Ionicons name="close" size={24} color={theme.COLORS.textPrimary} />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.planDetailSection}>
                    <Text style={styles.detailLabel}>Patient</Text>
                    <Text style={styles.detailValue}>{selectedPlan.patient_name}</Text>
                  </View>

                  <View style={styles.planDetailSection}>
                    <Text style={styles.detailLabel}>Description</Text>
                    <Text style={styles.detailValue}>{selectedPlan.description}</Text>
                  </View>

                  <View style={styles.planDetailSection}>
                    <Text style={styles.detailLabel}>Status</Text>
                    <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(selectedPlan.status)}20` }]}>
                      <Text style={[styles.statusText, { color: getStatusColor(selectedPlan.status) }]}>
                        {selectedPlan.status.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.planDetailSection}>
                    <Text style={styles.detailLabel}>Goals</Text>
                    {selectedPlan.goals.map((goal, index) => (
                      <View key={index} style={styles.detailGoalItem}>
                        <Ionicons name="checkmark-circle" size={20} color={theme.COLORS.success} />
                        <Text style={styles.detailGoalText}>{goal}</Text>
                      </View>
                    ))}
                  </View>

                  <View style={styles.planDetailSection}>
                    <Text style={styles.detailLabel}>Interventions</Text>
                    {selectedPlan.interventions.map((intervention) => (
                      <View key={intervention.id} style={styles.detailIntervention}>
                        <View style={styles.detailInterventionHeader}>
                          <Text style={styles.detailInterventionTitle}>{intervention.title}</Text>
                          <View style={[styles.detailInterventionStatus, { backgroundColor: `${getInterventionStatusColor(intervention.status)}20` }]}>
                            <Text style={[styles.detailInterventionStatusText, { color: getInterventionStatusColor(intervention.status) }]}>
                              {intervention.status.replace('_', ' ').toUpperCase()}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.detailInterventionDesc}>{intervention.description}</Text>
                        <View style={styles.detailInterventionMeta}>
                          <Text style={styles.detailInterventionMetaText}>
                            <Ionicons name="time-outline" size={14} /> {intervention.frequency}
                          </Text>
                          <Text style={styles.detailInterventionMetaText}>
                            <Ionicons name="person-outline" size={14} /> {intervention.assigned_to}
                          </Text>
                        </View>
                        {intervention.notes && (
                          <Text style={styles.detailInterventionNotes}>
                            <Text style={{ fontWeight: '600' }}>Notes:</Text> {intervention.notes}
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>
          )}
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
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.SPACING.xl,
    paddingHorizontal: theme.SPACING.md,
  },
  statItem: {
    alignItems: 'center',
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
  },
  planCard: {
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.lg,
    marginBottom: theme.SPACING.lg,
    ...theme.SHADOWS.medium,
  },
  planHeader: {
    marginBottom: theme.SPACING.md,
  },
  planTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.SPACING.xs,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.COLORS.textOnDark,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: theme.SPACING.sm,
    paddingVertical: 4,
    borderRadius: theme.LAYOUT.borderRadius.sm,
    marginLeft: theme.SPACING.sm,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  patientName: {
    fontSize: 14,
    color: theme.COLORS.textSecondary,
  },
  planDescription: {
    fontSize: 14,
    color: theme.COLORS.textOnDark,
    lineHeight: 20,
    marginBottom: theme.SPACING.md,
  },
  goalsContainer: {
    marginBottom: theme.SPACING.lg,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.COLORS.textSecondary,
    marginBottom: theme.SPACING.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  goalItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.SPACING.xs,
    gap: theme.SPACING.xs,
  },
  goalText: {
    fontSize: 14,
    color: theme.COLORS.textOnDark,
    flex: 1,
    lineHeight: 20,
  },
  moreText: {
    fontSize: 12,
    color: theme.COLORS.primary,
    marginTop: theme.SPACING.xs,
  },
  interventionsContainer: {
    marginBottom: theme.SPACING.lg,
  },
  interventionItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: theme.LAYOUT.borderRadius.md,
    padding: theme.SPACING.md,
    marginBottom: theme.SPACING.sm,
  },
  interventionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.SPACING.xs,
  },
  interventionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.COLORS.textOnDark,
    flex: 1,
  },
  interventionStatus: {
    paddingHorizontal: theme.SPACING.sm,
    paddingVertical: 2,
    borderRadius: theme.LAYOUT.borderRadius.sm,
    marginLeft: theme.SPACING.sm,
  },
  interventionStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  interventionDescription: {
    fontSize: 13,
    color: theme.COLORS.textSecondary,
    marginBottom: theme.SPACING.sm,
    lineHeight: 18,
  },
  interventionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  interventionFrequency: {
    fontSize: 12,
    color: theme.COLORS.textTertiary,
  },
  interventionAssigned: {
    fontSize: 12,
    color: theme.COLORS.textTertiary,
  },
  planFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  planDate: {
    fontSize: 12,
    color: theme.COLORS.textSecondary,
  },
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewButtonText: {
    fontSize: 14,
    color: theme.COLORS.primary,
    fontWeight: '500',
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
  viewModalContent: {
    maxHeight: '90%',
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
  input: {
    backgroundColor: theme.COLORS.inputBackground,
    borderRadius: theme.LAYOUT.borderRadius.md,
    padding: theme.SPACING.md,
    fontSize: 16,
    color: theme.COLORS.textPrimary,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.SPACING.sm,
  },
  addSmallButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: theme.COLORS.inputBackground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.SPACING.sm,
    marginBottom: theme.SPACING.sm,
  },
  goalInput: {
    flex: 1,
  },
  removeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: `${theme.COLORS.danger}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButton: {
    backgroundColor: theme.COLORS.primary,
    padding: theme.SPACING.lg,
    borderRadius: theme.LAYOUT.borderRadius.md,
    alignItems: 'center',
    marginTop: theme.SPACING.lg,
  },
  submitButtonText: {
    color: theme.COLORS.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  planDetailSection: {
    marginBottom: theme.SPACING.xl,
    paddingHorizontal: theme.SPACING.lg,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.COLORS.textSecondary,
    marginBottom: theme.SPACING.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: 16,
    color: theme.COLORS.textPrimary,
    lineHeight: 24,
  },
  detailGoalItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: theme.SPACING.sm,
    gap: theme.SPACING.sm,
  },
  detailGoalText: {
    fontSize: 16,
    color: theme.COLORS.textPrimary,
    flex: 1,
    lineHeight: 24,
  },
  detailIntervention: {
    backgroundColor: theme.COLORS.inputBackground,
    borderRadius: theme.LAYOUT.borderRadius.md,
    padding: theme.SPACING.md,
    marginBottom: theme.SPACING.md,
  },
  detailInterventionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.SPACING.sm,
  },
  detailInterventionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.COLORS.textPrimary,
    flex: 1,
  },
  detailInterventionStatus: {
    paddingHorizontal: theme.SPACING.sm,
    paddingVertical: 4,
    borderRadius: theme.LAYOUT.borderRadius.sm,
    marginLeft: theme.SPACING.sm,
  },
  detailInterventionStatusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  detailInterventionDesc: {
    fontSize: 14,
    color: theme.COLORS.textSecondary,
    marginBottom: theme.SPACING.sm,
    lineHeight: 20,
  },
  detailInterventionMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.SPACING.sm,
  },
  detailInterventionMetaText: {
    fontSize: 12,
    color: theme.COLORS.textTertiary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailInterventionNotes: {
    fontSize: 13,
    color: theme.COLORS.textSecondary,
    fontStyle: 'italic',
    lineHeight: 18,
  },
});