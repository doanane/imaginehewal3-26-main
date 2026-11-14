import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Platform,
    ScrollView,
    Share,
    StatusBar,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';

const BASE_URL = process.env.EXPO_PUBLIC_BASE_URL || 'http://localhost:8000';

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout, updateUserProfile } = useAuth();
  
  const [uploading, setUploading] = useState(false);

  const getProfileImage = () => {
    if (user?.profile_image) {
      if (user.profile_image.startsWith('http')) return { uri: user.profile_image };
      return { uri: `${BASE_URL}${user.profile_image}` };
    }
    return { uri: `https://ui-avatars.com/api/?name=${user?.full_name || 'User'}&background=DC2626&color=fff&size=256` };
  };

  const pickImage = async () => {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to make this work!');
        return;
      }
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (!result.canceled) {
      handleImageUpload(result.assets[0].uri);
    }
  };

  const handleImageUpload = async (uri: string) => {
    setUploading(true);
    try {
      const formData = new FormData();
      let filename = uri.split('/').pop() || 'profile.jpg';

      if (Platform.OS === 'web') {
        const response = await fetch(uri);
        const blob = await response.blob();
        
        if (!filename.includes('.')) {
          if (blob.type === 'image/png') filename += '.png';
          else if (blob.type === 'image/webp') filename += '.webp';
          else if (blob.type === 'image/gif') filename += '.gif';
          else filename += '.jpg'; 
        }
        formData.append('file', blob, filename);
      } else {
        let finalUri = uri;
        if (Platform.OS === 'android' && !uri.startsWith('file://')) {
          finalUri = `file://${uri}`;
        }
        
        const match = /\.(\w+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : `image/jpeg`;

        formData.append('file', {
          uri: finalUri,
          name: filename,
          type: type,
        } as any);
      }

      console.log(`Uploading ${filename}...`);
      const response = await api.uploadProfileImage(formData);
      console.log('Upload success:', response);

      updateUserProfile({ profile_image: response.image_url });
      
      if (Platform.OS === 'web') {
        window.alert('Profile picture updated!');
      } else {
        Alert.alert('Success', 'Profile picture updated!');
      }

    } catch (error: any) {
      console.error('Upload failed:', error);
      const msg = error.message || 'Could not upload image.';
      
      if (msg.includes('Only image files are allowed')) {
         if (Platform.OS === 'web') window.alert('Error: Backend requires a valid image extension (JPG, PNG).');
         else Alert.alert('Upload Error', 'Backend requires a valid image extension.');
      } else {
         if (Platform.OS === 'web') window.alert(msg);
         else Alert.alert('Upload Failed', msg);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = () => {
    const doLogout = async () => {
      try {
        setUploading(true);
        await logout();
        router.replace('/(auth)/login');
      } catch (error) {
        console.error('Logout error:', error);
        router.replace('/(auth)/login');
      } finally {
        setUploading(false);
      }
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Are you sure you want to sign out?')) {
        doLogout();
      }
    } else {
      Alert.alert(
        'Sign Out',
        'Are you sure you want to sign out?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Sign Out', style: 'destructive', onPress: doLogout }
        ]
      );
    }
  };

  const handleCopyId = async () => {
    const patientId = user?.id || 'N/A';
    await Clipboard.setStringAsync(patientId.toString());
    if (Platform.OS === 'web') {
      window.alert(`Patient ID "${patientId}" copied to clipboard`);
    } else {
      Alert.alert('Copied!', `Patient ID "${patientId}" copied to clipboard`);
    }
  };

  const handleShareId = async () => {
    try {
      const patientId = user?.id || 'N/A';
      const fullName = user?.full_name || user?.username || 'Patient';
      
      if (Platform.OS === 'web') {
        const message = `Hi! I'm ${fullName}, a patient on HEWAL3.\n\nConnect with me using my Patient ID:\n${patientId}\n\nI'm looking for a caregiver to provide me with professional care.`;
        await Clipboard.setStringAsync(message);
        window.alert('Message copied to clipboard. Paste it to share.');
        return;
      }

      await Share.share({
        message: `Hi! I'm ${fullName}, a patient on HEWAL3.\n\nConnect with me using my Patient ID:\n${patientId}\n\nI'm looking for a caregiver to provide me with professional care.`,
        title: 'Share Patient ID'
      });
    } catch (error: any) {
      console.error('Error sharing:', error);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(patient)/home');
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      <LinearGradient
        colors={[theme.COLORS.background, '#E0F2FE', '#DBEAFE']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.iconBtn}>
            <Ionicons name="arrow-back" size={24} color={theme.COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Profile</Text>
          <TouchableOpacity style={styles.iconBtn}>
            <Ionicons name="notifications-outline" size={24} color={theme.COLORS.textPrimary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <View style={styles.profileCard}>
            <View style={styles.avatarContainer}>
              <View style={styles.avatarWrapper}>
                {uploading ? (
                  <View style={[styles.avatar, styles.loadingAvatar]}>
                    <ActivityIndicator color={theme.COLORS.primary} />
                  </View>
                ) : (
                  <Image source={getProfileImage()} style={styles.avatar} />
                )}
              </View>
              
              <TouchableOpacity style={styles.editBadge} onPress={pickImage} activeOpacity={0.8}>
                <Ionicons name="camera" size={16} color={theme.COLORS.textOnPrimary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.userName}>
              {user?.full_name || user?.username || 'User Name'}
            </Text>
            <Text style={styles.userRole}>
              {user?.user_type ? user.user_type.charAt(0).toUpperCase() + user.user_type.slice(1) : 'Patient'}
            </Text>
          </View>

          {/* Patient ID Card */}
          <View style={styles.idCard}>
            <View style={styles.idCardHeader}>
              <Ionicons name="card" size={20} color={theme.COLORS.primary} />
              <Text style={styles.idCardTitle}>My Patient ID</Text>
            </View>
            <View style={styles.idCardBody}>
              <Text style={styles.idCardValue}>{user?.id || 'N/A'}</Text>
            </View>
            <View style={styles.idCardActions}>
              <TouchableOpacity 
                style={styles.idActionButton} 
                onPress={handleCopyId}
                activeOpacity={0.7}
              >
                <Ionicons name="copy-outline" size={18} color={theme.COLORS.primary} />
                <Text style={styles.idActionText}>Copy ID</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.idActionButton, styles.idActionButtonPrimary]} 
                onPress={handleShareId}
                activeOpacity={0.7}
              >
                <Ionicons name="share-outline" size={18} color={theme.COLORS.textOnPrimary} />
                <Text style={[styles.idActionText, styles.idActionTextWhite]}>Share ID</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.idCardFooter}>
              <Ionicons name="information-circle-outline" size={14} color={theme.COLORS.textSecondary} />
              <Text style={styles.idCardHint}>Share this ID with your caregiver to connect</Text>
            </View>
          </View>

          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>Account Settings</Text>
          </View>

          <View style={styles.menuContainer}>
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => router.push('/(auth)/change-password')}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <View style={[styles.menuIconBg, { backgroundColor: theme.COLORS.primaryMuted }]}>
                  <Ionicons name="lock-closed" size={20} color={theme.COLORS.primary} />
                </View>
                <Text style={styles.menuText}>Change Password</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.COLORS.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => router.push('/(patient)/profile-setup')}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <View style={[styles.menuIconBg, { backgroundColor: theme.COLORS.infoLight }]}>
                  <Ionicons name="person" size={20} color={theme.COLORS.info} />
                </View>
                <Text style={styles.menuText}>Edit Profile</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.COLORS.textTertiary} />
            </TouchableOpacity>

             <TouchableOpacity 
               style={styles.menuItem}
               onPress={() => router.push('/(patient)/settings')}
               activeOpacity={0.7}
             >
              <View style={styles.menuLeft}>
                <View style={[styles.menuIconBg, { backgroundColor: theme.COLORS.warningLight }]}>
                  <Ionicons name="settings" size={20} color={theme.COLORS.warning} />
                </View>
                <Text style={styles.menuText}>App Settings</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.COLORS.textTertiary} />
            </TouchableOpacity>
          </View>

          <View style={styles.sectionTitleContainer}>
            <Text style={styles.sectionTitle}>Support</Text>
          </View>

          <View style={styles.menuContainer}>
            <TouchableOpacity 
              style={styles.menuItem}
              onPress={() => {}}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                <View style={[styles.menuIconBg, { backgroundColor: theme.COLORS.successLight }]}>
                  <Ionicons name="help-circle" size={20} color={theme.COLORS.success} />
                </View>
                <Text style={styles.menuText}>Help & Support</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={theme.COLORS.textTertiary} />
            </TouchableOpacity>

            <TouchableOpacity 
              style={[styles.menuItem, styles.signOutItem]} 
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <View style={styles.menuLeft}>
                 <View style={[styles.menuIconBg, { backgroundColor: theme.COLORS.dangerLight }]}>
                   <Ionicons name="log-out" size={20} color={theme.COLORS.danger} />
                 </View>
                 <Text style={[styles.menuText, { color: theme.COLORS.danger }]}>Sign Out</Text>
              </View>
            </TouchableOpacity>
          </View>

          <Text style={styles.footerVersion}>HEWAL3 v3.0.0</Text>
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.SPACING.lg,
    paddingVertical: theme.SPACING.md,
  },
  headerTitle: {
    ...theme.TYPOGRAPHY.h3,
    color: theme.COLORS.textPrimary,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    ...theme.SHADOWS.small,
  },
  scrollContent: {
    paddingHorizontal: theme.SPACING.lg,
    paddingTop: theme.SPACING.md,
  },
  profileCard: {
    alignItems: 'center',
    marginBottom: theme.SPACING.xl,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: theme.SPACING.md,
  },
  avatarWrapper: {
    padding: 4,
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.full,
    ...theme.SHADOWS.medium,
  },
  avatar: {
    width: 110,
    height: 110,
    borderRadius: theme.LAYOUT.borderRadius.full,
    backgroundColor: theme.COLORS.separator,
  },
  loadingAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  editBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: theme.COLORS.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: theme.COLORS.card,
    ...theme.SHADOWS.small,
  },
  userName: {
    ...theme.TYPOGRAPHY.h2,
    color: theme.COLORS.textPrimary,
    marginBottom: 4,
  },
  userRole: {
    ...theme.TYPOGRAPHY.body,
    color: theme.COLORS.textSecondary,
    backgroundColor: theme.COLORS.primaryMuted,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    fontSize: 14,
    fontWeight: '600',
  },
  sectionTitleContainer: {
    marginBottom: theme.SPACING.sm,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    ...theme.TYPOGRAPHY.label,
    color: theme.COLORS.textTertiary,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  menuContainer: {
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.xl,
    padding: theme.SPACING.sm,
    marginBottom: theme.SPACING.lg,
    ...theme.SHADOWS.small,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: theme.SPACING.md,
    borderRadius: theme.LAYOUT.borderRadius.lg,
  },
  menuLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.SPACING.md,
  },
  menuIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuText: {
    ...theme.TYPOGRAPHY.bodyMedium,
    color: theme.COLORS.textPrimary,
    fontSize: 16,
  },
  signOutItem: {
    marginTop: 0,
  },
  footerVersion: {
    marginTop: theme.SPACING.md,
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textTertiary,
    textAlign: 'center',
  },
  // ID Card Styles
  idCard: {
    backgroundColor: theme.COLORS.card,
    borderRadius: theme.LAYOUT.borderRadius.xl,
    padding: theme.SPACING.lg,
    marginBottom: theme.SPACING.xl,
    borderWidth: 2,
    borderColor: theme.COLORS.primary + '30',
    ...theme.SHADOWS.medium,
  },
  idCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.SPACING.sm,
    marginBottom: theme.SPACING.md,
  },
  idCardTitle: {
    ...theme.TYPOGRAPHY.bodyMedium,
    color: theme.COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '600',
  },
  idCardBody: {
    backgroundColor: theme.COLORS.primaryMuted + '40',
    borderRadius: theme.LAYOUT.borderRadius.lg,
    padding: theme.SPACING.lg,
    marginBottom: theme.SPACING.md,
    alignItems: 'center',
  },
  idCardValue: {
    ...theme.TYPOGRAPHY.h2,
    color: theme.COLORS.primary,
    fontWeight: 'bold',
    fontSize: 24,
    letterSpacing: 2,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  idCardActions: {
    flexDirection: 'row',
    gap: theme.SPACING.md,
    marginBottom: theme.SPACING.sm,
  },
  idActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.SPACING.xs,
    paddingVertical: theme.SPACING.md,
    paddingHorizontal: theme.SPACING.lg,
    borderRadius: theme.LAYOUT.borderRadius.lg,
    borderWidth: 1.5,
    borderColor: theme.COLORS.primary,
    backgroundColor: 'transparent',
  },
  idActionButtonPrimary: {
    backgroundColor: theme.COLORS.primary,
    borderColor: theme.COLORS.primary,
  },
  idActionText: {
    ...theme.TYPOGRAPHY.bodyMedium,
    color: theme.COLORS.primary,
    fontWeight: '600',
    fontSize: 14,
  },
  idActionTextWhite: {
    color: theme.COLORS.textOnPrimary,
  },
  idCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.SPACING.xs,
    marginTop: theme.SPACING.sm,
  },
  idCardHint: {
    ...theme.TYPOGRAPHY.small,
    color: theme.COLORS.textSecondary,
    fontSize: 12,
    flex: 1,
  },
});