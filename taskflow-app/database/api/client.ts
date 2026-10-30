// Cliente HTTP da API Spring. O Supabase só autentica: o token dele é trocado pelo da API.
import { supabase } from '../supabase/supabase';

export class ApiError extends Error {
    constructor(public status: number, message?: string) {
        super(message ?? `API respondeu ${status}`);
    }
}

// Só em memória: se o app fechar, a próxima chamada troca de novo (a sessão do Supabase persiste).
let token: string | null = null;

export function resetApiToken() {
    token = null;
}

function baseUrl() {
    const url = process.env.EXPO_PUBLIC_API_URL;
    if (!url) throw new Error('EXPO_PUBLIC_API_URL não definido');
    return url;
}

async function login() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new ApiError(401, 'Sem sessão do Supabase');

    const res = await fetch(`${baseUrl()}/auth/supabase-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken: session.access_token }),
    });
    if (!res.ok) throw new ApiError(res.status);

    token = (await res.json()).accessToken;
}

function send(method: string, path: string, body?: unknown) {
    return fetch(`${baseUrl()}${path}`, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            ...(body !== undefined && { 'Content-Type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
    if (!token) await login();

    let res = await send(method, path, body);
    if (res.status === 401) {
        // token da API expirado (vale 1 dia): troca de novo e repete uma vez
        await login();
        res = await send(method, path, body);
    }
    if (!res.ok) throw new ApiError(res.status);

    return res.status === 204 ? (undefined as T) : res.json();
}
