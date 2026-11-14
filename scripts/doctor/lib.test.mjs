// TDD das partes do doctor que não dependem do sistema (rodar: npm run test:doctor)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    parseEnv,
    setEnvValue,
    checkRootEnv,
    checkAppEnv,
    lanIps,
    apiUrlHost,
    parseAdbDevices,
    isDebuggable,
    worst,
} from './lib.mjs';

const WEB = '547989278497-9qmguste0nqsojtuf3bmrviniematd72.apps.googleusercontent.com';
const OUTRO = '547989278497-9lvgc9ht3mfu0k69mme8tqfcmjqj6ftv.apps.googleusercontent.com';

const raizOk = () => new Map([
    ['POSTGRES_USER', 'postgres'], ['POSTGRES_PASSWORD', 'segredo'], ['POSTGRES_DB', 'taskflow'],
    ['JWT_SECRET', 'x'.repeat(64)], ['GOOGLE_CLIENT_IDS', WEB], ['ENABLE_DEV_LOGIN', 'false'],
]);
const appOk = () => new Map([['EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', WEB], ['EXPO_PUBLIC_API_URL', 'http://192.168.0.179:3000']]);
const textos = (issues) => issues.map((i) => i.msg).join(' | ');

test('parseEnv lê chave=valor, ignora comentários e linhas vazias, tira aspas e \\r', () => {
    const env = parseEnv('# comentário\r\nA=1\r\n\r\nB="dois"\nC=\nD=x=y\n');
    assert.deepEqual([...env], [['A', '1'], ['B', 'dois'], ['C', ''], ['D', 'x=y']]);
});

test('setEnvValue troca a linha existente e preserva o resto', () => {
    assert.equal(setEnvValue('A=1\nB=2\n', 'B', '3'), 'A=1\nB=3\n');
});

test('setEnvValue acrescenta a chave que não existe', () => {
    assert.equal(setEnvValue('A=1', 'B', '2'), 'A=1\nB=2\n');
});

test('checkRootEnv: .env completo não tem erro', () => {
    assert.equal(worst(checkRootEnv(raizOk())), 'ok');
});

test('checkRootEnv: falta de variável obrigatória é erro', () => {
    const env = raizOk();
    env.delete('POSTGRES_PASSWORD');
    const issues = checkRootEnv(env);
    assert.equal(worst(issues), 'error');
    assert.match(textos(issues), /POSTGRES_PASSWORD/);
});

test('checkRootEnv: JWT_SECRET curto é erro (a API não sobe)', () => {
    const env = raizOk();
    env.set('JWT_SECRET', 'curto');
    assert.match(textos(checkRootEnv(env)), /JWT_SECRET/);
});

test('checkRootEnv: GOOGLE_CLIENT_IDS vazio é erro, e avisa se o ID foi parar no GOOGLE_CLIENT_ID (singular)', () => {
    const env = raizOk();
    env.set('GOOGLE_CLIENT_IDS', '');
    env.set('GOOGLE_CLIENT_ID', WEB);
    const issues = checkRootEnv(env);
    assert.equal(worst(issues), 'error');
    assert.match(textos(issues), /GOOGLE_CLIENT_ID \(singular\)/);
});

test('checkRootEnv: dev-login ligado vira aviso', () => {
    const env = raizOk();
    env.set('ENABLE_DEV_LOGIN', 'true');
    const issues = checkRootEnv(env);
    assert.equal(worst(issues), 'warn');
    assert.match(textos(issues), /ENABLE_DEV_LOGIN/);
});

test('checkAppEnv: app e API com o mesmo ID Web não tem erro', () => {
    assert.equal(worst(checkAppEnv(appOk(), raizOk())), 'ok');
});

test('checkAppEnv: ID do app que a API não aceita é erro (DEVELOPER_ERROR / 401)', () => {
    const app = appOk();
    app.set('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID', OUTRO);
    const issues = checkAppEnv(app, raizOk());
    assert.equal(worst(issues), 'error');
    assert.match(textos(issues), /GOOGLE_CLIENT_IDS/);
});

test('checkAppEnv: sem ID do Google ou sem URL da API é erro', () => {
    const issues = checkAppEnv(new Map(), raizOk());
    assert.match(textos(issues), /EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID/);
    assert.match(textos(issues), /EXPO_PUBLIC_API_URL/);
});

test('checkAppEnv: localhost na URL da API é aviso (só serve no simulador iOS; no Android é o próprio aparelho)', () => {
    const app = appOk();
    app.set('EXPO_PUBLIC_API_URL', 'http://localhost:3000');
    const issues = checkAppEnv(app, raizOk());
    assert.equal(worst(issues), 'warn');
    assert.match(textos(issues), /localhost/);
});

test('lanIps devolve só IPv4 de rede local, com 192.168 primeiro, e ignora VPN e loopback', () => {
    const interfaces = {
        'Radmin VPN': [{ family: 'IPv4', address: '26.149.108.135', internal: false }],
        'Wi-Fi': [{ family: 'IPv4', address: '192.168.0.179', internal: false }, { family: 'IPv6', address: 'fe80::1', internal: false }],
        'vEthernet (WSL)': [{ family: 'IPv4', address: '172.20.16.1', internal: false }],
        Loopback: [{ family: 'IPv4', address: '127.0.0.1', internal: true }],
    };
    assert.deepEqual(lanIps(interfaces), ['192.168.0.179', '172.20.16.1']);
});

test('apiUrlHost tira o host da URL e devolve null para lixo', () => {
    assert.equal(apiUrlHost('http://192.168.0.179:3000'), '192.168.0.179');
    assert.equal(apiUrlHost('nao é url'), null);
});

test('parseAdbDevices devolve só os aparelhos prontos', () => {
    const out = 'List of devices attached\r\nemulator-5554\tdevice\r\nR58N\tunauthorized\r\nX\toffline\r\n\r\n';
    assert.deepEqual(parseAdbDevices(out), ['emulator-5554']);
});

test('isDebuggable reconhece a build de desenvolvimento pelo pkgFlags', () => {
    assert.equal(isDebuggable('    pkgFlags=[ DEBUGGABLE HAS_CODE ALLOW_CLEAR_USER_DATA ]'), true);
    assert.equal(isDebuggable('    pkgFlags=[ HAS_CODE ALLOW_CLEAR_USER_DATA ]'), false);
});

test('worst: erro > aviso > ok', () => {
    assert.equal(worst([]), 'ok');
    assert.equal(worst([{ level: 'warn' }, { level: 'ok' }]), 'warn');
    assert.equal(worst([{ level: 'warn' }, { level: 'error' }]), 'error');
});
