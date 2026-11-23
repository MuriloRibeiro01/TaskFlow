// Partes do doctor que não tocam no sistema: ler/escrever .env e conferir as chaves.
// Cada verificação devolve uma lista de { level: 'ok' | 'warn' | 'error', msg, fix? }.

export const ok = (msg) => ({ level: 'ok', msg });
export const warn = (msg, fix) => ({ level: 'warn', msg, fix });
export const error = (msg, fix) => ({ level: 'error', msg, fix });

export function worst(issues) {
    if (issues.some((i) => i.level === 'error')) return 'error';
    if (issues.some((i) => i.level === 'warn')) return 'warn';
    return 'ok';
}

export function parseEnv(text) {
    const env = new Map();
    for (const raw of text.split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq < 1) continue;
        let value = line.slice(eq + 1).trim();
        if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
        env.set(line.slice(0, eq).trim(), value);
    }
    return env;
}

// Troca o valor da chave (ou acrescenta no fim), sem mexer nas outras linhas nem nos comentários.
export function setEnvValue(text, key, value) {
    const line = new RegExp(`^${key}=.*$`, 'm');
    if (line.test(text)) return text.replace(line, `${key}=${value}`);
    return `${text}${text === '' || text.endsWith('\n') ? '' : '\n'}${key}=${value}\n`;
}

const REQUIRED_ROOT = ['POSTGRES_USER', 'POSTGRES_PASSWORD', 'POSTGRES_DB', 'JWT_SECRET', 'GOOGLE_CLIENT_IDS'];

export function checkRootEnv(env) {
    const issues = [];
    for (const key of REQUIRED_ROOT) {
        if (!env.get(key)) issues.push(error(`.env da raiz: falta ${key}`, `preencha ${key} (modelo em .env.example)`));
    }
    const secret = env.get('JWT_SECRET');
    if (secret && secret.length < 32) {
        issues.push(error('.env da raiz: JWT_SECRET com menos de 32 caracteres (a API não sobe)', 'gere com: openssl rand -hex 32'));
    }
    if (!env.get('GOOGLE_CLIENT_IDS') && env.get('GOOGLE_CLIENT_ID')) {
        issues.push(error('.env da raiz: o ID do Google está em GOOGLE_CLIENT_ID (singular), que a API não lê', 'mova o valor para GOOGLE_CLIENT_IDS'));
    }
    if (env.get('ENABLE_DEV_LOGIN') === 'true') {
        issues.push(warn('ENABLE_DEV_LOGIN=true: login sem senha aberto para quem estiver na rede', 'deixe false fora de testes'));
    }
    if (issues.length === 0) issues.push(ok('.env da raiz completo'));
    return issues;
}

export function checkAppEnv(app, root) {
    const issues = [];
    const webId = app.get('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');
    const apiUrl = app.get('EXPO_PUBLIC_API_URL');

    if (!webId) {
        issues.push(error('app/.env: falta EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', 'use o ID do cliente "Aplicativo da Web" do Google Cloud'));
    } else {
        const accepted = (root.get('GOOGLE_CLIENT_IDS') ?? '').split(',').map((s) => s.trim());
        if (!accepted.includes(webId)) {
            issues.push(error(
                'O ID Web do app não está em GOOGLE_CLIENT_IDS da API (login dá DEVELOPER_ERROR ou 401)',
                'os dois .env precisam do mesmo ID do cliente "Aplicativo da Web"',
            ));
        }
    }

    if (!apiUrl) {
        issues.push(error('app/.env: falta EXPO_PUBLIC_API_URL', 'use http://<IP da máquina>:3000'));
    } else if (/localhost|127\.0\.0\.1/.test(apiUrl)) {
        issues.push(warn('EXPO_PUBLIC_API_URL usa localhost: só funciona no simulador iOS (no Android é o próprio aparelho)', 'use o IP da máquina na rede'));
    }

    if (issues.length === 0) issues.push(ok('app/.env completo e com o mesmo ID Google da API'));
    return issues;
}

// IPv4 de rede local (VPNs como a Radmin, faixa 26.x, ficam de fora). 192.168.x primeiro: é o Wi-Fi de casa/faculdade.
export function lanIps(interfaces) {
    const ips = [];
    for (const list of Object.values(interfaces)) {
        for (const a of list ?? []) {
            if (a.family !== 'IPv4' && a.family !== 4) continue;
            if (a.internal) continue;
            if (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address)) ips.push(a.address);
        }
    }
    return ips.sort((x, y) => Number(y.startsWith('192.168.')) - Number(x.startsWith('192.168.')));
}

export function apiUrlHost(url) {
    try {
        return new URL(url).hostname;
    } catch {
        return null;
    }
}

export function parseAdbDevices(out) {
    return out
        .split(/\r?\n/)
        .slice(1)
        .map((l) => l.trim().split(/\s+/))
        .filter(([serial, state]) => serial && state === 'device')
        .map(([serial]) => serial);
}

export function isDebuggable(dumpsys) {
    return /pkgFlags=\[[^\]]*\bDEBUGGABLE\b/.test(dumpsys);
}
