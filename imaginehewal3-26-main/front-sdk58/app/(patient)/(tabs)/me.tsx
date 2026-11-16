import { resolveBaseUrl } from '../../../services/baseUrl';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Alert, Platform, Share } from 'react-native';
import { Avatar, Badge, Card, ListRow, Screen, ScreenHeader, Section, T } from '../../../components/ui';
import { theme } from '../../../constants/theme';
import { useAuth } from '../../../contexts/AuthContext';
import { useMessaging } from '../../../contexts/MessagingContext';
import api from '../../../services/api';
import { imagePart } from '../../../services/upload';
import { profileImageSource } from '../../../services/imageUrl';
import { ActivityIndicator, Image, Ionicons, Pressable, View } from '../../../components/themed';

const C = theme.COLORS;
const BASE_URL = resolveBaseUrl();

function imageUri(value?: string) {
  if (!value) return null;
  return value.startsWith('http') ? value : `${BASE_URL}${value}`;
}

export default function Me() {
  const router = useRouter();
  const { user, logout, updateUserProfile } = useAuth();
  const { isConnected } = useMessaging();
  const [uploading, setUploading] = useState(false);
  const [demo, setDemo] = useState(false);
  useEffect(() => { api.getEmergencyConfig().then((c) => setDemo(!!c.simulation)).catch(() => {}); }, []);
  const name = user?.full_name || user?.username || 'Your account';
  const patientId = String(user?.patient_id || user?.id || '');

  const pickPhoto = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo access to choose a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (result.canceled) return;
    setUploading(true);
    try {
      const uri = result.assets[0].uri;
      const filename = uri.split('/').pop() || 'profile.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const form = new FormData();
      const up = await imagePart(uri);
      form.append('file', up.part, up.name);
      const response = await api.uploadProfileImage(form);
      await updateUserProfile({ profile_image: response.image_url });
      Alert.alert('Profile updated', 'Your profile picture has been saved.');
    } catch (error: any) {
      Alert.alert('Upload failed', error?.message || 'Could not save your profile picture.');
    } finally {
      setUploading(false);
    }
  };

  const shareId = async () => {
    if (!patientId) return;
    const message = `Connect with me on HEWAL3 using Patient ID: ${patientId}`;
    if (Platform.OS === 'web') await Clipboard.setStringAsync(message);
    else await Share.share({ message, title: 'Share Patient ID' });
  };

  const signOut = () => Alert.alert('Sign out?', 'You will need to sign in again.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: async () => { await logout(); router.replace('/(auth)/login'); } },
  ]);

  return (
    <Screen header={<ScreenHeader title="Profile" onBack={() => router.canGoBack() ? router.back() : router.replace('/(patient)/(tabs)/today' as any)} />}>
      <Card tone="soft">
        <View style={{ alignItems: 'center' }}>
          <View style={{ position: 'relative' }}>
            {uploading ? (
              <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }}>
                <ActivityIndicator color={C.primary} />
              </View>
            ) : profileImageSource(user?.profile_image) ? (
              <Image source={profileImageSource(user?.profile_image) as any} style={{ width: 92, height: 92, borderRadius: 46 }} />
            ) : <Avatar name={name} size={92} />}
            <Pressable onPress={pickPhoto} accessibilityRole="button" accessibilityLabel="Change profile picture"
              style={{ position: 'absolute', right: 0, bottom: 0, backgroundColor: C.primary, borderRadius: 16, padding: 8 }}>
              <Ionicons name="camera" size={17} color="#fff" />
            </Pressable>
          </View>
          <T v="title" style={{ marginTop: 12 }}>{name}</T>
          <T v="caption" color={C.textSecondary}>{user?.email}</T>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <Badge label="Patient" tone="info" />
            <Badge label={isConnected ? 'Connected' : 'Offline'} tone={isConnected ? 'success' : 'neutral'} />
          </View>
          <T v="label" color={C.primary} onPress={pickPhoto} accessibilityRole="button" style={{ marginTop: 14 }}>Change profile picture</T>
        </View>
      </Card>

      <Section title="Your identity">
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <T v="overline" color={C.textSecondary}>Patient ID</T>
              <T v="heading" style={{ marginTop: 4 }}>{patientId || '--'}</T>
              <T v="caption" color={C.textSecondary}>Share this ID when a caregiver requests a connection.</T>
            </View>
            <Ionicons name="share-outline" size={22} color={C.primary} onPress={shareId} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
            <T v="label" color={C.primary} onPress={() => Clipboard.setStringAsync(patientId)} accessibilityRole="button">Copy ID</T>
            <T v="label" color={C.primary} onPress={shareId} accessibilityRole="button">Share ID</T>
          </View>
        </Card>
      </Section>

      <Section title="Health and care">
        <Card>
          <ListRow icon="person-outline" title="Personal and medical details" subtitle="Conditions, medicines and body measurements" onPress={() => router.push('/(patient)/profile' as any)} />
          <ListRow icon="heart-outline" title="Health overview" subtitle="Vitals, trends and recent readings" onPress={() => router.push('/(patient)/health' as any)} />
          <ListRow icon="chatbubbles-outline" title="Messages with care team" subtitle="Chat with your caregivers and doctors" onPress={() => router.push('/(patient)/messages' as any)} />
          {demo ? <ListRow icon="flask-outline" title="Demo tools" subtitle="Simulate a blood pressure spike to show the emergency flow" onPress={() => router.push('/(patient)/demo' as any)} /> : null}
          <ListRow icon="medkit-outline" title="My doctor" subtitle="Link your doctor so they can follow your health" onPress={() => router.push('/(patient)/my-doctor' as any)} />
          <ListRow icon="calendar-outline" title="Appointments" subtitle="Ask your doctor for a time and see answers" onPress={() => router.push('/(patient)/doctor-appointments' as any)} />
          <ListRow icon="document-text-outline" title="From my doctor" subtitle="Prescribed medicines and notes shared with you" onPress={() => router.push('/(patient)/doctor-care' as any)} />
          <ListRow icon="people-outline" title="Care team" subtitle="Caregivers and doctors connected to you" onPress={() => router.push('/(patient)/caregivers' as any)} />
          <ListRow icon="reader-outline" title="Care log" subtitle="Notes your caregivers share with you" onPress={() => router.push({ pathname: '/(patient)/care-log', params: { patientId: String(user?.id || '') } } as any)} />
          <ListRow icon="watch-outline" title="Connected devices" subtitle="Apple Health and wearable sources" onPress={() => router.push('/(patient)/devices' as any)} />
          <ListRow icon="call-outline" title="Emergency contacts" subtitle="People to contact if you need help" onPress={() => router.push('/(patient)/emergency-contacts' as any)} />
          <ListRow icon="happy-outline" title="Wellbeing check-in" subtitle="Mood and stress, private to you" onPress={() => router.push('/(patient)/wellbeing' as any)} />
        </Card>
      </Section>

      <Section title="Preferences and privacy">
        <Card>
          <ListRow icon="create-outline" title="Edit profile" subtitle="Update your personal information" onPress={() => router.push('/(patient)/profile-setup' as any)} />
          <ListRow icon="flag-outline" title="Goals and habits" subtitle="Set routines and health preferences" onPress={() => router.push('/(patient)/behavior' as any)} />
          <ListRow icon="notifications-outline" title="Notifications" subtitle="Choose how HEWAL3 keeps you informed" onPress={() => router.push('/(patient)/notification-settings' as any)} />
          <ListRow icon="lock-closed-outline" title="Privacy centre" subtitle="Who can see your data, download it or delete it" onPress={() => router.push('/(patient)/privacy-center' as any)} />
          <ListRow icon="shield-checkmark-outline" title="Privacy and data" subtitle="Review permissions and manage your data" onPress={() => router.push('/(patient)/privacy' as any)} />
          <ListRow icon="key-outline" title="Change password" onPress={() => router.push('/(auth)/change-password' as any)} />
        </Card>
      </Section>

      <Section title="Support">
        <Card>
          <ListRow icon="help-circle-outline" title="Help and support" onPress={() => router.push('/(patient)/help' as any)} />
          <ListRow icon="information-circle-outline" title="About HEWAL3" subtitle="Version 3.0.0" onPress={() => router.push('/(patient)/about' as any)} />
        </Card>
      </Section>

      <Card onPress={signOut} tone="danger" style={{ marginTop: 24, marginBottom: 20 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Ionicons name="log-out-outline" size={21} color={C.danger} />
          <T v="bodyStrong" color={C.danger}>Sign out</T>
        </View>
      </Card>
    </Screen>
  );
}
