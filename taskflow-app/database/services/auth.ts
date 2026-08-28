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

    const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
            redirectTo: redirectUri,
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
        redirectUri
    );

    if (result.type !== 'success') {
        return null;
    }

    const {
        data: { user },
        error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
        throw userError;
    }

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