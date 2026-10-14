// Define como salvar a sessão

import { createClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';
import { chunkedSecureStorage } from './secure_storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        // Sessão criptografada no SecureStore, dividida em pedaços (limite de ~2048 bytes por valor)
        storage: chunkedSecureStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
        flowType: 'pkce', // Necessário para exchangeCodeForSession funcionar
    },
});

// Só renova o token com o app em primeiro plano (recomendação do Supabase para React Native)
AppState.addEventListener('change', (state) => {
    if (state === 'active') {
        supabase.auth.startAutoRefresh();
    } else {
        supabase.auth.stopAutoRefresh();
    }
});
