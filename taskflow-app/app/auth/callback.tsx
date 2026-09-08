// app/auth/callback.tsx
import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { supabase } from '@/database/supabase/supabase';

export default function AuthCallback() {
    useEffect(() => {
        const handleCallback = async () => {
            try {
                // ✅ FORÇAR O SUPABASE A BUSCAR A SESSÃO
                const { data: { session }, error } = await supabase.auth.getSession();
                
                if (error) {
                    console.error('❌ Session error:', error);
                    router.replace('/login');
                    return;
                }

                if (session?.user) {
                    console.log('✅ User authenticated:', session.user.email);
                    router.replace('/(tabs)');
                } else {
                    console.log('❌ No session found');
                    router.replace('/login');
                }
            } catch (error) {
                console.error('❌ Callback error:', error);
                router.replace('/login');
            }
        };

        handleCallback();
    }, []);

    return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
            <ActivityIndicator size="large" color="#007AFF" />
        </View>
    );
}