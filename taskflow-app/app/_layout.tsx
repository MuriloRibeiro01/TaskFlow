import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import {
  BarlowCondensed_600SemiBold,
  BarlowCondensed_700Bold,
  BarlowCondensed_900Black_Italic,
} from '@expo-google-fonts/barlow-condensed';
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { supabase } from '@/database/supabase/supabase';

import { initDatabase } from '@/database/schemas';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useEffect } from 'react';

export const unstable_settings = {
  anchor: '(tabs)',
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    BarlowCondensed_700Bold,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_900Black_Italic,
    IBMPlexMono_400Regular,
  });

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

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="nova-tarefa"
          options={{ headerShown: false }}
        />
      </Stack>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
