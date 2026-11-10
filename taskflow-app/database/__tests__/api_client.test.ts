// TDD do cliente HTTP da API Spring: login com o ID token do Google, sessão salva no aparelho e 401 encerra a sessão

import { chunkedSecureStorage } from '../api/secure_storage';
import {
    api,
    ApiError,
    clearSession,
    getSession,
    loginWithGoogle,
    onSessionExpired,
    resetSessionCache,
} from '../api/client';

jest.mock('../api/secure_storage', () => ({
    chunkedSecureStorage: { getItem: jest.fn(), setItem: jest.fn(), removeItem: jest.fn() },
}));

const storage = chunkedSecureStorage as jest.Mocked<typeof chunkedSecureStorage>;
const fetchMock = jest.fn();

const resposta = (status: number, body?: unknown) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
});

const usuarioApi = { id: 7, email: 'ana@gmail.com', displayName: 'Ana', avatarUrl: 'http://img' };
const sessaoSalva = JSON.stringify({
    accessToken: 'api-token',
    user: { id: '7', email: 'ana@gmail.com', displayName: 'Ana', avatarUrl: 'http://img' },
});

beforeEach(() => {
    jest.resetAllMocks();
    resetSessionCache();
    process.env.EXPO_PUBLIC_API_URL = 'http://api';
    (global as any).fetch = fetchMock;
    storage.getItem.mockResolvedValue(null);
});

describe('loginWithGoogle', () => {
    it('Troca o ID token do Google pelo JWT da API e salva a sessão', async () => {
        fetchMock.mockResolvedValueOnce(resposta(200, { accessToken: 'api-token', user: usuarioApi }));

        const user = await loginWithGoogle('google-id-token');

        expect(fetchMock).toHaveBeenCalledWith('http://api/auth/google', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ idToken: 'google-id-token' }),
        }));
        // id em texto: é o que as tarefas locais guardam em user_id
        expect(user).toEqual({ id: '7', email: 'ana@gmail.com', displayName: 'Ana', avatarUrl: 'http://img' });
        expect(storage.setItem).toHaveBeenCalledWith('taskflow.session', sessaoSalva);
    });

    it('Lança ApiError quando a API recusa o token, sem salvar nada', async () => {
        fetchMock.mockResolvedValueOnce(resposta(401));

        await expect(loginWithGoogle('ruim')).rejects.toMatchObject({ status: 401 });
        expect(storage.setItem).not.toHaveBeenCalled();
    });
});

describe('getSession', () => {
    it('Lê a sessão salva no aparelho (funciona offline) e só lê uma vez', async () => {
        storage.getItem.mockResolvedValue(sessaoSalva);

        expect((await getSession())?.user.id).toBe('7');
        await getSession();

        expect(storage.getItem).toHaveBeenCalledTimes(1);
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('Devolve null sem sessão salva ou com valor corrompido', async () => {
        expect(await getSession()).toBeNull();

        resetSessionCache();
        storage.getItem.mockResolvedValue('{nao e json');
        expect(await getSession()).toBeNull();
    });
});

describe('api', () => {
    it('Usa o token da sessão salva nas chamadas', async () => {
        storage.getItem.mockResolvedValue(sessaoSalva);
        fetchMock.mockResolvedValueOnce(resposta(200, [{ id: 1 }]));

        await expect(api('GET', '/tasks')).resolves.toEqual([{ id: 1 }]);
        expect(fetchMock.mock.calls[0][0]).toBe('http://api/tasks');
        expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer api-token');
    });

    it('Envia o corpo como JSON e trata 204 sem corpo', async () => {
        storage.getItem.mockResolvedValue(sessaoSalva);
        fetchMock.mockResolvedValueOnce(resposta(204));

        await expect(api('DELETE', '/tasks/1')).resolves.toBeUndefined();

        fetchMock.mockResolvedValueOnce(resposta(201, { id: 5 }));
        await api('POST', '/tasks', { title: 'x' });
        const [, init] = fetchMock.mock.calls[1];
        expect(init.body).toBe('{"title":"x"}');
        expect(init.headers['Content-Type']).toBe('application/json');
    });

    it('Lança ApiError com o status quando a API recusa', async () => {
        storage.getItem.mockResolvedValue(sessaoSalva);
        fetchMock.mockResolvedValue(resposta(404));

        await expect(api('GET', '/tasks/9')).rejects.toMatchObject({ status: 404 });
        await expect(api('GET', '/tasks/9')).rejects.toBeInstanceOf(ApiError);
    });

    it('Sem sessão falha com 401, sem chamar a rede', async () => {
        await expect(api('GET', '/tasks')).rejects.toMatchObject({ status: 401 });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('No 401 apaga a sessão e avisa quem escuta (o app volta para o login)', async () => {
        storage.getItem.mockResolvedValue(sessaoSalva);
        fetchMock.mockResolvedValueOnce(resposta(401));
        const expired = jest.fn();
        const unsubscribe = onSessionExpired(expired);

        await expect(api('GET', '/tasks')).rejects.toMatchObject({ status: 401 });

        expect(storage.removeItem).toHaveBeenCalledWith('taskflow.session');
        expect(expired).toHaveBeenCalledTimes(1);
        expect(await getSession()).toBeNull();
        unsubscribe();
    });

    it('Falha com mensagem clara quando EXPO_PUBLIC_API_URL não está definido', async () => {
        storage.getItem.mockResolvedValue(sessaoSalva);
        delete process.env.EXPO_PUBLIC_API_URL;

        await expect(api('GET', '/tasks')).rejects.toThrow('EXPO_PUBLIC_API_URL');
    });
});

describe('clearSession', () => {
    it('Apaga a sessão do aparelho sem disparar o aviso de expiração', async () => {
        storage.getItem.mockResolvedValue(sessaoSalva);
        const expired = jest.fn();
        const unsubscribe = onSessionExpired(expired);

        await clearSession();

        expect(storage.removeItem).toHaveBeenCalledWith('taskflow.session');
        expect(await getSession()).toBeNull();
        expect(expired).not.toHaveBeenCalled();
        unsubscribe();
    });
});
