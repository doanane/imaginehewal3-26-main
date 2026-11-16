// front/app/(caregiver)/caregiver-profile.tsx - Enhanced Version
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  Alert,
  Clipboard,
  Modal,
  Platform,
  Share,
  StyleSheet,
} from 'react-native';
import { GRADIENTS, theme } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import api, { CaregiverProfile } from '../../services/api';
import { ActivityIndicator, Image, Ionicons, LinearGradient, ScrollView, StatusBar, Switch, Text, TextInput, TouchableOpacity, View } from '../../components/themed';

export default function CaregiverProfileScreen() {
  const router = useRouter();
  const { user, logout, updateUserProfile } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [profileData, setProfileData] = useState<CaregiverProfile | null>(null);
  const [tempData, setTempData] = useState({
    first_name: '',
    last_name: '',
    phone_number: '',
    caregiver_type: '',
    experience_years: '',
  });

  useEffect(() => {
    fetchProfileData();
  }, []);

  const fetchProfileData = async () => {
    try {
      setLoading(true);
      const data = await api.getCaregiverProfile();
      setProfileData(data);
      setTempData({
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        phone_number: data.phone_number || '',
        caregiver_type: data.caregiver_type || '',
        experience_years: data.experience_years?.toString() || '',
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleImagePick = async () => {
    try {
      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Please allow access to your photo library');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets[0].uri) {
        const formData = new FormData();
        formData.append('profile_image', {
          uri: result.assets[0].uri,
          type: 'image/jpeg',
          name: 'profile.jpg',
        } as any);

        setSaving(true);
        const response = await api.uploadProfileImage(formData);
        
        if (response.profile_image_url) {
          updateUserProfile({ profile_image: response.profile_image_url });
          Alert.alert('Success', 'Profile picture updated');
        }
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to update profile picture');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);
      const updateData = {
        first_name: tempData.first_name,
        last_name: tempData.last_name,
        phone_number: tempData.phone_number,
        caregiver_type: tempData.caregiver_type,
        experience_years: tempData.experience_years ? parseInt(tempData.experience_years) : undefined,
      };

      await api.updateCaregiverProfile(updateData);
      
      // Update local user data
      updateUserProfile({
        full_name: `${tempData.first_name} ${tempData.last_name}`,
        phone_number: tempData.phone_number,
      });

      setShowEditModal(false);
      fetchProfileData();
      
      Alert.alert('Success', 'Profile updated successfully');
    } catch (error) {
      console.error('Error updating profile:', error);
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert(
      'Confirm Logout',
      'Are you sure you want to log out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Logout', style: 'destructive', onPress: logout }
      ]
    );
  };

  const handleCopyId = () => {
    const caregiverId = user?.caregiver_id || profileData?.id || 'N/A';
    Clipboard.setString(String(caregiverId));
    Alert.alert('Copied!', `Caregiver ID "${caregiverId}" copied to clipboard`);
  };

  const handleShareId = async () => {
    try {
      const caregiverId = user?.caregiver_id || profileData?.id || 'N/A';
      const fullName = `${profileData?.first_name || ''} ${profileData?.last_name || ''}`.trim();
      await Share.share({
        message: `Hi! I'm ${fullName}, a caregiver on HEWAL3.\n\nConnect with me using my Caregiver ID:\n${caregiverId}\n\nShare your Patient ID with me so I can provide you with professional care.`,
        title: 'Share Caregiver ID'
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const menuItems = [
    { 
      icon: 'person-outline', 
      title: 'Edit Profile', 
      onPress: () => setShowEditModal(true),
      color: theme.COLORS.primary 
    },
    { 
      icon: 'notifications-outline', 
      title: 'Notifications', 
      onPress: () => setNotifications(!notifications),
      color: theme.COLORS.success,
      rightComponent: (
        <Switch 
          value={notifications}
          onValueChange={setNotifications}
          trackColor={{ false: theme.COLORS.border, true: theme.COLORS.success }}
          thumbColor={theme.COLORS.card}
        />
      )
    },
    { 
      icon: 'moon-outline', 
      title: 'Dark Mode', 
      onPress: () => setDarkMode(!darkMode),
      color: theme.COLORS.textPrimary,
      rightComponent: (
        <Switch 
          value={darkMode}
          onValueChange={setDarkMode}
          trackColor={{ false: theme.COLORS.border, true: theme.COLORS.primary }}
          thumbColor={theme.COLORS.card}
        />
      )
    },
    { 
      icon: 'shield-checkmark-outline', 
      title: 'Privacy & Security', 
      onPress: () => router.push('/(caregiver)/verify'),
      color: theme.COLORS.info 
    },
    { 
      icon: 'help-circle-outline', 
      title: 'Help & Support', 
      onPress: () => router.push('/(caregiver)/about'),
      color: theme.COLORS.warning 
    },
    { 
      icon: 'document-text-outline', 
      title: 'Terms & Policies', 
      onPress: () => {},
      color: theme.COLORS.textSecondary 
    },
  ];

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.COLORS.primary} />
        <Text style={styles.loadingText}>Loading profile...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={styles.headerRightPlaceholder} />
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Profile Header */}
        <View style={styles.profileHeader}>
          <TouchableOpacity 
            style={styles.profileImageContainer}
            onPress={handleImagePick}
            disabled={saving}
          >
            {saving ? (
              <View style={styles.profileImageLoading}>
                <ActivityIndicator color={theme.COLORS.textOnPrimary} />
              </View>
            ) : user?.profile_image ? (
              <Image source={{ uri: user.profile_image }} style={styles.profileImage} />
            ) : (
              <LinearGradient
                colors={GRADIENTS.primary}
                style={styles.profileInitials}
              >
                <Text style={styles.profileInitialsText}>
                  {profileData?.first_name?.charAt(0) || user?.full_name?.charAt(0) || 'C'}
                </Text>
              </LinearGradient>
            )}
            <View style={styles.editImageBadge}>
              <Ionicons name="camera" size={16} color={theme.COLORS.textOnPrimary} />
            </View>
          </TouchableOpacity>
          
          <View style={styles.profileInfo}>
            <Text style={styles.profileName}>
              {profileData?.first_name} {profileData?.last_name}
            </Text>
            <Text style={styles.profileEmail}>{user?.email}</Text>
            
            {/* Prominent ID Card */}
            <View style={styles.idCard}>
              <View style={styles.idCardHeader}>
                <Ionicons name="id-card" size={20} color={theme.COLORS.primary} />
                <Text style={styles.idCardTitle}>My Caregiver ID</Text>
              </View>
              <View style={styles.idCardBody}>
                <Text style={styles.idCardValue}>{user?.caregiver_id || profileData?.id || 'Loading...'}</Text>
                <View style={styles.idCardActions}>
                  <TouchableOpacity 
                    style={styles.idActionButton}
                    onPress={handleCopyId}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="copy-outline" size={18} color={theme.COLORS.primary} />
                    <Text style={styles.idActionText}>Copy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.idActionButton, styles.idActionButtonPrimary]}
                    onPress={handleShareId}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="share-social-outline" size={18} color="#FFFFFF" />
                    <Text style={[styles.idActionText, styles.idActionTextWhite]}>Share</Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.idCardFooter}>
                <Ionicons name="information-circle-outline" size={14} color={theme.COLORS.textTertiary} />
                <Text style={styles.idCardHint}>Share this ID with patients to connect</Text>
              </View>
            </View>
            
            <View style={styles.profileStats}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profileData?.caregiver_type || 'Caregiver'}</Text>
                <Text style={styles.statLabel}>Role</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{profileData?.experience_years || '0'} yrs</Text>
                <Text style={styles.statLabel}>Experience</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Menu Items */}
        <View style={styles.menuSection}>
          <Text style={styles.sectionTitle}>Account Settings</Text>
          <View style={styles.menuList}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.menuItem}
                onPress={item.onPress}
                activeOpacity={0.7}
              >
                <View style={styles.menuItemLeft}>
                  <View style={[styles.menuIconContainer, { backgroundColor: item.color + '15' }]}>
                    <Ionicons name={item.icon as any} size={20} color={item.color} />
                  </View>
                  <Text style={styles.menuItemTitle}>{item.title}</Text>
                </View>
                {item.rightComponent || (
                  <Ionicons name="chevron-forward" size={20} color={theme.COLORS.textTertiary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity 
          style={styles.logoutButton}
          onPress={handleLogout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color={theme.COLORS.danger} />
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>

        <Text style={styles.versionText}>HEWAL3 Care v1.0.0</Text>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={showEditModal}
        animationType="slide"
        transparent
        onRequestClose={() => {
          if (!saving) setShowEditModal(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity 
                onPress={() => !saving && setShowEditModal(false)}
                disabled={saving}
              >
                <Ionicons name="close" size={24} color={theme.COLORS.textPrimary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>First Name</Text>
                <TextInput
                  style={styles.input}
                  value={tempData.first_name}
                  onChangeText={(text) => setTempData({...tempData, first_name: text})}
                  placeholder="Enter first name"
                  editable={!saving}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Last Name</Text>
                <TextInput
                  style={styles.input}
                  value={tempData.last_name}
                  onChangeText={(text) => setTempData({...tempData, last_name: text})}
                  placeholder="Enter last name"
                  editable={!saving}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={tempData.phone_number}
                  onChangeText={(text) => setTempData({...tempData, phone_number: text})}
                  placeholder="Enter phone number"
                  keyboardType="phone-pad"
                  editable={!saving}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Caregiver Type</Text>
                <TextInput
                  style={styles.input}
                  value={tempData.caregiver_type}
                  onChangeText={(text) => setTempData({...tempData, caregiver_type: text})}
                  placeholder="e.g., Professional, Family"
                  editable={!saving}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>Years of Experience</Text>
                <TextInput
                  style={styles.input}
                  value={tempData.experience_years}
                  onChangeText={(text) => setTempData({...tempData, experience_years: text})}
                  placeholder="Enter years"
                  keyboardType="numeric"
                  editable={!saving}
                />
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowEditModal(false)}
                disabled={saving}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSaveProfile}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={theme.COLORS.textOnPrimary} size="small" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Changes</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.COLORS.background,
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
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.SPACING.lg,
    paddingTop: Platform.OS === 'ios' ? 60 : (StatusBar.currentHeight ?? 0) + 20,
    paddingBottom: theme.SPACING.md,
    backgroundColor: theme.COLORS.background,
    borderBottomWidth: 1,
    borderBottomColor: theme.COLORS.separator,
  },
  backButton: {
    padding: theme.SPACING.xs,
  },
  headerTitle: {
    ...theme.TYPOGRAPHY.h2,
    color: theme.COLORS.textPrimary,
  },
  headerRightPlaceholder: {
    width: 40,
  },
  scrollContent: {
    paddingBottom: theme.SPACING.xxl,
  },
  profileHeader: {
    padding: theme.SPACING.lg,
    alignItems: 'center',
    backgroundColor: theme.COLORS.card,
    marginHorizontal: theme.SPACING.lg,
    marginTop: theme.SPACING.lg,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    ...theme.SHADOWS.medium,
  },
  profileImageContainer: {
    position: 'relative',
    marginBottom: theme.SPACING.lg,
  },
  profileImageLoading: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: theme.COLORS.card,
  },
  profileInitials: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 4,
    borderColor: theme.COLORS.card,
  },
  profileInitialsText: {
    color: theme.COLORS.textOnPrimary,
    fontSize: 36,
    fontWeight: '600',
  },
  editImageBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.COLORS.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: theme.COLORS.card,
  },
  profileInfo: {
    alignItems: 'center',
  },
  profileName: {
    ...theme.TYPOGRAPHY.h1,
    color: theme.COLORS.textPrimary,
    marginBottom: theme.SPACING.xs,
    textAlign: 'center',
  },
  profileEmail: {
    ...theme.TYPOGRAPHY.body,
    color: theme.COLORS.textSecondary,
    marginBottom: theme.SPACING.md,
  },
  // New ID Card Styles
  idCard: {
    width: '100%',
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.lg,
    marginBottom: theme.SPACING.lg,
    borderWidth: 2,
    borderColor: theme.COLORS.primary,
    ...theme.SHADOWS.medium,
  },
  idCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.SPACING.sm,
    marginBottom: theme.SPACING.md,
  },
  idCardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  idCardBody: {
    marginBottom: theme.SPACING.md,
  },
  idCardValue: {
    fontSize: 24,
    fontWeight: '700',
    color: theme.COLORS.primary,
    letterSpacing: 2,
    textAlign: 'center',
    marginBottom: theme.SPACING.md,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  idCardActions: {
    flexDirection: 'row',
    gap: theme.SPACING.sm,
  },
  idActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.SPACING.xs,
    paddingVertical: theme.SPACING.sm,
    paddingHorizontal: theme.SPACING.md,
    borderRadius: theme.LAYOUT.borderRadius.md,
    backgroundColor: theme.COLORS.background,
    borderWidth: 1,
    borderColor: theme.COLORS.primary,
  },
  idActionButtonPrimary: {
    backgroundColor: theme.COLORS.primary,
    borderColor: theme.COLORS.primary,
  },
  idActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.COLORS.primary,
  },
  idActionTextWhite: {
    color: '#FFFFFF',
  },
  idCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.SPACING.xs,
    paddingTop: theme.SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: theme.COLORS.border,
  },
  idCardHint: {
    fontSize: 12,
    color: theme.COLORS.textTertiary,
    flex: 1,
  },
  // Old ID Badge (kept for backwards compatibility but hidden)
  idBadge: {
    display: 'none',
  },
  idText: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.primary,
    fontWeight: '600',
  },
  profileStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.SPACING.lg,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    ...theme.TYPOGRAPHY.bodyMedium,
    color: theme.COLORS.textPrimary,
    fontWeight: '600',
    marginBottom: 2,
  },
  statLabel: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textTertiary,
  },
  statDivider: {
    width: 1,
    height: 24,
    backgroundColor: theme.COLORS.separator,
  },
  menuSection: {
    marginTop: theme.SPACING.xl,
    paddingHorizontal: theme.SPACING.lg,
  },
  sectionTitle: {
    ...theme.TYPOGRAPHY.h3,
    color: theme.COLORS.textPrimary,
    marginBottom: theme.SPACING.md,
  },
  menuList: {
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    overflow: 'hidden',
    ...theme.SHADOWS.medium,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: theme.SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: theme.COLORS.separator,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIconContainer: {
    width: 40,
    height: 40,
    borderRadius: theme.LAYOUT.borderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: theme.SPACING.md,
  },
  menuItemTitle: {
    ...theme.TYPOGRAPHY.bodyMedium,
    color: theme.COLORS.textPrimary,
    flex: 1,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.SPACING.sm,
    backgroundColor: theme.COLORS.danger + '15',
    marginHorizontal: theme.SPACING.lg,
    marginTop: theme.SPACING.xl,
    padding: theme.SPACING.lg,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    ...theme.SHADOWS.medium,
  },
  logoutText: {
    ...theme.TYPOGRAPHY.bodyMedium,
    color: theme.COLORS.danger,
    fontWeight: '600',
  },
  versionText: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textTertiary,
    textAlign: 'center',
    marginTop: theme.SPACING.xl,
    marginBottom: theme.SPACING.xxl,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: theme.COLORS.overlay,
    justifyContent: 'flex-end',
  },
  modalContainer: {
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
    ...theme.TYPOGRAPHY.h2,
    color: theme.COLORS.textPrimary,
  },
  modalContent: {
    padding: theme.SPACING.lg,
    maxHeight: 400,
  },
  inputGroup: {
    marginBottom: theme.SPACING.lg,
  },
  inputLabel: {
    ...theme.TYPOGRAPHY.captionMedium,
    color: theme.COLORS.textSecondary,
    marginBottom: theme.SPACING.xs,
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
  modalActions: {
    flexDirection: 'row',
    padding: theme.SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: theme.COLORS.separator,
    gap: theme.SPACING.md,
  },
  modalButton: {
    flex: 1,
    padding: theme.SPACING.md,
    borderRadius: theme.LAYOUT.borderRadius.md,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: theme.COLORS.inputBackground,
  },
  cancelButtonText: {
    ...theme.TYPOGRAPHY.bodyMedium,
    color: theme.COLORS.textSecondary,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: theme.COLORS.primary,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    ...theme.TYPOGRAPHY.bodyMedium,
    color: theme.COLORS.textOnPrimary,
    fontWeight: '600',
  },
});