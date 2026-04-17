import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import supabase from '@/database/supabase/supabase';

import { initDatabase } from '@/database/schemas';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useEffect } from 'react';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Inicia o db
  useEffect(() => {
    initDatabase();

    const inserirDado = async () => {
      const { data, error } = await supabase
        .from('users')
        .insert([{ email: 'murilo.email@email.com',  }])
        .select()

        console.log('DATA', data);
        console.log('ERROR', error);

      const { data: users } = await supabase
        .from('users')
        .select()

        console.log('TODOS', users);
    }

    inserirDado();

  }, []);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen name="test-auth" options={{ title: 'Teste Auth' }} /> {/* ← temporário */}
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
