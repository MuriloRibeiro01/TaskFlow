import { makeRedirectUri } from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import supabase from '../supabase/supabase';

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

    if (error) throw error;

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectUri);

    if (result.type === 'success') {
        const { data: sessionData } = await supabase.auth.getSession();
        console.log('Usuário logado:', sessionData.session?.user?.email);
        return sessionData.session;
    }

}