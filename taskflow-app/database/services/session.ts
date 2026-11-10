// Controla o comportamento da sessão
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { clearSession, getSession, type AuthUser } from '../api/client';
import { db } from '../schemas';

export async function getCurrentSession() {
    return getSession();
}

export async function logout() {
    // Sem isso o Google entraria de novo na mesma conta sem perguntar
    await GoogleSignin.signOut().catch(() => {});
    await clearSession();
}

export function saveLocalUser(user: AuthUser) {
    db.runSync(
        `
            INSERT OR REPLACE INTO users
            (id, email, display_name, avatar_url)
            VALUES (?, ?, ?, ?)
        `,
        user.id,
        user.email ?? null,
        user.displayName ?? null,
        user.avatarUrl ?? null
    );
}
