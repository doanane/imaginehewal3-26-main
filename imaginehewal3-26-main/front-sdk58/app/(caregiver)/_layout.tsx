import { Stack } from "expo-router";

export default function CaregiverLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="caregiver-home" />
      <Stack.Screen name="patients" />
      <Stack.Screen name="patient-detail" />
      <Stack.Screen name="vital-monitoring" />
      <Stack.Screen name="alerts" />
      <Stack.Screen name="tasks" />
      <Stack.Screen name="appointments" />
      <Stack.Screen name="messaging" />
      <Stack.Screen name="supporting" />
      <Stack.Screen name="caregiver-profile" />
      <Stack.Screen name="verify" />
    </Stack>
  );
}
