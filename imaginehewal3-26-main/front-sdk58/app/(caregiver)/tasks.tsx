import DateTimePicker from '@react-native-community/datetimepicker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  SafeAreaView,
  StyleSheet,
} from 'react-native';
import { GRADIENTS, theme } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import api, { AssignedPatient, CaregiverTask, CreateTaskRequest } from '../../services/api';
import { ActivityIndicator, Ionicons, LinearGradient, MaterialIcons, RefreshControl, ScrollView, Text, TextInput, TouchableOpacity, View } from '../../components/themed';

export default function TasksScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tasks, setTasks] = useState<CaregiverTask[]>([]);
  const [patients, setPatients] = useState<AssignedPatient[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerMode, setDatePickerMode] = useState<'date' | 'time'>('date');
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed' | 'overdue'>('all');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedTime, setSelectedTime] = useState(new Date());
  const [formData, setFormData] = useState<CreateTaskRequest>({
    patient_id: 0,
    title: '',
    description: '',
    task_type: 'general',
    priority: 'medium',
    due_date: undefined,
  });

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const data = await api.getCaregiverTasks();
      const filtered = filter === 'all'
        ? data
        : data.filter((task) => filter === 'overdue'
          ? task.status !== 'completed' && new Date(task.due_date || '') < new Date()
          : task.status === filter);
      setTasks(filtered);
      
      if (patients.length === 0) {
        const patientData = await api.getAssignedPatients();
        setPatients(patientData);
      }
    } catch (err: any) {
      console.error('Error fetching tasks:', err);
      
      // Handle session expiration
      if (err.message?.includes('session has expired') || err.message?.includes('log in again')) {
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
    fetchTasks();
  }, [filter]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTasks();
  };

  const handleCreateTask = async () => {
    try {
      if (!formData.title.trim() || !formData.patient_id) {
        Alert.alert('Error', 'Please fill in all required fields');
        return;
      }

      if (formData.due_date) {
        const now = new Date();
        const dueDate = new Date(formData.due_date);
        dueDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
        formData.due_date = dueDate.toISOString();
      }

      const task = await api.createTask(formData);
      
      Alert.alert('Success', 'Task created successfully');
      setShowAddModal(false);
      setFormData({
        patient_id: 0,
        title: '',
        description: '',
        task_type: 'general',
        priority: 'medium',
        due_date: undefined,
      });
      fetchTasks();
      
    } catch (err: any) {
      console.error('Error creating task:', err);
      Alert.alert('Error', `Failed to create task: ${err.message}`);
    }
  };

  const handleCompleteTask = async (taskId: number) => {
    try {
      await api.completeTask(taskId);
      Alert.alert('Success', 'Task marked as completed');
      fetchTasks();
    } catch (err: any) {
      console.error('Error completing task:', err);
      Alert.alert('Error', `Failed to complete task: ${err.message}`);
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    Alert.alert(
      'Delete Task',
      'Are you sure you want to delete this task?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteTask(taskId);
              Alert.alert('Success', 'Task deleted successfully');
              fetchTasks();
            } catch (err: any) {
              console.error('Error deleting task:', err);
              Alert.alert('Error', `Failed to delete task: ${err.message}`);
            }
          },
        },
      ]
    );
  };

  const handleDateChange = (event: any, date?: Date) => {
    setShowDatePicker(false);
    if (date) {
      if (datePickerMode === 'date') {
        setSelectedDate(date);
        const combinedDate = new Date(date);
        combinedDate.setHours(selectedTime.getHours(), selectedTime.getMinutes());
        setFormData({
          ...formData,
          due_date: combinedDate.toISOString(),
        });
      } else {
        setSelectedTime(date);
        const combinedDate = new Date(selectedDate);
        combinedDate.setHours(date.getHours(), date.getMinutes());
        setFormData({
          ...formData,
          due_date: combinedDate.toISOString(),
        });
      }
    }
  };

  const showDatepicker = (mode: 'date' | 'time') => {
    setDatePickerMode(mode);
    setShowDatePicker(true);
  };

  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'critical': return theme.COLORS.danger;
      case 'high': return theme.COLORS.warning;
      case 'medium': return theme.COLORS.info;
      case 'low': return theme.COLORS.success;
      default: return theme.COLORS.textTertiary;
    }
  };

  const getStatusColor = (status: string, isOverdue: boolean) => {
    if (isOverdue) return theme.COLORS.danger;
    switch (status.toLowerCase()) {
      case 'completed': return theme.COLORS.success;
      case 'in_progress': return theme.COLORS.info;
      case 'pending': return theme.COLORS.warning;
      default: return theme.COLORS.textTertiary;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'No due date';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid date';
    }
  };

  const filteredTasks = tasks;

  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    overdue: tasks.filter(t => t.is_overdue).length,
  };

  if (loading && tasks.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.COLORS.primary} />
        <Text style={styles.loadingText}>Loading tasks...</Text>
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
          <View style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={theme.COLORS.textOnDark} />
            </TouchableOpacity>
            <Text style={styles.title}>Tasks</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => setShowAddModal(true)}
            >
              <Ionicons name="add" size={24} color={theme.COLORS.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{stats.total}</Text>
              <Text style={styles.statLabel}>Total</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.COLORS.warning }]}>{stats.pending}</Text>
              <Text style={styles.statLabel}>Pending</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.COLORS.success }]}>{stats.completed}</Text>
              <Text style={styles.statLabel}>Completed</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={[styles.statValue, { color: theme.COLORS.danger }]}>{stats.overdue}</Text>
              <Text style={styles.statLabel}>Overdue</Text>
            </View>
          </View>

          <View style={styles.filterContainer}>
            {(['all', 'pending', 'completed', 'overdue'] as const).map((filterType) => (
              <TouchableOpacity
                key={filterType}
                style={[
                  styles.filterButton,
                  filter === filterType && styles.filterButtonActive,
                ]}
                onPress={() => setFilter(filterType)}
              >
                <Text
                  style={[
                    styles.filterText,
                    filter === filterType && styles.filterTextActive,
                  ]}
                >
                  {filterType.charAt(0).toUpperCase() + filterType.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {filteredTasks.map((task) => (
            <TouchableOpacity
              key={task.id}
              style={styles.taskCard}
              onPress={() => router.push(`/(caregiver)/tasks?task=${task.id}`)}
            >
              <View style={styles.taskHeader}>
                <View style={styles.taskTitleContainer}>
                  <Text style={styles.taskTitle}>{task.title}</Text>
                  <View style={[styles.priorityBadge, { backgroundColor: `${getPriorityColor(task.priority)}20` }]}>
                    <Text style={[styles.priorityText, { color: getPriorityColor(task.priority) }]}>
                      {task.priority.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.taskPatient}>{task.patient_name}</Text>
              </View>
              
              {task.description && (
                <Text style={styles.taskDescription} numberOfLines={2}>
                  {task.description}
                </Text>
              )}

              <View style={styles.taskMeta}>
                <View style={styles.taskMetaItem}>
                  <Ionicons name="calendar" size={14} color={theme.COLORS.textSecondary} />
                  <Text style={styles.taskMetaText}>
                    {formatDate(task.due_date)}
                  </Text>
                </View>
                <View style={styles.taskMetaItem}>
                  <Ionicons name="time" size={14} color={theme.COLORS.textSecondary} />
                  <Text style={styles.taskMetaText}>
                    {task.task_type}
                  </Text>
                </View>
              </View>

              <View style={styles.taskFooter}>
                <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(task.status, task.is_overdue)}20` }]}>
                  <Text style={[styles.statusText, { color: getStatusColor(task.status, task.is_overdue) }]}>
                    {task.is_overdue ? 'OVERDUE' : task.status.toUpperCase()}
                  </Text>
                </View>
                <View style={styles.taskActions}>
                  {task.status !== 'completed' && (
                    <TouchableOpacity
                      style={[styles.actionButton, styles.completeButton]}
                      onPress={() => handleCompleteTask(task.id)}
                    >
                      <Ionicons name="checkmark" size={20} color={theme.COLORS.success} />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDeleteTask(task.id)}
                    >
                      <Ionicons name="trash" size={20} color={theme.COLORS.danger} />
                    </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          ))}

          {filteredTasks.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialIcons name="assignment" size={64} color={theme.COLORS.textTertiary} />
              <Text style={styles.emptyText}>
                {filter === 'all' ? 'No tasks yet' : `No ${filter} tasks`}
              </Text>
              <Text style={styles.emptySubtext}>
                {filter === 'all' 
                  ? 'Create your first task to get started'
                  : `No ${filter} tasks found`}
              </Text>
              <TouchableOpacity 
                style={styles.createButton}
                onPress={() => setShowAddModal(true)}
              >
                <Text style={styles.createButtonText}>Create Task</Text>
              </TouchableOpacity>
            </View>
          )}

          <View style={{ height: 100 }} />
        </ScrollView>

        <Modal
          visible={showAddModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowAddModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Create New Task</Text>
                <TouchableOpacity onPress={() => setShowAddModal(false)}>
                  <Ionicons name="close" size={24} color={theme.COLORS.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalForm}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Patient *</Text>
                  <View style={styles.patientSelect}>
                    <Text style={styles.patientSelectText}>
                      {formData.patient_id
                        ? patients.find(p => p.id === formData.patient_id)?.patient_name
                        : 'Select a patient'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color={theme.COLORS.textSecondary} />
                  </View>
                  <ScrollView horizontal style={styles.patientOptions}>
                    {patients.map(patient => (
                      <TouchableOpacity
                        key={patient.id}
                        style={[
                          styles.patientOption,
                          formData.patient_id === patient.id && styles.patientOptionActive,
                        ]}
                        onPress={() => 
                          setFormData({ ...formData, patient_id: patient.id })
                        }
                      >
                        <Text style={[
                          styles.patientOptionText,
                          formData.patient_id === patient.id && styles.patientOptionTextActive,
                        ]}>
                          {patient.patient_name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Title *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter task title"
                    value={formData.title}
                    onChangeText={(text) => setFormData({ ...formData, title: text })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Enter task description"
                    value={formData.description}
                    onChangeText={(text) => setFormData({ ...formData, description: text })}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Task Type</Text>
                  <View style={styles.typeOptions}>
                    {['medication', 'appointment', 'checkup', 'general'].map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={[
                          styles.typeOption,
                          formData.task_type === type && styles.typeOptionActive,
                        ]}
                        onPress={() => setFormData({ ...formData, task_type: type })}
                      >
                        <Text
                          style={[
                            styles.typeOptionText,
                            formData.task_type === type && styles.typeOptionTextActive,
                          ]}
                        >
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Priority</Text>
                  <View style={styles.priorityOptions}>
                    {[
                      { value: 'low', color: theme.COLORS.success },
                      { value: 'medium', color: theme.COLORS.info },
                      { value: 'high', color: theme.COLORS.warning },
                      { value: 'critical', color: theme.COLORS.danger },
                    ].map((priority) => (
                      <TouchableOpacity
                        key={priority.value}
                        style={[
                          styles.priorityOption,
                          { backgroundColor: `${priority.color}20` },
                          formData.priority === priority.value && {
                            backgroundColor: priority.color,
                          },
                        ]}
                        onPress={() => setFormData({ ...formData, priority: priority.value })}
                      >
                        <Text
                          style={[
                            styles.priorityOptionText,
                            formData.priority === priority.value && styles.priorityOptionTextActive,
                          ]}
                        >
                          {priority.value.toUpperCase()}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Due Date & Time</Text>
                  <View style={styles.dateTimeRow}>
                    <TouchableOpacity
                      style={styles.dateButton}
                      onPress={() => showDatepicker('date')}
                    >
                      <Ionicons name="calendar" size={20} color={theme.COLORS.textSecondary} />
                      <Text style={styles.dateButtonText}>
                        {formData.due_date
                          ? selectedDate.toLocaleDateString()
                          : 'Select date'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.timeButton}
                      onPress={() => showDatepicker('time')}
                    >
                      <Ionicons name="time" size={20} color={theme.COLORS.textSecondary} />
                      <Text style={styles.timeButtonText}>
                        {formData.due_date
                          ? selectedTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : 'Select time'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <TouchableOpacity style={styles.submitButton} onPress={handleCreateTask}>
                  <Text style={styles.submitButtonText}>Create Task</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {showDatePicker && (
          <DateTimePicker
            value={datePickerMode === 'date' ? selectedDate : selectedTime}
            mode={datePickerMode}
            display="default"
            onChange={handleDateChange}
          />
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  safeArea: { flex: 1 },
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
  filterContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: theme.LAYOUT.borderRadius.md,
    padding: 4,
    marginBottom: theme.SPACING.xl,
  },
  filterButton: {
    flex: 1,
    paddingVertical: theme.SPACING.sm,
    borderRadius: theme.LAYOUT.borderRadius.sm,
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: theme.COLORS.primary,
  },
  filterText: {
    fontSize: 14,
    color: theme.COLORS.textSecondary,
    fontWeight: '500',
  },
  filterTextActive: {
    color: theme.COLORS.textOnPrimary,
    fontWeight: '600',
  },
  taskCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.lg,
    marginBottom: theme.SPACING.lg,
  },
  taskHeader: {
    marginBottom: theme.SPACING.md,
  },
  taskTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.SPACING.xs,
  },
  taskTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.COLORS.textOnDark,
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: theme.SPACING.sm,
    paddingVertical: 4,
    borderRadius: theme.LAYOUT.borderRadius.sm,
    marginLeft: theme.SPACING.sm,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  taskPatient: {
    fontSize: 14,
    color: theme.COLORS.textSecondary,
  },
  taskDescription: {
    fontSize: 14,
    color: theme.COLORS.textOnDark,
    lineHeight: 20,
    marginBottom: theme.SPACING.md,
  },
  taskMeta: {
    flexDirection: 'row',
    gap: theme.SPACING.lg,
    marginBottom: theme.SPACING.lg,
  },
  taskMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  taskMetaText: {
    fontSize: 12,
    color: theme.COLORS.textSecondary,
  },
  taskFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.SPACING.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  statusBadge: {
    paddingHorizontal: theme.SPACING.sm,
    paddingVertical: 4,
    borderRadius: theme.LAYOUT.borderRadius.sm,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '700',
  },
  taskActions: {
    flexDirection: 'row',
    gap: theme.SPACING.sm,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completeButton: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
  },
  deleteButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
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
  patientOptionActive: {
    backgroundColor: theme.COLORS.primary,
  },
  patientOptionText: {
    fontSize: 14,
    color: theme.COLORS.textPrimary,
  },
  patientOptionTextActive: {
    color: theme.COLORS.textOnPrimary,
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
  typeOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.SPACING.sm,
  },
  typeOption: {
    backgroundColor: theme.COLORS.inputBackground,
    paddingHorizontal: theme.SPACING.md,
    paddingVertical: theme.SPACING.sm,
    borderRadius: theme.LAYOUT.borderRadius.md,
  },
  typeOptionActive: {
    backgroundColor: theme.COLORS.primary,
  },
  typeOptionText: {
    fontSize: 14,
    color: theme.COLORS.textPrimary,
  },
  typeOptionTextActive: {
    color: theme.COLORS.textOnPrimary,
  },
  priorityOptions: {
    flexDirection: 'row',
    gap: theme.SPACING.sm,
  },
  priorityOption: {
    flex: 1,
    padding: theme.SPACING.sm,
    borderRadius: theme.LAYOUT.borderRadius.md,
    alignItems: 'center',
  },
  priorityOptionText: {
    fontSize: 12,
    color: theme.COLORS.textPrimary,
    fontWeight: '600',
  },
  priorityOptionTextActive: {
    color: theme.COLORS.textOnPrimary,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: theme.SPACING.sm,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.COLORS.inputBackground,
    borderRadius: theme.LAYOUT.borderRadius.md,
    padding: theme.SPACING.md,
    gap: theme.SPACING.sm,
  },
  timeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.COLORS.inputBackground,
    borderRadius: theme.LAYOUT.borderRadius.md,
    padding: theme.SPACING.md,
    gap: theme.SPACING.sm,
  },
  dateButtonText: {
    fontSize: 16,
    color: theme.COLORS.textPrimary,
    flex: 1,
  },
  timeButtonText: {
    fontSize: 16,
    color: theme.COLORS.textPrimary,
    flex: 1,
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
});