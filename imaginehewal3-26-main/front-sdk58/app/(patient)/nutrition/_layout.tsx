import { Stack } from "expo-router";

export default function NutritionLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="food-log" />
      <Stack.Screen name="food-details" />
      <Stack.Screen name="log-food" />
      <Stack.Screen name="log-water" />
      <Stack.Screen name="scan-food" />
      <Stack.Screen name="goals" />
    </Stack>
  );
}
