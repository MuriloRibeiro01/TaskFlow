// TDD do cliente HTTP da API Spring: troca o token do Supabase pelo da API e renova no 401

import { supabase } from '../supabase/supabase';
import { api, ApiError, resetApiToken } from '../api/client';

jest.mock('../supabase/supabase', () => ({
    supabase: { auth: { getSession: jest.fn() } },
}));

const getSession = supabase.auth.getSession as jest.Mock;
const fetchMock = jest.fn();

const resposta = (status: number, body?: unknown) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
});

beforeEach(() => {
    jest.resetAllMocks();
    resetApiToken();
    process.env.EXPO_PUBLIC_API_URL = 'http://api';
    (global as any).fetch = fetchMock;
    getSession.mockResolvedValue({ data: { session: { access_token: 'sb-token' } } });
});

describe('api', () => {
    it('Troca o token do Supabase pelo da API e usa nas chamadas', async () => {
        fetchMock
            .mockResolvedValueOnce(resposta(200, { accessToken: 'api-token' }))
            .mockResolvedValueOnce(resposta(200, [{ id: 1 }]));

        const result = await api('GET', '/tasks');

        expect(result).toEqual([{ id: 1 }]);
        expect(fetchMock).toHaveBeenNthCalledWith(1, 'http://api/auth/supabase-login', expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({ accessToken: 'sb-token' }),
        }));
        expect(fetchMock.mock.calls[1][1].headers.Authorization).toBe('Bearer api-token');
    });

    it('Reaproveita o token: só faz login uma vez', async () => {
        fetchMock
            .mockResolvedValueOnce(resposta(200, { accessToken: 'api-token' }))
            .mockResolvedValue(resposta(200, []));

        await api('GET', '/tasks');
        await api('GET', '/sessions');

        expect(fetchMock.mock.calls.filter(c => String(c[0]).includes('supabase-login'))).toHaveLength(1);
    });

    it('No 401 renova o token e repete a chamada uma vez', async () => {
        fetchMock
            .mockResolvedValueOnce(resposta(200, { accessToken: 'velho' }))
            .mockResolvedValueOnce(resposta(401))
            .mockResolvedValueOnce(resposta(200, { accessToken: 'novo' }))
            .mockResolvedValueOnce(resposta(200, []));

        await expect(api('GET', '/tasks')).resolves.toEqual([]);
        expect(fetchMock.mock.calls[3][1].headers.Authorization).toBe('Bearer novo');
    });

    it('Envia o corpo como JSON e trata 204 sem corpo', async () => {
        fetchMock
            .mockResolvedValueOnce(resposta(200, { accessToken: 't' }))
            .mockResolvedValueOnce(resposta(204));

        await expect(api('DELETE', '/tasks/1')).resolves.toBeUndefined();

        fetchMock.mockResolvedValueOnce(resposta(201, { id: 5 }));
        await api('POST', '/tasks', { title: 'x' });
        const [, init] = fetchMock.mock.calls[2];
        expect(init.body).toBe('{"title":"x"}');
        expect(init.headers['Content-Type']).toBe('application/json');
    });

    it('Lança ApiError com o status quando a API recusa', async () => {
        fetchMock
            .mockResolvedValueOnce(resposta(200, { accessToken: 't' }))
            .mockResolvedValue(resposta(404));

        await expect(api('GET', '/tasks/9')).rejects.toMatchObject({ status: 404 });
        await expect(api('GET', '/tasks/9')).rejects.toBeInstanceOf(ApiError);
    });

    it('Falha sem sessão do Supabase, sem chamar a rede', async () => {
        getSession.mockResolvedValue({ data: { session: null } });

        await expect(api('GET', '/tasks')).rejects.toMatchObject({ status: 401 });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('Falha com mensagem clara quando EXPO_PUBLIC_API_URL não está definido', async () => {
        delete process.env.EXPO_PUBLIC_API_URL;

        await expect(api('GET', '/tasks')).rejects.toThrow('EXPO_PUBLIC_API_URL');
    });
});
