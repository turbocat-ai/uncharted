import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false, // Fullscreen layout for the map
          contentStyle: { backgroundColor: '#0f172a' },
        }}
      />
    </>
  );
}