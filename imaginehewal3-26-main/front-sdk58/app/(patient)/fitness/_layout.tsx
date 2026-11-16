// app/(patient)/fitness/_layout.tsx
import { Stack } from "expo-router";

export default function FitnessLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="workouts" />
      <Stack.Screen name="log-workout" />
    </Stack>
  );
}