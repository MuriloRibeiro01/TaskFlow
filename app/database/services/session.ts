// Controla o comportamento da sessão
import { clearSession, getSession, type AuthUser } from '../api/client';
import { db } from '../schemas';

export async function getCurrentSession() {
    return getSession();
}

export async function logout() {
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
