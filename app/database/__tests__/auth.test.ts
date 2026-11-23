// TDD do login com Google direto na API Spring (sem Supabase): Google nativo → idToken → POST /auth/google

import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { userAuthentication } from '../services/auth';
import { loginWithGoogle } from '../api/client';
import { saveLocalUser } from '../services/session';

jest.mock('@react-native-google-signin/google-signin', () => ({
    GoogleSignin: {
        configure: jest.fn(),
        hasPlayServices: jest.fn(),
        signIn: jest.fn(),
    },
    isSuccessResponse: (r: any) => r.type === 'success',
}));

jest.mock('../api/client', () => ({ loginWithGoogle: jest.fn() }));
jest.mock('../services/session', () => ({ saveLocalUser: jest.fn() }));

const google = GoogleSignin as jest.Mocked<typeof GoogleSignin>;
const login = loginWithGoogle as jest.Mock;

const usuario = { id: '7', email: 'ana@gmail.com', displayName: 'Ana', avatarUrl: 'http://img' };

beforeEach(() => {
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = 'web-client';
    process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = 'ios-client';
    google.hasPlayServices.mockResolvedValue(true);
    google.signIn.mockResolvedValue({ type: 'success', data: { idToken: 'google-id-token' } } as any);
    login.mockResolvedValue(usuario);
});

describe('userAuthentication', () => {
    it('Configura o Google com o client id Web (é ele que vira o aud do idToken)', async () => {
        await userAuthentication();

        expect(google.configure).toHaveBeenCalledWith({ webClientId: 'web-client', iosClientId: 'ios-client' });
    });

    it('Manda o idToken do Google para a API e devolve o usuário da API', async () => {
        const user = await userAuthentication();

        expect(login).toHaveBeenCalledWith('google-id-token');
        expect(user).toEqual(usuario);
    });

    it('Salva o usuário localmente uma única vez', async () => {
        await userAuthentication();

        expect(saveLocalUser).toHaveBeenCalledTimes(1);
        expect(saveLocalUser).toHaveBeenCalledWith(usuario);
    });

    it('Retorna null quando o usuário cancela, sem chamar a API', async () => {
        google.signIn.mockResolvedValue({ type: 'cancelled', data: null } as any);

        expect(await userAuthentication()).toBeNull();
        expect(login).not.toHaveBeenCalled();
    });

    it('Lança erro claro quando o Google não devolve o idToken', async () => {
        google.signIn.mockResolvedValue({ type: 'success', data: { idToken: null } } as any);

        await expect(userAuthentication()).rejects.toThrow('idToken');
        expect(login).not.toHaveBeenCalled();
    });

    it('Lança erro claro sem EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, sem abrir o Google', async () => {
        delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

        await expect(userAuthentication()).rejects.toThrow('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
        expect(google.signIn).not.toHaveBeenCalled();
    });

    it('Propaga a recusa da API e não salva o usuário', async () => {
        login.mockRejectedValue(new Error('API respondeu 401'));

        await expect(userAuthentication()).rejects.toThrow('401');
        expect(saveLocalUser).not.toHaveBeenCalled();
    });
});
