import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../supabase/supabase';
import { saveLocalUser } from './session';

WebBrowser.maybeCompleteAuthSession();

// Lê os parâmetros do redirect OAuth, tanto da query (?code=...) quanto do fragmento (#error=...)
export function extractAuthParams(url: string): Record<string, string> {
    const params: Record<string, string> = {};
    const [semFragmento, fragmento] = url.split('#');
    const query = semFragmento.split('?')[1];

    for (const parte of [query, fragmento]) {
        if (!parte) continue;
        new URLSearchParams(parte).forEach((valor, chave) => {
            params[chave] = valor;
        });
    }

    return params;
}

export async function userAuthentication() {

    const redirectUri = makeRedirectUri({
        scheme: 'taskflow',
        path: 'auth/callback',
    });

    const { data: { session: sessaoAtual } } = await supabase.auth.getSession();
    if (sessaoAtual) {
        return sessaoAtual.user;
    }

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: redirectUri,
            skipBrowserRedirect: true,
        },
    });

    if (error) {
        throw error;
    }

    if (!data.url) {
        throw new Error('URL de autenticação não foi gerada.');
    }

    const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUri,
        {
            preferEphemeralSession: false,
            createTask: true,
        }
    );

    if (result.type !== 'success') {
        return null;
    }

    const params = extractAuthParams(result.url);

    if (params.error) {
        throw new Error(params.error_description ?? params.error);
    }

    if (!params.code) {
        throw new Error('Código de autenticação ausente no retorno do OAuth.');
    }

    // Fluxo PKCE: troca o code pela sessão (usa o code_verifier salvo no signInWithOAuth)
    const {
        data: { session },
        error: exchangeError,
    } = await supabase.auth.exchangeCodeForSession(params.code);

    if (exchangeError) {
        throw exchangeError;
    }

    if (!session) {
        throw new Error('Não foi possível criar a sessão após autenticação.');
    }

    const user = session.user;

    await saveLocalUser(user);

    // O perfil é complementar: se o upsert falhar, a sessão continua válida
    const { error: profileError } = await supabase
        .from('users')
        .upsert({
            id: user.id,
            email: user.email,
            display_name: user.user_metadata?.full_name,
            avatar_url: user.user_metadata?.avatar_url,
        });

    if (profileError) {
        console.error('Erro ao salvar o perfil do usuário:', profileError);
    }

    return user;
}
