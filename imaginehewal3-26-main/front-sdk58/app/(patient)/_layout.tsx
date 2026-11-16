import { Stack } from "expo-router";

export default function PatientLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="thread" />
      <Stack.Screen name="messages" />
      <Stack.Screen name="medications" />
      <Stack.Screen name="wellbeing" />
      <Stack.Screen name="privacy-center" />
      <Stack.Screen name="emergency" options={{ gestureEnabled: false }} />
      <Stack.Screen name="home" />
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="health" />
      <Stack.Screen name="nutrition" />
      <Stack.Screen name="fitness" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="privacy" />
      <Stack.Screen name="about" />
      <Stack.Screen name="devices" />
      <Stack.Screen name="leaderboard" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="caregivers" />
      <Stack.Screen name="signup" />
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" />
      <Stack.Screen name="profile-setup" />
      <Stack.Screen name="action-menu" />
      <Stack.Screen name="chat" />
      <Stack.Screen name="payment" />
      <Stack.Screen name="behavior" />
      <Stack.Screen name="activity" />
      <Stack.Screen name="my-doctor" />
      <Stack.Screen name="demo" />
    </Stack>
  );
}