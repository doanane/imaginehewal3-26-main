import React from 'react';
import {
  StyleSheet,
  Modal,
} from 'react-native';
import { ActivityIndicator, Text, View } from './themed';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
  transparent?: boolean;
}

export default function LoadingOverlay({ 
  visible, 
  message = 'Loading...',
  transparent = false 
}: LoadingOverlayProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent
    >
      <View style={[styles.overlay, transparent && styles.transparent]}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color="#007bff" />
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  transparent: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  message: {
    marginTop: 16,
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
});