// Controla o comportamento da sessão

import 'react-native-url-polyfill/auto';
import { supabase } from '../supabase/supabase';

export async function getCurrentSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
}

export async function logout() {
    await supabase.auth.signOut();
}