import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../supabase/supabase';
import { saveLocalUser } from './session';

WebBrowser.maybeCompleteAuthSession();

export async function userAuthentication() {
    
    const redirectUri = makeRedirectUri({
        scheme: 'taskflow',
        path: 'auth/callback',
    });

    console.log('Redirect URI:', redirectUri);

    const {data: {session}} = await supabase.auth.getSession();
    if(session) {
        console.log("Sessão encontrada:", session);
        return session.user;
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

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
        console.error("Erro ao fazer a autenticação:", userError);
        throw userError;
    }

    if (!user) {
        throw new Error("Não foi possível retornar o usuário após autenticação.");
    }

    await saveLocalUser(user);

    if (user) {
        saveLocalUser(user);
        const { error: profileError } = await supabase
            .from('users')
            .upsert({
                id: user.id,
                email: user.email,
                display_name: user.user_metadata?.full_name,
                avatar_url: user.user_metadata?.avatar_url,
            });

        if (profileError) {
            throw profileError;
        }

    }

    return user;
}