// front/app/(caregiver)/_layout.tsx
import { Stack } from "expo-router";

export default function CaregiverLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" /> {/* Main dashboard */}
      <Stack.Screen name="caregiver-home" options={{ headerShown: false }} />
      <Stack.Screen name="messaging" />
      <Stack.Screen name="care-team" />
      <Stack.Screen name="caregiver-profile" />
      <Stack.Screen name="tasks" />
      <Stack.Screen name="medications" />
      <Stack.Screen name="document-library" />
      <Stack.Screen name="care-plan" />
      <Stack.Screen name="patients" />
      <Stack.Screen name="reports" />
      <Stack.Screen name="verify" />
      <Stack.Screen name="vital-monitoring" />
      <Stack.Screen name="schedule" />
      <Stack.Screen name="analytics" />
      <Stack.Screen name="alerts" />
      <Stack.Screen name="patient-detail" />
      
      {/* New Feature Pages */}
      <Stack.Screen name="care-notes" />
      <Stack.Screen name="appointments" />
      <Stack.Screen name="resources" />
      <Stack.Screen name="team-chat" />
    </Stack>
  );
}