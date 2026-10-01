// app/_layout.tsx
// Polyfills precisam vir antes de qualquer import que carregue o Supabase
import '@/database/supabase/polyfills';

import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_900Black_Italic,
} from '@expo-google-fonts/barlow-condensed';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans';
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';
import { AuthProvider } from '@/database/context/auth_context';

import { initDatabase } from '@/database/schemas';

initDatabase();

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="nova-tarefa" />
      <Stack.Screen name="auth/callback" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BarlowCondensed_700Bold,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_900Black_Italic,
    DMSans_400Regular,
    IBMPlexMono_400Regular,
  });

  if (!fontsLoaded) return null;

  return (
    <AuthProvider>
      <RootLayoutNav />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
