// Cliente HTTP da API Spring. O login é com Google direto na API: o ID token do Google vira o JWT da API.
import { chunkedSecureStorage } from './secure_storage';

export class ApiError extends Error {
    constructor(public status: number, message?: string) {
        super(message ?? `API respondeu ${status}`);
    }
}

// id em texto: é o que as tarefas locais guardam em user_id
export interface AuthUser {
    id: string;
    email: string;
    displayName: string | null;
    avatarUrl: string | null;
}

export interface Session {
    accessToken: string;
    user: AuthUser;
}

const SESSION_KEY = 'taskflow.session';

// undefined = ainda não leu o SecureStore; null = sem sessão
let session: Session | null | undefined;
const expiredListeners = new Set<() => void>();

export function resetSessionCache() {
    session = undefined;
}

function baseUrl() {
    const url = process.env.EXPO_PUBLIC_API_URL;
    if (!url) throw new Error('EXPO_PUBLIC_API_URL não definido');
    return url;
}

// Sessão salva no aparelho: abre o app logado mesmo offline.
export async function getSession(): Promise<Session | null> {
    if (session !== undefined) return session;
    try {
        const raw = await chunkedSecureStorage.getItem(SESSION_KEY);
        session = raw ? JSON.parse(raw) : null;
    } catch {
        session = null;
    }
    return session ?? null;
}

export async function clearSession() {
    session = null;
    await chunkedSecureStorage.removeItem(SESSION_KEY);
}

// Avisado quando a API recusa o token (expirado ou revogado): o app volta para o login.
export function onSessionExpired(listener: () => void) {
    expiredListeners.add(listener);
    return () => { expiredListeners.delete(listener); };
}

export async function loginWithGoogle(idToken: string): Promise<AuthUser> {
    const res = await fetch(`${baseUrl()}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
    });
    if (!res.ok) throw new ApiError(res.status);

    const { accessToken, user } = await res.json();
    const nova: Session = {
        accessToken,
        user: { id: String(user.id), email: user.email, displayName: user.displayName ?? null, avatarUrl: user.avatarUrl ?? null },
    };
    await chunkedSecureStorage.setItem(SESSION_KEY, JSON.stringify(nova));
    session = nova;
    return nova.user;
}

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
    const atual = await getSession();
    if (!atual) throw new ApiError(401, 'Sem sessão');

    const res = await fetch(`${baseUrl()}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${atual.accessToken}`,
            ...(body !== undefined && { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    if (res.status === 401) {
        // Sem como renovar sozinho (o Google só dá token novo com o usuário na tela): pede login de novo.
        await clearSession();
        expiredListeners.forEach((listener) => listener());
    }
    if (!res.ok) throw new ApiError(res.status);

    return res.status === 204 ? (undefined as T) : res.json();
}
