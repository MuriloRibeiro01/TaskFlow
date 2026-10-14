// TDD do armazenamento da sessão no SecureStore com divisão em pedaços (limite ~2048 bytes)

import * as SecureStore from 'expo-secure-store';
import { MAX_CHUNK_BYTES, chunkedSecureStorage } from '../supabase/secure_storage';

jest.mock('expo-secure-store', () => {
    const store = new Map<string, string>();
    return {
        __store: store,
        getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
        setItemAsync: jest.fn(async (key: string, value: string) => {
            store.set(key, value);
        }),
        deleteItemAsync: jest.fn(async (key: string) => {
            store.delete(key);
        }),
    };
});

const store: Map<string, string> = (SecureStore as any).__store;

function utf8Bytes(value: string) {
    return Buffer.byteLength(value, 'utf8');
}

beforeEach(() => {
    store.clear();
    jest.clearAllMocks();
});

describe('chunkedSecureStorage', () => {
    it('Salva e lê um valor pequeno', async () => {
        await chunkedSecureStorage.setItem('sb-auth-token', '{"a":1}');

        expect(await chunkedSecureStorage.getItem('sb-auth-token')).toBe('{"a":1}');
    });

    it('Retorna null quando a chave não existe', async () => {
        expect(await chunkedSecureStorage.getItem('inexistente')).toBeNull();
    });

    it('Divide valores grandes em pedaços que respeitam o limite do SecureStore', async () => {
        const sessao = JSON.stringify({ token: 'x'.repeat(5000), nome: 'João Ação 😀'.repeat(200) });

        await chunkedSecureStorage.setItem('sb-auth-token', sessao);

        const valoresGravados = [...store.values()];
        expect(valoresGravados.length).toBeGreaterThan(2);
        for (const valor of valoresGravados) {
            expect(utf8Bytes(valor)).toBeLessThanOrEqual(MAX_CHUNK_BYTES);
        }
        expect(await chunkedSecureStorage.getItem('sb-auth-token')).toBe(sessao);
    });

    it('Usa apenas caracteres permitidos pelo SecureStore nas chaves', async () => {
        await chunkedSecureStorage.setItem('sb-auth-token', 'y'.repeat(6000));

        for (const chave of store.keys()) {
            expect(chave).toMatch(/^[A-Za-z0-9._-]+$/);
        }
    });

    it('Remove pedaços antigos quando o novo valor é menor', async () => {
        await chunkedSecureStorage.setItem('sb-auth-token', 'z'.repeat(6000));
        await chunkedSecureStorage.setItem('sb-auth-token', 'curto');

        expect(await chunkedSecureStorage.getItem('sb-auth-token')).toBe('curto');
        expect(store.size).toBe(2); // contador + 1 pedaço
    });

    it('removeItem apaga todos os pedaços', async () => {
        await chunkedSecureStorage.setItem('sb-auth-token', 'w'.repeat(6000));
        await chunkedSecureStorage.removeItem('sb-auth-token');

        expect(store.size).toBe(0);
        expect(await chunkedSecureStorage.getItem('sb-auth-token')).toBeNull();
    });

    it('Lê sessões antigas salvas sem divisão (compatibilidade)', async () => {
        store.set('sb-auth-token', '{"legado":true}');

        expect(await chunkedSecureStorage.getItem('sb-auth-token')).toBe('{"legado":true}');
    });

    it('Sobrescreve o valor antigo (sem divisão) ao salvar no formato novo', async () => {
        store.set('sb-auth-token', '{"legado":true}');

        await chunkedSecureStorage.setItem('sb-auth-token', '{"novo":true}');

        expect(await chunkedSecureStorage.getItem('sb-auth-token')).toBe('{"novo":true}');
        expect([...store.values()]).not.toContain('{"legado":true}');
    });

    it('Retorna null se algum pedaço estiver faltando', async () => {
        await chunkedSecureStorage.setItem('sb-auth-token', 'k'.repeat(6000));
        store.delete('sb-auth-token.1');

        expect(await chunkedSecureStorage.getItem('sb-auth-token')).toBeNull();
    });
});
