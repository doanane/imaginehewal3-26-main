import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import api from '../../services/api';
import { Ionicons, ScrollView, Text, TouchableOpacity, View } from '../../components/themed';

interface EmergencyContact {
  id: number;
  name: string;
  phone: string;
  relationship: string;
}

interface AddContactPayload {
  name: string;
  phone: string;
  relationship: string;
}

export default function EmergencyContactsScreen() {
  const router = useRouter();
  const [contacts, setContacts] = useState<EmergencyContact[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const response = await api.getEmergencyContacts() as { contacts?: EmergencyContact[] };
      setContacts(response.contacts || []);
    } catch (error) {
      console.error('Error loading contacts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddContact = () => {
    Alert.prompt(
      'Add Emergency Contact',
      'Enter name and phone number (format: Name, Phone)',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Add', 
          onPress: async (text?: string) => {
            if (text) {
              const parts = text.split(',').map((item: string) => item.trim());
              const name = parts[0];
              const phone = parts[1];
              if (name && phone) {
                try {
                  const payload: AddContactPayload = { name, phone, relationship: 'Emergency Contact' };
                  await api.addEmergencyContact(payload);
                  Alert.alert('Success', 'Contact added successfully');
                  loadContacts();
                } catch (error) {
                  Alert.alert('Error', 'Failed to add contact');
                }
              } else {
                Alert.alert('Error', 'Please enter both name and phone number');
              }
            }
          }
        }
      ]
    );
  };

  const handleDeleteContact = (contactId: number) => {
    Alert.alert(
      'Delete Contact',
      'Are you sure you want to delete this contact?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            try {
              await api.deleteEmergencyContact(contactId);
              setContacts(contacts.filter(c => c.id !== contactId));
            } catch (error) {
              Alert.alert('Error', 'Failed to delete contact');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.title}>Emergency Contacts</Text>
        <TouchableOpacity onPress={handleAddContact}>
          <Ionicons name="add" size={24} color="#007bff" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {contacts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No emergency contacts added</Text>
            <Text style={styles.emptySubtext}>Add contacts for emergency situations</Text>
          </View>
        ) : (
          contacts.map((contact) => (
            <View key={contact.id} style={styles.contactCard}>
              <View style={styles.contactIcon}>
                <Ionicons name="person" size={24} color="#007bff" />
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactName}>{contact.name}</Text>
                <Text style={styles.contactPhone}>{contact.phone}</Text>
                <Text style={styles.contactRelation}>{contact.relationship}</Text>
              </View>
              <TouchableOpacity 
                style={styles.deleteButton}
                onPress={() => handleDeleteContact(contact.id)}
              >
                <Ionicons name="trash-outline" size={20} color="#ef4444" />
              </TouchableOpacity>
            </View>
          ))
        )}
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
  content: {
    flex: 1,
    padding: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f0f7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  contactInfo: {
    flex: 1,
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  contactPhone: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  contactRelation: {
    fontSize: 12,
    color: '#999',
  },
  deleteButton: {
    padding: 8,
  },
});