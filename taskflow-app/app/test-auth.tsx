import { Button, View, Text, ActivityIndicator } from 'react-native';
import { userAuthentication } from '@/database/services/auth';
import { logout } from '@/database/services/session';
import { useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '@/database/supabase/supabase';
import * as WebBrowser from 'expo-web-browser';

// Necessário aqui: finaliza a sessão de browser quando o app volta do callback OAuth
WebBrowser.maybeCompleteAuthSession();

export default function TestAuth() {

    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Listener de mudança de sessão — atualiza o estado automaticamente após login
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
            console.log('Auth event:', event);
            setSession(session);
        });

        return () => {
            subscription.unsubscribe();
        };

    }, []);

    async function handleLogin() {
        setLoading(true);
        setError(null);
        try {
            await userAuthentication();
        } catch (err: any) {
            console.error('Erro no login:', err);
            setError(err?.message ?? 'Erro desconhecido');
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 12 }}>

            {session ? (
                <View>
                    <Text style={{ fontSize: 16, fontWeight: 'bold', textAlign: 'center' }}>
                        ✅ Conectado como:
                    </Text>
                    <Text style={{ textAlign: 'center', marginTop: 4 }}>
                        {session.user?.email}
                    </Text>
                </View>
            ) : (
                <Text style={{ textAlign: 'center', color: '#666' }}>
                    Não autenticado
                </Text>
            )}

            {error && (
                <Text style={{ color: 'red', textAlign: 'center', fontSize: 12 }}>
                    Erro: {error}
                </Text>
            )}

            {loading && <ActivityIndicator />}

            <Button
                title="Testar Login"
                onPress={handleLogin}
                disabled={loading}
            />
            <Button title="Logout" onPress={logout} disabled={loading} />
        </View>
    );
}