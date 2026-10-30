// app/_layout.tsx
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
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from '@/database/context/auth_context';
import { ToastProvider } from '@/components/notifications/Toast';

import { initDatabase } from '@/database/schemas';

initDatabase();

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
      <Stack.Screen name="nova-tarefa" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="historico" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="estatisticas" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="priorizar" options={{ animation: 'slide_from_bottom' }} />
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ToastProvider>
        <AuthProvider>
          <RootLayoutNav />
          <StatusBar style="light" />
        </AuthProvider>
      </ToastProvider>
    </GestureHandlerRootView>
  );
}
