// Controla o comportamento da sessão
import { supabase } from '../supabase/supabase';
import { resetApiToken } from '../api/client';
import { db } from '../schemas';
import type { User } from '@supabase/supabase-js';

export async function getCurrentSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
}

export async function logout() {
    await supabase.auth.signOut();
    resetApiToken();
}

export async function saveLocalUser(user: User) {
    db.runSync(
        `
            INSERT OR REPLACE INTO users
            (id, email, display_name, avatar_url)
            VALUES (?, ?, ?, ?)
        `,
        user.id,
        user.email ?? null,
        user.user_metadata?.full_name ?? null,
        user.user_metadata?.avatar_url ?? null
    );
}
