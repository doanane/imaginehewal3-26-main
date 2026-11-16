import React from 'react';
import { View, Text } from './themed';
import { useAuth } from '../contexts/AuthContext';

/** Shown on every screen while someone is in the reviewer sandbox, so demo data can never be mistaken for a real patient. */
export default function GuestBanner() {
  const { user } = useAuth();
  if (!user?.email?.toLowerCase().endsWith('@guest.hewal3.local')) return null;
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: '#1F2937', paddingVertical: 6, paddingHorizontal: 12 }}>
      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>Demo mode. Sample data, not a real patient.</Text>
    </View>
  );
}
