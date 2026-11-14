import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

export default function HelpScreen() {
  const router = useRouter();

  const helpItems = [
    {
      title: 'FAQs',
      icon: 'help-circle-outline',
      onPress: () => Linking.openURL('https://hewal3.com/faq'),
    },
    {
      title: 'Contact Support',
      icon: 'chatbubble-outline',
      onPress: () => Linking.openURL('mailto:support@hewal3.com'),
    },
    {
      title: 'Report a Problem',
      icon: 'bug-outline',
      onPress: () => Linking.openURL('https://hewal3.com/report'),
    },
    {
      title: 'User Guide',
      icon: 'book-outline',
      onPress: () => Linking.openURL('https://hewal3.com/guide'),
    },
    {
      title: 'Privacy Policy',
      icon: 'shield-checkmark-outline',
      onPress: () => Linking.openURL('https://hewal3.com/privacy'),
    },
    {
      title: 'Terms of Service',
      icon: 'document-text-outline',
      onPress: () => Linking.openURL('https://hewal3.com/terms'),
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Help & Support</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.hero}>
          <Ionicons name="help-circle" size={64} color="#007bff" />
          <Text style={styles.heroTitle}>How can we help you?</Text>
          <Text style={styles.heroText}>
            Get answers to your questions and find support resources
          </Text>
        </View>

        <View style={styles.section}>
          {helpItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={styles.helpItem}
              onPress={item.onPress}
            >
              <View style={styles.helpIcon}>
                <Ionicons name={item.icon as any} size={24} color="#007bff" />
              </View>
              <Text style={styles.helpText}>{item.title}</Text>
              <Ionicons name="chevron-forward" size={20} color="#ccc" />
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.contactCard}>
          <Text style={styles.contactTitle}>Need immediate help?</Text>
          <Text style={styles.contactText}>
            Call our support line for urgent assistance
          </Text>
          <TouchableOpacity 
            style={styles.contactButton}
            onPress={() => Linking.openURL('tel:+1234567890')}
          >
            <Ionicons name="call" size={20} color="#fff" />
            <Text style={styles.contactButtonText}>Call Support: +1 (234) 567-890</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  placeholder: {
    width: 24,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  hero: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginTop: 16,
    marginBottom: 8,
  },
  heroText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  helpItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  helpIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  helpText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  contactCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  contactTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a1a1a',
    marginBottom: 8,
  },
  contactText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  contactButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#007bff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 25,
    gap: 8,
  },
  contactButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});