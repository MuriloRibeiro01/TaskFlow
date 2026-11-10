// Login com Google direto na API Spring: o Google nativo devolve o ID token e a API troca pelo JWT dela.
import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import { loginWithGoogle, type AuthUser } from '../api/client';
import { saveLocalUser } from './session';

let configured = false;

function configure() {
    const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
    if (!webClientId) throw new Error('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID não definido');
    if (configured) return;
    // O idToken sai com aud = webClientId (no iOS, o iosClientId): a API precisa aceitar esses dois.
    GoogleSignin.configure({ webClientId, iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID });
    configured = true;
}

export async function userAuthentication(): Promise<AuthUser | null> {
    configure();
    await GoogleSignin.hasPlayServices();

    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) {
        return null;
    }

    const { idToken } = response.data;
    if (!idToken) {
        throw new Error('O Google não devolveu o idToken (confira EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).');
    }

    const user = await loginWithGoogle(idToken);
    saveLocalUser(user);
    return user;
}
