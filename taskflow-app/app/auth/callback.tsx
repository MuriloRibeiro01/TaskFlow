// app/auth/callback.tsx
// No Android o deep link do OAuth também abre esta rota. A troca do code pela sessão
// acontece em userAuthentication(); aqui só esperamos o usuário aparecer no contexto.
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { useAuth } from '@/database/context/auth_context';

const TIMEOUT_MS = 10000;

export default function AuthCallback() {
    const { user } = useAuth();

    useEffect(() => {
        if (user) {
            router.replace('/(tabs)');
            return;
        }

        // Se o login falhar ou for cancelado, volta para a tela anterior (login)
        const timeout = setTimeout(() => {
            if (router.canGoBack()) {
                router.back();
            } else {
                router.replace('/login');
            }
        }, TIMEOUT_MS);

        return () => clearTimeout(timeout);
    }, [user]);

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#007AFF" />
        </View>
    );
}
