// front/app/(caregiver)/care-notes.tsx
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    Modal,
    Platform,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { GRADIENTS, theme } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';

const { width } = Dimensions.get('window');

interface CareNote {
  id: number;
  patient_id: string;
  patient_name: string;
  title: string;
  content: string;
  category: 'observation' | 'medication' | 'activity' | 'vital' | 'general';
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
  created_by: string;
}

export default function CareNotesScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [notes, setNotes] = useState<CareNote[]>([]);
  const [filteredNotes, setFilteredNotes] = useState<CareNote[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    patient_id: '',
    title: '',
    content: '',
    category: 'general' as CareNote['category'],
    priority: 'medium' as CareNote['priority']
  });

  const categories = [
    { id: 'all', label: 'All Notes', icon: 'document-text', color: theme.COLORS.primary },
    { id: 'observation', label: 'Observations', icon: 'eye', color: theme.COLORS.info },
    { id: 'medication', label: 'Medication', icon: 'medical', color: theme.COLORS.danger },
    { id: 'activity', label: 'Activities', icon: 'walk', color: theme.COLORS.success },
    { id: 'vital', label: 'Vitals', icon: 'pulse', color: theme.COLORS.warning },
    { id: 'general', label: 'General', icon: 'clipboard', color: theme.COLORS.textSecondary }
  ];

  useEffect(() => {
    fetchNotes();
  }, []);

  useEffect(() => {
    filterNotes();
  }, [notes, searchQuery, selectedCategory]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      // TODO: Replace with actual API call
      const mockNotes: CareNote[] = [
        {
          id: 1,
          patient_id: 'P001',
          patient_name: 'John Smith',
          title: 'Morning Vitals Check',
          content: 'Blood pressure: 120/80, Heart rate: 72 bpm. Patient feeling well.',
          category: 'vital',
          priority: 'medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: user?.full_name || 'Caregiver'
        },
        {
          id: 2,
          patient_id: 'P002',
          patient_name: 'Jane Doe',
          title: 'Medication Administered',
          content: 'Gave morning medication as prescribed. No adverse reactions observed.',
          category: 'medication',
          priority: 'high',
          created_at: new Date(Date.now() - 3600000).toISOString(),
          updated_at: new Date(Date.now() - 3600000).toISOString(),
          created_by: user?.full_name || 'Caregiver'
        }
      ];
      setNotes(mockNotes);
    } catch (error) {
      console.error('Error fetching notes:', error);
      Alert.alert('Error', 'Failed to load care notes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filterNotes = () => {
    let filtered = notes;
    
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(note => note.category === selectedCategory);
    }
    
    if (searchQuery) {
      filtered = filtered.filter(note => 
        note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        note.patient_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    setFilteredNotes(filtered);
  };

  const handleAddNote = async () => {
    if (!formData.patient_id || !formData.title || !formData.content) {
      Alert.alert('Missing Information', 'Please fill in all required fields');
      return;
    }

    try {
      // TODO: Replace with actual API call
      const newNote: CareNote = {
        id: notes.length + 1,
        ...formData,
        patient_name: 'Patient ' + formData.patient_id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: user?.full_name || 'Caregiver'
      };
      
      setNotes([newNote, ...notes]);
      setShowAddModal(false);
      setFormData({
        patient_id: '',
        title: '',
        content: '',
        category: 'general',
        priority: 'medium'
      });
      Alert.alert('Success', 'Care note added successfully');
    } catch (error) {
      console.error('Error adding note:', error);
      Alert.alert('Error', 'Failed to add care note');
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return theme.COLORS.danger;
      case 'medium': return theme.COLORS.warning;
      case 'low': return theme.COLORS.success;
      default: return theme.COLORS.textSecondary;
    }
  };

  const getCategoryIcon = (category: string) => {
    const cat = categories.find(c => c.id === category);
    return cat?.icon || 'document-text';
  };

  const getCategoryColor = (category: string) => {
    const cat = categories.find(c => c.id === category);
    return cat?.color || theme.COLORS.textSecondary;
  };

  const renderNoteCard = (note: CareNote, index: number) => (
    <Animated.View
      key={note.id}
      entering={FadeInDown.delay(index * 50)}
      style={styles.noteCard}
    >
      <View style={styles.noteHeader}>
        <View style={[styles.categoryBadge, { backgroundColor: getCategoryColor(note.category) + '15' }]}>
          <Ionicons name={getCategoryIcon(note.category) as any} size={16} color={getCategoryColor(note.category)} />
          <Text style={[styles.categoryText, { color: getCategoryColor(note.category) }]}>
            {note.category.charAt(0).toUpperCase() + note.category.slice(1)}
          </Text>
        </View>
        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(note.priority) + '15' }]}>
          <Text style={[styles.priorityText, { color: getPriorityColor(note.priority) }]}>
            {note.priority.toUpperCase()}
          </Text>
        </View>
      </View>
      
      <Text style={styles.noteTitle}>{note.title}</Text>
      <Text style={styles.noteContent} numberOfLines={3}>{note.content}</Text>
      
      <View style={styles.noteFooter}>
        <View style={styles.patientInfo}>
          <Ionicons name="person" size={14} color={theme.COLORS.textTertiary} />
          <Text style={styles.patientName}>{note.patient_name}</Text>
        </View>
        <Text style={styles.noteTime}>
          {new Date(note.created_at).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Text>
      </View>
    </Animated.View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <LinearGradient colors={GRADIENTS.primary} style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          <View style={styles.headerTitleContainer}>
            <Text style={styles.headerTitle}>Care Notes</Text>
            <Text style={styles.headerSubtitle}>{filteredNotes.length} notes</Text>
          </View>
          <TouchableOpacity onPress={() => setShowAddModal(true)} style={styles.addButton}>
            <Ionicons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color={theme.COLORS.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search notes..."
            placeholderTextColor={theme.COLORS.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </LinearGradient>

      {/* Categories */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categoriesContent}
      >
        {categories.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryChip,
              selectedCategory === cat.id && styles.categoryChipActive
            ]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Ionicons 
              name={cat.icon as any} 
              size={16} 
              color={selectedCategory === cat.id ? '#FFFFFF' : cat.color} 
            />
            <Text style={[
              styles.categoryChipText,
              { color: selectedCategory === cat.id ? '#FFFFFF' : cat.color }
            ]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Notes List */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.notesContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchNotes} />
        }
      >
        {loading ? (
          <ActivityIndicator size="large" color={theme.COLORS.primary} style={styles.loader} />
        ) : filteredNotes.length > 0 ? (
          filteredNotes.map((note, index) => renderNoteCard(note, index))
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={64} color={theme.COLORS.textTertiary} />
            <Text style={styles.emptyTitle}>No Care Notes</Text>
            <Text style={styles.emptySubtitle}>
              {searchQuery ? 'No notes match your search' : 'Start documenting patient care'}
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Add Note Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Care Note</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)}>
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
                  placeholder="Brief title for the note"
                  value={formData.title}
                  onChangeText={(text) => setFormData({ ...formData, title: text })}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={styles.optionsRow}>
                    {categories.slice(1).map((cat) => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[
                          styles.optionChip,
                          formData.category === cat.id && { backgroundColor: cat.color }
                        ]}
                        onPress={() => setFormData({ ...formData, category: cat.id as CareNote['category'] })}
                      >
                        <Text style={[
                          styles.optionText,
                          formData.category === cat.id && styles.optionTextActive
                        ]}>
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Priority</Text>
                <View style={styles.optionsRow}>
                  {['low', 'medium', 'high'].map((priority) => (
                    <TouchableOpacity
                      key={priority}
                      style={[
                        styles.optionChip,
                        formData.priority === priority && { 
                          backgroundColor: getPriorityColor(priority) 
                        }
                      ]}
                      onPress={() => setFormData({ ...formData, priority: priority as CareNote['priority'] })}
                    >
                      <Text style={[
                        styles.optionText,
                        formData.priority === priority && styles.optionTextActive
                      ]}>
                        {priority.charAt(0).toUpperCase() + priority.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Note Content *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Detailed care notes..."
                  multiline
                  numberOfLines={6}
                  textAlignVertical="top"
                  value={formData.content}
                  onChangeText={(text) => setFormData({ ...formData, content: text })}
                />
              </View>

              <TouchableOpacity style={styles.submitButton} onPress={handleAddNote}>
                <Text style={styles.submitButtonText}>Add Note</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.COLORS.background,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 60 : StatusBar.currentHeight ? StatusBar.currentHeight + 20 : 40,
    paddingHorizontal: theme.SPACING.lg,
    paddingBottom: theme.SPACING.lg,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.SPACING.lg,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
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
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: theme.LAYOUT.borderRadius.lg,
    paddingHorizontal: theme.SPACING.md,
    paddingVertical: theme.SPACING.sm,
  },
  searchInput: {
    flex: 1,
    marginLeft: theme.SPACING.sm,
    fontSize: 16,
    color: '#FFFFFF',
  },
  categoriesContainer: {
    maxHeight: 60,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: theme.COLORS.border,
  },
  categoriesContent: {
    paddingHorizontal: theme.SPACING.lg,
    paddingVertical: theme.SPACING.md,
    gap: theme.SPACING.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.SPACING.xs,
    paddingHorizontal: theme.SPACING.md,
    paddingVertical: theme.SPACING.sm,
    borderRadius: 20,
    backgroundColor: theme.COLORS.background,
    borderWidth: 1,
    borderColor: theme.COLORS.border,
  },
  categoryChipActive: {
    backgroundColor: theme.COLORS.primary,
    borderColor: theme.COLORS.primary,
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  notesContainer: {
    padding: theme.SPACING.lg,
    gap: theme.SPACING.md,
  },
  noteCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.lg,
    ...theme.SHADOWS.medium,
  },
  noteHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.SPACING.md,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.SPACING.xs,
    paddingHorizontal: theme.SPACING.sm,
    paddingVertical: 4,
    borderRadius: theme.LAYOUT.borderRadius.sm,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
  },
  priorityBadge: {
    paddingHorizontal: theme.SPACING.sm,
    paddingVertical: 4,
    borderRadius: theme.LAYOUT.borderRadius.sm,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
  },
  noteTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.COLORS.textPrimary,
    marginBottom: theme.SPACING.sm,
  },
  noteContent: {
    fontSize: 14,
    color: theme.COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: theme.SPACING.md,
  },
  noteFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: theme.SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: theme.COLORS.border,
  },
  patientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.SPACING.xs,
  },
  patientName: {
    fontSize: 12,
    color: theme.COLORS.textTertiary,
    fontWeight: '500',
  },
  noteTime: {
    fontSize: 12,
    color: theme.COLORS.textTertiary,
  },
  loader: {
    marginTop: theme.SPACING.xxl,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: theme.SPACING.xxl * 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.COLORS.textPrimary,
    marginTop: theme.SPACING.md,
  },
  emptySubtitle: {
    fontSize: 14,
    color: theme.COLORS.textSecondary,
    marginTop: theme.SPACING.xs,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.COLORS.border,
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
    borderWidth: 1,
    borderColor: theme.COLORS.border,
  },
  textArea: {
    minHeight: 120,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: theme.SPACING.sm,
  },
  optionChip: {
    paddingHorizontal: theme.SPACING.md,
    paddingVertical: theme.SPACING.sm,
    borderRadius: 20,
    backgroundColor: theme.COLORS.background,
    borderWidth: 1,
    borderColor: theme.COLORS.border,
  },
  optionText: {
    fontSize: 14,
    color: theme.COLORS.textSecondary,
    fontWeight: '500',
  },
  optionTextActive: {
    color: '#FFFFFF',
  },
  submitButton: {
    backgroundColor: theme.COLORS.primary,
    padding: theme.SPACING.lg,
    borderRadius: theme.LAYOUT.borderRadius.md,
    alignItems: 'center',
    marginTop: theme.SPACING.md,
  },
  submitButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
