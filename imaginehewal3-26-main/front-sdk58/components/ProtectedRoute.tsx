import React, { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { ActivityIndicator, View } from './themed';

export default function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/(auth)/login');
    }
  }, [isLoading, isAuthenticated]);

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007bff" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}