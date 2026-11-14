import { Feather, Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    RefreshControl,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
// @ts-ignore: expo-document-picker has no type declarations in this project
import * as DocumentPicker from 'expo-document-picker';
import { GRADIENTS, theme } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';

interface Document {
  id: number;
  patient_id: number;
  patient_name: string;
  title: string;
  description?: string;
  file_name: string;
  file_size: number;
  file_type: string;
  file_url: string;
  category: string;
  uploaded_by: string;
  uploaded_at: string;
  tags: string[];
}

interface Category {
  id: string;
  name: string;
  icon: string;
  color: string;
  count: number;
}

export default function DocumentLibraryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [filteredDocuments, setFilteredDocuments] = useState<Document[]>([]);
  const [categories, setCategories] = useState<Category[]>([
    { id: 'all', name: 'All Documents', icon: 'folder', color: theme.COLORS.primary, count: 0 },
    { id: 'medical', name: 'Medical Records', icon: 'document-text', color: theme.COLORS.danger, count: 0 },
    { id: 'reports', name: 'Lab Reports', icon: 'clipboard', color: theme.COLORS.info, count: 0 },
    { id: 'prescriptions', name: 'Prescriptions', icon: 'medical', color: theme.COLORS.success, count: 0 },
    { id: 'insurance', name: 'Insurance', icon: 'shield', color: theme.COLORS.warning, count: 0 },
    { id: 'legal', name: 'Legal Documents', icon: 'document', color: theme.COLORS.textTertiary, count: 0 },
  ]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    patient_id: '',
    title: '',
    description: '',
    category: 'medical',
    tags: '',
  });
  const [selectedFile, setSelectedFile] = useState<any>(null);

  const patients = [
    { id: 1, name: 'John Doe' },
    { id: 2, name: 'Jane Smith' },
    { id: 3, name: 'Robert Johnson' },
  ];

  const fetchDocuments = async () => {
    try {
      setLoading(true);
      
      // TODO: Replace with actual API call
      // Mock data for now
      const mockDocuments: Document[] = [
        {
          id: 1,
          patient_id: 1,
          patient_name: 'John Doe',
          title: 'Blood Test Results - January 2024',
          description: 'Complete blood count and cholesterol levels',
          file_name: 'blood_test_jan_2024.pdf',
          file_size: 2457600, // 2.4 MB
          file_type: 'pdf',
          file_url: 'https://example.com/documents/blood_test.pdf',
          category: 'reports',
          uploaded_by: 'Dr. Sarah Johnson',
          uploaded_at: '2024-01-15T10:30:00Z',
          tags: ['lab', 'blood', 'cholesterol'],
        },
        {
          id: 2,
          patient_id: 1,
          patient_name: 'John Doe',
          title: 'Prescription - Metformin',
          description: 'Diabetes medication prescription',
          file_name: 'prescription_metformin.pdf',
          file_size: 1024000, // 1 MB
          file_type: 'pdf',
          file_url: 'https://example.com/documents/prescription.pdf',
          category: 'prescriptions',
          uploaded_by: 'Dr. Sarah Johnson',
          uploaded_at: '2024-01-10T14:20:00Z',
          tags: ['diabetes', 'medication'],
        },
        {
          id: 3,
          patient_id: 2,
          patient_name: 'Jane Smith',
          title: 'Insurance Claim Form',
          description: 'Health insurance claim for recent hospitalization',
          file_name: 'insurance_claim_form.pdf',
          file_size: 5120000, // 5 MB
          file_type: 'pdf',
          file_url: 'https://example.com/documents/insurance_claim.pdf',
          category: 'insurance',
          uploaded_by: 'Nurse Jane Smith',
          uploaded_at: '2024-01-05T09:15:00Z',
          tags: ['insurance', 'claim'],
        },
        {
          id: 4,
          patient_id: 3,
          patient_name: 'Robert Johnson',
          title: 'Medical History Summary',
          description: 'Complete medical history and previous treatments',
          file_name: 'medical_history.pdf',
          file_size: 10240000, // 10 MB
          file_type: 'pdf',
          file_url: 'https://example.com/documents/medical_history.pdf',
          category: 'medical',
          uploaded_by: 'Dr. Michael Chen',
          uploaded_at: '2024-01-01T11:45:00Z',
          tags: ['history', 'summary'],
        },
        {
          id: 5,
          patient_id: 1,
          patient_name: 'John Doe',
          title: 'X-Ray Results - Chest',
          description: 'Chest X-ray from recent examination',
          file_name: 'xray_chest.jpg',
          file_size: 4096000, // 4 MB
          file_type: 'image',
          file_url: 'https://example.com/documents/xray.jpg',
          category: 'reports',
          uploaded_by: 'Dr. Sarah Johnson',
          uploaded_at: '2023-12-20T16:30:00Z',
          tags: ['xray', 'chest', 'radiology'],
        },
      ];

      setDocuments(mockDocuments);
      
      // Update category counts
      const updatedCategories = categories.map(category => ({
        ...category,
        count: category.id === 'all' 
          ? mockDocuments.length 
          : mockDocuments.filter(doc => doc.category === category.id).length,
      }));
      setCategories(updatedCategories);
      
      applyFilters(mockDocuments, selectedCategory, searchQuery);
    } catch (error) {
      console.error('Error fetching documents:', error);
      Alert.alert('Error', 'Failed to load documents');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = (docs: Document[], category: string, query: string) => {
    let filtered = docs;
    
    // Apply category filter
    if (category !== 'all') {
      filtered = filtered.filter(doc => doc.category === category);
    }
    
    // Apply search filter
    if (query.trim()) {
      const searchLower = query.toLowerCase();
      filtered = filtered.filter(doc =>
        doc.title.toLowerCase().includes(searchLower) ||
        doc.description?.toLowerCase().includes(searchLower) ||
        doc.patient_name.toLowerCase().includes(searchLower) ||
        doc.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
    }
    
    setFilteredDocuments(filtered);
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  useEffect(() => {
    applyFilters(documents, selectedCategory, searchQuery);
  }, [selectedCategory, searchQuery, documents]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchDocuments();
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) return;

      const file = result.assets[0];
      setSelectedFile(file);
      
      // Auto-fill title from filename if not set
      if (!formData.title) {
        const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
        setFormData(prev => ({ ...prev, title: fileName }));
      }
    } catch (error) {
      console.error('Error picking document:', error);
      Alert.alert('Error', 'Failed to pick document');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      Alert.alert('Error', 'Please select a file to upload');
      return;
    }

    if (!formData.patient_id || !formData.title) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      setUploading(true);
      
      // TODO: Implement actual file upload to backend
      // This is a mock implementation
      
      const newDocument: Document = {
        id: documents.length + 1,
        patient_id: parseInt(formData.patient_id),
        patient_name: patients.find(p => p.id === parseInt(formData.patient_id))?.name || 'Unknown',
        title: formData.title,
        description: formData.description,
        file_name: selectedFile.name,
        file_size: selectedFile.size || 0,
        file_type: selectedFile.mimeType?.split('/')[1] || 'unknown',
        file_url: 'https://example.com/documents/' + selectedFile.name,
        category: formData.category,
        uploaded_by: user?.full_name || 'Caregiver',
        uploaded_at: new Date().toISOString(),
        tags: formData.tags.split(',').map(tag => tag.trim()).filter(tag => tag),
      };

      const updatedDocuments = [newDocument, ...documents];
      setDocuments(updatedDocuments);
      
      // Update category counts
      const updatedCategories = categories.map(category => ({
        ...category,
        count: category.id === 'all' 
          ? updatedDocuments.length 
          : updatedDocuments.filter(doc => doc.category === category.id).length,
      }));
      setCategories(updatedCategories);
      
      // Reset form
      setFormData({
        patient_id: '',
        title: '',
        description: '',
        category: 'medical',
        tags: '',
      });
      setSelectedFile(null);
      setShowUploadModal(false);
      
      Alert.alert('Success', 'Document uploaded successfully');
    } catch (error) {
      console.error('Error uploading document:', error);
      Alert.alert('Error', 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = (id: number) => {
    Alert.alert(
      'Delete Document',
      'Are you sure you want to delete this document? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            const updatedDocuments = documents.filter(doc => doc.id !== id);
            setDocuments(updatedDocuments);
            
            // Update category counts
            const updatedCategories = categories.map(category => ({
              ...category,
              count: category.id === 'all' 
                ? updatedDocuments.length 
                : updatedDocuments.filter(doc => doc.category === category.id).length,
            }));
            setCategories(updatedCategories);
            
            Alert.alert('Success', 'Document deleted successfully');
          },
        },
      ]
    );
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString([], { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return { icon: 'document', color: theme.COLORS.danger };
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
        return { icon: 'image', color: theme.COLORS.success };
      case 'doc':
      case 'docx':
        return { icon: 'document-text', color: theme.COLORS.info };
      case 'xls':
      case 'xlsx':
        return { icon: 'document-text', color: theme.COLORS.success };
      default:
        return { icon: 'document', color: theme.COLORS.textTertiary };
    }
  };

  if (loading && documents.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.COLORS.primary} />
        <Text style={styles.loadingText}>Loading documents...</Text>
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
            <Text style={styles.title}>Document Library</Text>
            <TouchableOpacity 
              style={styles.addButton}
              onPress={() => setShowUploadModal(true)}
            >
              <Ionicons name="cloud-upload" size={24} color={theme.COLORS.primary} />
            </TouchableOpacity>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <Ionicons name="search" size={20} color={theme.COLORS.textSecondary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search documents..."
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
              <Text style={styles.statValue}>{documents.length}</Text>
              <Text style={styles.statLabel}>Total Files</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {formatFileSize(documents.reduce((total, doc) => total + doc.file_size, 0))}
              </Text>
              <Text style={styles.statLabel}>Total Size</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{patients.length}</Text>
              <Text style={styles.statLabel}>Patients</Text>
            </View>
          </View>

          {/* Categories */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.categoriesScroll}
            contentContainerStyle={styles.categoriesContent}
          >
            {categories.map((category) => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryCard,
                  selectedCategory === category.id && styles.categoryCardActive,
                ]}
                onPress={() => setSelectedCategory(category.id)}
              >
                <View style={[
                  styles.categoryIcon,
                  { backgroundColor: `${category.color}20` },
                ]}>
                  <Ionicons 
                    name={category.icon as any} 
                    size={24} 
                    color={category.color} 
                  />
                </View>
                <Text style={styles.categoryName}>{category.name}</Text>
                <Text style={styles.categoryCount}>{category.count}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Documents List */}
          <View style={styles.documentsSection}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                {selectedCategory === 'all' ? 'All Documents' : 
                 categories.find(c => c.id === selectedCategory)?.name}
                <Text style={styles.documentCount}> ({filteredDocuments.length})</Text>
              </Text>
              <TouchableOpacity
                style={styles.sortButton}
                onPress={() => {
                  // TODO: Implement sorting
                }}
              >
                <Ionicons name="filter" size={20} color={theme.COLORS.textSecondary} />
                <Text style={styles.sortText}>Sort</Text>
              </TouchableOpacity>
            </View>

            {filteredDocuments.length > 0 ? (
              <View style={styles.documentsList}>
                {filteredDocuments.map((document) => {
                  const fileIcon = getFileIcon(document.file_type);
                  
                  return (
                    <View key={document.id} style={styles.documentCard}>
                      <View style={styles.documentHeader}>
                        <View style={styles.documentInfo}>
                          <View style={[
                            styles.documentIcon,
                            { backgroundColor: `${fileIcon.color}20` },
                          ]}>
                            <Ionicons 
                              name={fileIcon.icon as any} 
                              size={20} 
                              color={fileIcon.color} 
                            />
                          </View>
                          <View style={styles.documentDetails}>
                            <Text style={styles.documentTitle}>{document.title}</Text>
                            <Text style={styles.documentPatient}>
                              {document.patient_name}
                              <Text style={styles.documentDate}>
                                {' • '}{formatDate(document.uploaded_at)}
                              </Text>
                            </Text>
                          </View>
                        </View>
                        <View style={styles.documentActions}>
                          <TouchableOpacity
                            style={styles.documentAction}
                            onPress={() => {
                              // TODO: Implement preview/download
                              Alert.alert('Info', `Would open: ${document.file_url}`);
                            }}
                          >
                            <Ionicons name="eye" size={20} color={theme.COLORS.primary} />
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.documentAction}
                            onPress={() => handleDeleteDocument(document.id)}
                          >
                            <Ionicons name="trash" size={20} color={theme.COLORS.danger} />
                          </TouchableOpacity>
                        </View>
                      </View>

                      {document.description && (
                        <Text style={styles.documentDescription} numberOfLines={2}>
                          {document.description}
                        </Text>
                      )}

                      <View style={styles.documentFooter}>
                        <View style={styles.documentMeta}>
                          <View style={styles.metaItem}>
                            <Ionicons name="document-text" size={14} color={theme.COLORS.textSecondary} />
                            <Text style={styles.metaText}>
                              {document.file_type.toUpperCase()}
                            </Text>
                          </View>
                          <View style={styles.metaItem}>
                            <Ionicons name="download" size={14} color={theme.COLORS.textSecondary} />
                            <Text style={styles.metaText}>
                              {formatFileSize(document.file_size)}
                            </Text>
                          </View>
                          <View style={styles.metaItem}>
                            <Ionicons name="person" size={14} color={theme.COLORS.textSecondary} />
                            <Text style={styles.metaText}>
                              {document.uploaded_by}
                            </Text>
                          </View>
                        </View>

                        {document.tags.length > 0 && (
                          <View style={styles.tagsContainer}>
                            {document.tags.slice(0, 3).map((tag, index) => (
                              <View key={index} style={styles.tag}>
                                <Text style={styles.tagText}>#{tag}</Text>
                              </View>
                            ))}
                            {document.tags.length > 3 && (
                              <Text style={styles.moreTags}>
                                +{document.tags.length - 3} more
                              </Text>
                            )}
                          </View>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Feather name="folder" size={64} color={theme.COLORS.textTertiary} />
                <Text style={styles.emptyText}>
                  {searchQuery ? 'No documents found' : 'No documents yet'}
                </Text>
                <Text style={styles.emptySubtext}>
                  {searchQuery
                    ? 'Try a different search term'
                    : 'Upload your first document to get started'}
                </Text>
                <TouchableOpacity
                  style={styles.uploadButton}
                  onPress={() => setShowUploadModal(true)}
                >
                  <Text style={styles.uploadButtonText}>Upload Document</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* Upload Modal */}
        <Modal
          visible={showUploadModal}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowUploadModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Upload Document</Text>
                <TouchableOpacity onPress={() => setShowUploadModal(false)}>
                  <Ionicons name="close" size={24} color={theme.COLORS.textPrimary} />
                </TouchableOpacity>
              </View>

              <ScrollView style={styles.modalForm}>
                {selectedFile ? (
                  <View style={styles.selectedFile}>
                    <View style={styles.fileInfo}>
                      <Ionicons 
                        name="document" 
                        size={32} 
                        color={theme.COLORS.primary} 
                      />
                      <View style={styles.fileDetails}>
                        <Text style={styles.fileName} numberOfLines={1}>
                          {selectedFile.name}
                        </Text>
                        <Text style={styles.fileSize}>
                          {formatFileSize(selectedFile.size || 0)}
                        </Text>
                      </View>
                    </View>
                    <TouchableOpacity
                      style={styles.changeFileButton}
                      onPress={pickDocument}
                    >
                      <Text style={styles.changeFileText}>Change</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TouchableOpacity style={styles.uploadArea} onPress={pickDocument}>
                    <Ionicons name="cloud-upload" size={48} color={theme.COLORS.textSecondary} />
                    <Text style={styles.uploadAreaTitle}>Select a file to upload</Text>
                    <Text style={styles.uploadAreaSubtitle}>
                      PDF, JPG, PNG, DOC, XLS up to 10MB
                    </Text>
                    <TouchableOpacity style={styles.browseButton}>
                      <Text style={styles.browseButtonText}>Browse Files</Text>
                    </TouchableOpacity>
                  </TouchableOpacity>
                )}

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Patient *</Text>
                  <View style={styles.patientSelect}>
                    <Text style={styles.patientSelectText}>
                      {formData.patient_id
                        ? patients.find(p => p.id === parseInt(formData.patient_id))?.name
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
                          formData.patient_id === patient.id.toString() && styles.patientOptionActive,
                        ]}
                        onPress={() => 
                          setFormData({ ...formData, patient_id: patient.id.toString() })
                        }
                      >
                        <Text style={[
                          styles.patientOptionText,
                          formData.patient_id === patient.id.toString() && styles.patientOptionTextActive,
                        ]}>
                          {patient.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Title *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter document title"
                    value={formData.title}
                    onChangeText={text => setFormData({ ...formData, title: text })}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Description</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Enter document description"
                    value={formData.description}
                    onChangeText={text => setFormData({ ...formData, description: text })}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Category</Text>
                  <View style={styles.categoryOptions}>
                    {categories
                      .filter(c => c.id !== 'all')
                      .map(category => (
                        <TouchableOpacity
                          key={category.id}
                          style={[
                            styles.categoryOption,
                            formData.category === category.id && styles.categoryOptionActive,
                          ]}
                          onPress={() => 
                            setFormData({ ...formData, category: category.id })
                          }
                        >
                          <Ionicons 
                            name={category.icon as any} 
                            size={16} 
                            color={formData.category === category.id ? theme.COLORS.textOnPrimary : category.color} 
                          />
                          <Text style={[
                            styles.categoryOptionText,
                            formData.category === category.id && styles.categoryOptionTextActive,
                          ]}>
                            {category.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Tags (comma separated)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g., lab, blood, test"
                    value={formData.tags}
                    onChangeText={text => setFormData({ ...formData, tags: text })}
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    (!selectedFile || !formData.patient_id || !formData.title || uploading) && 
                    styles.submitButtonDisabled,
                  ]}
                  onPress={handleUpload}
                  disabled={!selectedFile || !formData.patient_id || !formData.title || uploading}
                >
                  {uploading ? (
                    <ActivityIndicator color={theme.COLORS.textOnPrimary} />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload" size={20} color={theme.COLORS.textOnPrimary} />
                      <Text style={styles.submitButtonText}>Upload Document</Text>
                    </>
                  )}
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
    fontSize: 20,
    fontWeight: '700',
    color: theme.COLORS.textOnDark,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: theme.COLORS.textSecondary,
    textAlign: 'center',
  },
  categoriesScroll: {
    marginBottom: theme.SPACING.xl,
  },
  categoriesContent: {
    paddingHorizontal: 4,
    gap: theme.SPACING.md,
  },
  categoryCard: {
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.md,
    width: 120,
    alignItems: 'center',
    ...theme.SHADOWS.small,
  },
  categoryCardActive: {
    backgroundColor: theme.COLORS.primaryMuted,
    borderWidth: 2,
    borderColor: theme.COLORS.primary,
  },
  categoryIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.SPACING.sm,
  },
  categoryName: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.COLORS.textOnDark,
    textAlign: 'center',
    marginBottom: 4,
  },
  categoryCount: {
    fontSize: 12,
    color: theme.COLORS.textSecondary,
  },
  documentsSection: {
    marginBottom: theme.SPACING.xl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.COLORS.textOnDark,
  },
  documentCount: {
    color: theme.COLORS.textSecondary,
    fontWeight: '400',
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: theme.COLORS.card,
    paddingHorizontal: theme.SPACING.md,
    paddingVertical: theme.SPACING.xs,
    borderRadius: theme.LAYOUT.borderRadius.md,
  },
  sortText: {
    fontSize: 14,
    color: theme.COLORS.textSecondary,
  },
  documentsList: {
    gap: theme.SPACING.md,
  },
  documentCard: {
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.lg,
    ...theme.SHADOWS.medium,
  },
  documentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.SPACING.md,
  },
  documentInfo: {
    flexDirection: 'row',
    gap: theme.SPACING.md,
    flex: 1,
  },
  documentIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentDetails: {
    flex: 1,
  },
  documentTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.COLORS.textOnDark,
    marginBottom: 4,
  },
  documentPatient: {
    fontSize: 14,
    color: theme.COLORS.textSecondary,
  },
  documentDate: {
    color: theme.COLORS.textTertiary,
  },
  documentActions: {
    flexDirection: 'row',
    gap: theme.SPACING.xs,
  },
  documentAction: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  documentDescription: {
    fontSize: 14,
    color: theme.COLORS.textOnDark,
    lineHeight: 20,
    marginBottom: theme.SPACING.md,
  },
  documentFooter: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    paddingTop: theme.SPACING.md,
  },
  documentMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: theme.SPACING.sm,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: theme.COLORS.textSecondary,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.SPACING.xs,
  },
  tag: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: theme.SPACING.sm,
    paddingVertical: 2,
    borderRadius: theme.LAYOUT.borderRadius.sm,
  },
  tagText: {
    fontSize: 11,
    color: theme.COLORS.textSecondary,
  },
  moreTags: {
    fontSize: 11,
    color: theme.COLORS.textTertiary,
    marginLeft: theme.SPACING.xs,
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
  uploadButton: {
    backgroundColor: theme.COLORS.primary,
    paddingHorizontal: theme.SPACING.xl,
    paddingVertical: theme.SPACING.md,
    borderRadius: theme.LAYOUT.borderRadius.md,
  },
  uploadButtonText: {
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
  selectedFile: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: theme.COLORS.inputBackground,
    borderRadius: theme.LAYOUT.borderRadius.md,
    padding: theme.SPACING.md,
    marginBottom: theme.SPACING.lg,
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.SPACING.md,
    flex: 1,
  },
  fileDetails: {
    flex: 1,
  },
  fileName: {
    fontSize: 16,
    color: theme.COLORS.textPrimary,
    marginBottom: 2,
  },
  fileSize: {
    fontSize: 12,
    color: theme.COLORS.textSecondary,
  },
  changeFileButton: {
    backgroundColor: theme.COLORS.primary,
    paddingHorizontal: theme.SPACING.md,
    paddingVertical: theme.SPACING.xs,
    borderRadius: theme.LAYOUT.borderRadius.md,
  },
  changeFileText: {
    color: theme.COLORS.textOnPrimary,
    fontSize: 14,
    fontWeight: '500',
  },
  uploadArea: {
    backgroundColor: theme.COLORS.inputBackground,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.xl,
    alignItems: 'center',
    marginBottom: theme.SPACING.lg,
    borderWidth: 2,
    borderColor: theme.COLORS.border,
    borderStyle: 'dashed',
  },
  uploadAreaTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.COLORS.textPrimary,
    marginTop: theme.SPACING.md,
    marginBottom: theme.SPACING.xs,
  },
  uploadAreaSubtitle: {
    fontSize: 14,
    color: theme.COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: theme.SPACING.lg,
  },
  browseButton: {
    backgroundColor: theme.COLORS.primary,
    paddingHorizontal: theme.SPACING.xl,
    paddingVertical: theme.SPACING.md,
    borderRadius: theme.LAYOUT.borderRadius.md,
  },
  browseButtonText: {
    color: theme.COLORS.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
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
  categoryOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: theme.SPACING.sm,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.SPACING.xs,
    backgroundColor: theme.COLORS.inputBackground,
    paddingHorizontal: theme.SPACING.md,
    paddingVertical: theme.SPACING.sm,
    borderRadius: theme.LAYOUT.borderRadius.md,
  },
  categoryOptionActive: {
    backgroundColor: theme.COLORS.primary,
  },
  categoryOptionText: {
    fontSize: 14,
    color: theme.COLORS.textPrimary,
  },
  categoryOptionTextActive: {
    color: theme.COLORS.textOnPrimary,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.SPACING.sm,
    backgroundColor: theme.COLORS.primary,
    padding: theme.SPACING.lg,
    borderRadius: theme.LAYOUT.borderRadius.md,
    marginTop: theme.SPACING.lg,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: theme.COLORS.textOnPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
});