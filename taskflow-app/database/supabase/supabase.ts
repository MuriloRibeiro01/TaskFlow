// Define como salvar a sessão

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// Força o supabase a usar o SecureStore
const secureStoreAdapter = {
    // Lê do armazenamento seguro
    async getItem(key: string): Promise<string | null> {
        return await SecureStore.getItemAsync(key);
    },
    // Salva criptografado
    async setItem(key: string, value: string): Promise<void> {
        await SecureStore.setItemAsync(key, value);
    },
    async removeItem(key: string): Promise<void> {
        await SecureStore.deleteItemAsync(key);
    },
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        storage: secureStoreAdapter, // Onde guardar
        autoRefreshToken: true, // Mantém o usuário logado
        persistSession: true, // Sessão continua mesmo se fechar o app
        detectSessionInUrl: false // Desligar função que só funciona no web
    },
}) ;