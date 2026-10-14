// TDD do fluxo de login OAuth (Google + Supabase PKCE)

import * as WebBrowser from 'expo-web-browser';
import { extractAuthParams, userAuthentication } from '../services/auth';
import { supabase } from '../supabase/supabase';
import { saveLocalUser } from '../services/session';

jest.mock('expo-auth-session', () => ({
    makeRedirectUri: jest.fn().mockReturnValue('taskflow://auth/callback'),
}));

jest.mock('expo-web-browser', () => ({
    maybeCompleteAuthSession: jest.fn(),
    openAuthSessionAsync: jest.fn(),
}));

const mockUpsert = jest.fn();

jest.mock('../supabase/supabase', () => ({
    supabase: {
        auth: {
            getSession: jest.fn(),
            signInWithOAuth: jest.fn(),
            exchangeCodeForSession: jest.fn(),
        },
        from: jest.fn(() => ({ upsert: mockUpsert })),
    },
}));

jest.mock('../services/session', () => ({
    saveLocalUser: jest.fn(),
}));

const auth = supabase.auth as jest.Mocked<typeof supabase.auth>;
const openAuthSession = WebBrowser.openAuthSessionAsync as jest.Mock;

const usuario = {
    id: 'user-123',
    email: 'murilo@teste.com',
    user_metadata: { full_name: 'Murilo', avatar_url: 'https://foto' },
};

beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});

    auth.getSession.mockResolvedValue({ data: { session: null }, error: null } as any);
    auth.signInWithOAuth.mockResolvedValue({
        data: { provider: 'google', url: 'https://supabase/auth/v1/authorize?x=1' },
        error: null,
    } as any);
    auth.exchangeCodeForSession.mockResolvedValue({
        data: { session: { user: usuario }, user: usuario },
        error: null,
    } as any);
    openAuthSession.mockResolvedValue({
        type: 'success',
        url: 'taskflow://auth/callback?code=abc123',
    });
    mockUpsert.mockResolvedValue({ error: null });
});

describe('extractAuthParams', () => {
    it('Lê parâmetros da query string', () => {
        expect(extractAuthParams('taskflow://auth/callback?code=abc123')).toEqual({ code: 'abc123' });
    });

    it('Lê parâmetros do fragmento (#) e decodifica valores', () => {
        expect(
            extractAuthParams('taskflow://auth/callback#error=access_denied&error_description=Usu%C3%A1rio+negou')
        ).toEqual({ error: 'access_denied', error_description: 'Usuário negou' });
    });

    it('Retorna objeto vazio quando não há parâmetros', () => {
        expect(extractAuthParams('taskflow://auth/callback')).toEqual({});
    });
});

describe('userAuthentication', () => {
    it('Retorna o usuário da sessão existente sem abrir o navegador', async () => {
        auth.getSession.mockResolvedValue({ data: { session: { user: usuario } }, error: null } as any);

        const user = await userAuthentication();

        expect(user).toEqual(usuario);
        expect(openAuthSession).not.toHaveBeenCalled();
    });

    it('Inicia o OAuth do Google com o redirect do app, sem redirecionar o navegador sozinho', async () => {
        await userAuthentication();

        expect(auth.signInWithOAuth).toHaveBeenCalledWith({
            provider: 'google',
            options: { redirectTo: 'taskflow://auth/callback', skipBrowserRedirect: true },
        });
        expect(openAuthSession).toHaveBeenCalledWith(
            'https://supabase/auth/v1/authorize?x=1',
            'taskflow://auth/callback',
            expect.any(Object)
        );
    });

    it('Troca o code do PKCE por uma sessão e retorna o usuário', async () => {
        const user = await userAuthentication();

        expect(auth.exchangeCodeForSession).toHaveBeenCalledWith('abc123');
        expect(user).toEqual(usuario);
    });

    it('Salva o usuário localmente uma única vez e faz upsert do perfil', async () => {
        await userAuthentication();

        expect(saveLocalUser).toHaveBeenCalledTimes(1);
        expect(saveLocalUser).toHaveBeenCalledWith(usuario);
        expect(supabase.from).toHaveBeenCalledWith('users');
        expect(mockUpsert).toHaveBeenCalledWith({
            id: 'user-123',
            email: 'murilo@teste.com',
            display_name: 'Murilo',
            avatar_url: 'https://foto',
        });
    });

    it('Retorna null quando o usuário cancela/fecha o navegador', async () => {
        openAuthSession.mockResolvedValue({ type: 'cancel' });

        const user = await userAuthentication();

        expect(user).toBeNull();
        expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    });

    it('Lança o erro devolvido pelo provedor no redirect', async () => {
        openAuthSession.mockResolvedValue({
            type: 'success',
            url: 'taskflow://auth/callback?error=access_denied&error_description=Acesso+negado',
        });

        await expect(userAuthentication()).rejects.toThrow('Acesso negado');
        expect(auth.exchangeCodeForSession).not.toHaveBeenCalled();
    });

    it('Lança erro quando o redirect volta sem code', async () => {
        openAuthSession.mockResolvedValue({ type: 'success', url: 'taskflow://auth/callback' });

        await expect(userAuthentication()).rejects.toThrow('Código de autenticação ausente');
    });

    it('Lança erro quando a troca do code falha', async () => {
        auth.exchangeCodeForSession.mockResolvedValue({
            data: { session: null, user: null },
            error: new Error('invalid grant'),
        } as any);

        await expect(userAuthentication()).rejects.toThrow('invalid grant');
        expect(saveLocalUser).not.toHaveBeenCalled();
    });

    it('Não derruba o login quando o upsert do perfil falha', async () => {
        mockUpsert.mockResolvedValue({ error: { message: 'permission denied for table users' } });

        const user = await userAuthentication();

        expect(user).toEqual(usuario);
    });

    it('Lança erro quando o Supabase não gera a URL de autenticação', async () => {
        auth.signInWithOAuth.mockResolvedValue({ data: { provider: 'google', url: null }, error: null } as any);

        await expect(userAuthentication()).rejects.toThrow('URL de autenticação não foi gerada');
    });
});
