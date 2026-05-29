// Apenas abre o login com Google

import { makeRedirectUri } from 'expo-auth-session';
import { supabase } from '../supabase/supabase';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { getCurrentSession } from './session';

export async function userAuthentication() {

    // Gera URI de redirecionamento
    const redirectUri = makeRedirectUri({
        scheme: 'taskflow',
        path: 'auth/callback',
    });

    // Chama o signin no Supabase para obter a URL do OAuth
    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: redirectUri,
            skipBrowserRedirect: true,
        },
    });

    if (error) throw error;

    if (!data?.url) throw new Error('OAuth URL não encontrada');

    // Abre o browser nativo com a URL do Google
    const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUri,
    );

    console.log('Resultado do browser: ', result.type);

    // Usuário cancelou ou fechou o browser — não é erro
    if (result.type !== 'success') {
        console.log('Login cancelado pelo usuário');
        return;
    }

    if (!result.url) {
        throw new Error('URL de callback não recebida');
    }

    // Extrai o code da URL de retorno
    const parsed = Linking.parse(result.url);
    const code = parsed.queryParams?.code;

    if (typeof code !== 'string' || !code) {
        throw new Error('Code PKCE inválido ou ausente na URL de callback');
    }

    // Troca o code por uma sessão real
    const { error: sessionError } = await supabase.auth.exchangeCodeForSession(code);

    if (sessionError) throw sessionError;

    const session = await getCurrentSession();

    console.log('Usuário autenticado: ', session?.user?.email);
}