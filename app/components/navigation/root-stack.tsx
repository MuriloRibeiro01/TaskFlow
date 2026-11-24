// Pilha de telas do app. Sem sessão só existe a tela de login; com sessão, o resto do app.
// O Stack.Protected bloqueia as rotas de fato: quando o guard muda (login, "Sair", sessão
// expirada), o expo-router redireciona sozinho para a primeira tela disponível.
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import { useAuth } from '@/database/context/auth_context';

export function RootStack() {
  const { user, isLoading } = useAuth();

  // Enquanto lê a sessão salva no aparelho: sem isso a tela de login piscaria para quem já entrou
  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F5F2EC' }}>
        <ActivityIndicator size="large" color="#D63B2F" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
      <Stack.Protected guard={!!user}>
        <Stack.Screen name="(tabs)" options={{ animation: 'none' }} />
        <Stack.Screen name="nova-tarefa" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="historico" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="estatisticas" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="priorizar" options={{ animation: 'slide_from_bottom' }} />
      </Stack.Protected>
      <Stack.Protected guard={!user}>
        <Stack.Screen name="login" options={{ animation: 'none' }} />
      </Stack.Protected>
    </Stack>
  );
}
