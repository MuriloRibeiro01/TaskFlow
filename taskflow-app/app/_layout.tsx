import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import 'react-native-url-polyfill/auto';
import 'react-native-reanimated';

import '@/database/supabase/polyfills';

import { initDatabase } from '@/database/schemas';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useEffect } from 'react';

// Define âncora principal da navegação.
export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Inicia o db
  useEffect(() => {
    initDatabase();

  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="test-auth" options={{ title: 'Teste Auth' }} />
      </Stack>
    </ThemeProvider>
  );
}
