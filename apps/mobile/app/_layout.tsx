import { Stack } from "expo-router/stack";

export default function Layout() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen name="index" options={{ title: "Allô Maude" }} />
      <Stack.Screen name="calls" options={{ title: "Appels" }} />
      <Stack.Screen name="follow-up" options={{ title: "À suivre" }} />
      <Stack.Screen name="privacy" options={{ title: "Confidentialité" }} />
    </Stack>
  );
}
