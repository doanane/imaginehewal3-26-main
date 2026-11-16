import { Tabs } from 'expo-router';
import React from 'react';
import ProtectedRoute from '../../../components/ProtectedRoute';
import { useHomeAccessibility } from '../../../components/homeAccessibilityContext';
import TabBar from '../../../components/TabBar';

export default function TabsLayout() {
  const a = useHomeAccessibility();
  const bg = a.mapper ? a.mapper('#F4F7FA', 'bg') : '#F4F7FA';       // the area behind the screens follows light and dark too
  return (
    <ProtectedRoute>
      <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: bg } }} tabBar={(props) => <TabBar {...(props as any)} />}>
        <Tabs.Screen name="today" options={{ title: 'Home' }} />
        <Tabs.Screen name="insights" options={{ title: 'Health' }} />
        <Tabs.Screen name="community" options={{ title: 'Community' }} />
        {/* Care is reached from the Community header, Home and Profile */}
        <Tabs.Screen name="care" options={{ title: 'Care', href: null }} />
        <Tabs.Screen name="assistant" options={{ title: 'Assistant' }} />
        {/* Profile opens from the avatar at the top right, not from the tab bar */}
        <Tabs.Screen name="me" options={{ title: 'Profile', href: null }} />
      </Tabs>
    </ProtectedRoute>
  );
}
