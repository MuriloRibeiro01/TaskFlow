// Adapter de storage do Supabase sobre o SecureStore.
// O SecureStore aceita no máximo ~2048 bytes por valor, e a sessão do Supabase costuma
// passar disso. Por isso o valor é dividido em pedaços:
//   <chave>          → quantidade de pedaços
//   <chave>.0 .. N   → pedaços do valor

import * as SecureStore from 'expo-secure-store';

export const MAX_CHUNK_BYTES = 1800;

function utf8Length(char: string) {
    const code = char.codePointAt(0)!;
    if (code < 0x80) return 1;
    if (code < 0x800) return 2;
    if (code < 0x10000) return 3;
    return 4;
}

function splitIntoChunks(value: string): string[] {
    const chunks: string[] = [];
    let atual = '';
    let bytes = 0;

    // for...of percorre code points, então emojis/pares substitutos não são quebrados
    for (const char of value) {
        const tamanho = utf8Length(char);
        if (bytes + tamanho > MAX_CHUNK_BYTES) {
            chunks.push(atual);
            atual = '';
            bytes = 0;
        }
        atual += char;
        bytes += tamanho;
    }
    chunks.push(atual);

    return chunks;
}

function chunkKey(key: string, index: number) {
    return `${key}.${index}`;
}

function parseCount(raw: string | null) {
    if (raw === null || !/^\d+$/.test(raw)) return null;
    return Number(raw);
}

async function removeChunks(key: string, from: number, to: number) {
    for (let i = from; i < to; i++) {
        await SecureStore.deleteItemAsync(chunkKey(key, i));
    }
}

export const chunkedSecureStorage = {
    async getItem(key: string): Promise<string | null> {
        const raw = await SecureStore.getItemAsync(key);
        const count = parseCount(raw);

        // Formato antigo: o valor inteiro estava salvo direto na chave
        if (count === null) return raw;

        let value = '';
        for (let i = 0; i < count; i++) {
            const chunk = await SecureStore.getItemAsync(chunkKey(key, i));
            if (chunk === null) return null;
            value += chunk;
        }
        return value;
    },

    async setItem(key: string, value: string): Promise<void> {
        const anterior = parseCount(await SecureStore.getItemAsync(key)) ?? 0;
        const chunks = splitIntoChunks(value);

        for (let i = 0; i < chunks.length; i++) {
            await SecureStore.setItemAsync(chunkKey(key, i), chunks[i]);
        }
        await SecureStore.setItemAsync(key, String(chunks.length));

        await removeChunks(key, chunks.length, anterior);
    },

    async removeItem(key: string): Promise<void> {
        const count = parseCount(await SecureStore.getItemAsync(key)) ?? 0;
        await removeChunks(key, 0, count);
        await SecureStore.deleteItemAsync(key);
    },
};
