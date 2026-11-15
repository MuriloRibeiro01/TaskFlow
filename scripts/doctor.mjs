#!/usr/bin/env node
// TaskFlow doctor: confere tudo o que precisa estar certo para rodar o sistema e, com --fix,
// corrige o que for seguro corrigir sozinho.
//   npm run doctor            só confere
//   npm run doctor -- --fix   confere e corrige
import { execSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs';
import { networkInterfaces, freemem, platform, homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
    ok, warn, error, worst, parseEnv, setEnvValue, checkRootEnv, checkAppEnv,
    lanIps, apiUrlHost, parseAdbDevices, isDebuggable,
} from './doctor/lib.mjs';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const APP = join(ROOT, 'taskflow-app');
export const PACKAGE = 'br.edu.ucb.taskflow';
const OLD_PACKAGE = 'com.taskflow.app';
export const APK_META = join(ROOT, 'dist', 'taskflow-apresentacao.json');
const IS_WIN = platform() === 'win32';

// ---------- utilidades ----------

export function sh(command, { timeout = 60_000, cwd = ROOT } = {}) {
    try {
        const out = execSync(command, { cwd, timeout, stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' });
        return { ok: true, out: out ?? '' };
    } catch (e) {
        return { ok: false, out: `${e.stdout ?? ''}${e.stderr ?? ''}` };
    }
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function waitFor(check, { timeoutMs, intervalMs = 2000 }) {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
        if (await check()) return true;
        await sleep(intervalMs);
    }
    return false;
}

function sdkDir() {
    const candidates = [
        process.env.ANDROID_HOME,
        process.env.ANDROID_SDK_ROOT,
        IS_WIN ? join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk') : join(homedir(), 'Library', 'Android', 'sdk'),
        join(homedir(), 'Android', 'Sdk'),
    ];
    return candidates.find((d) => d && existsSync(d)) ?? null;
}

export function adbPath() {
    if (sh('adb version').ok) return 'adb';
    const sdk = sdkDir();
    const exe = sdk && join(sdk, 'platform-tools', IS_WIN ? 'adb.exe' : 'adb');
    return exe && existsSync(exe) ? `"${exe}"` : null;
}

function emulatorPath() {
    const sdk = sdkDir();
    const exe = sdk && join(sdk, 'emulator', IS_WIN ? 'emulator.exe' : 'emulator');
    return exe && existsSync(exe) ? exe : null;
}

export function readEnv(file) {
    return existsSync(file) ? parseEnv(readFileSync(file, 'utf8')) : null;
}

export function currentIp() {
    return lanIps(networkInterfaces())[0] ?? null;
}

async function httpStatus(url, timeoutMs = 5000) {
    try {
        const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
        return res.status;
    } catch {
        return null;
    }
}

function latestMigration() {
    const dir = join(ROOT, 'taskflow-api-spring', 'src', 'main', 'resources', 'db', 'migration');
    if (!existsSync(dir)) return null;
    const versions = readdirSync(dir).map((f) => /^V(\d+)__/.exec(f)?.[1]).filter(Boolean).map(Number);
    return versions.length ? Math.max(...versions) : null;
}

function containerState(name) {
    const r = sh(`docker inspect -f "{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}" ${name}`);
    return r.ok ? r.out.trim() : 'ausente';
}

function psql(rootEnv, sql) {
    const user = rootEnv.get('POSTGRES_USER');
    const db = rootEnv.get('POSTGRES_DB');
    const r = sh(
        `docker exec -e PGPASSWORD=${rootEnv.get('POSTGRES_PASSWORD')} taskflow-postgres psql -h 127.0.0.1 -U ${user} -d ${db} -tAc "${sql}"`,
        { timeout: 20_000 },
    );
    return r.ok ? r.out.trim() : null;
}

// ---------- verificações ----------

function checkTools() {
    const issues = [];
    const node = Number(process.versions.node.split('.')[0]);
    issues.push(node >= 20 ? ok(`Node ${process.versions.node}`) : error(`Node ${process.versions.node}: precisa do 20 ou mais novo`));

    const java = sh('java -version 2>&1'); // o java escreve a versão na saída de erro
    const javaMajor = Number(/version "(\d+)/.exec(java.out)?.[1] ?? 0);
    if (!java.ok) issues.push(error('Java não encontrado (o build Android precisa do JDK 17)', 'instale o JDK 17 e ponha no PATH'));
    else issues.push(javaMajor >= 17 ? ok(`Java ${javaMajor}`) : error(`Java ${javaMajor}: precisa do 17`));

    issues.push(sh('docker --version').ok ? ok('Docker instalado') : error('Docker não encontrado', 'instale o Docker Desktop'));
    issues.push(adbPath() ? ok('Android SDK (adb)') : error('adb não encontrado', 'instale o Android Studio / SDK'));
    return issues;
}

function checkEnvFiles(ctx, fix) {
    const rootFile = join(ROOT, '.env');
    const appFile = join(APP, '.env');
    ctx.rootEnv = readEnv(rootFile);
    ctx.appEnv = readEnv(appFile);
    if (!ctx.rootEnv) return [error('.env da raiz não existe', 'copie .env.example para .env e preencha')];
    if (!ctx.appEnv) return [error('taskflow-app/.env não existe', 'crie com EXPO_PUBLIC_API_URL e EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID')];

    const issues = [...checkRootEnv(ctx.rootEnv), ...checkAppEnv(ctx.appEnv, ctx.rootEnv)];

    // IP: o Wi-Fi do dia pode dar outro IP, e o app (e o APK) ficariam apontando para o lugar errado.
    ctx.ip = currentIp();
    const apiUrl = ctx.appEnv.get('EXPO_PUBLIC_API_URL');
    const host = apiUrlHost(apiUrl);
    if (!ctx.ip) {
        issues.push(error('Sem IP de rede local: a máquina não está em nenhuma rede Wi-Fi/cabo', 'conecte na mesma rede do celular'));
    } else if (host && host !== ctx.ip && !lanIps(networkInterfaces()).includes(host)) {
        const novo = apiUrl.replace(host, ctx.ip);
        if (fix) {
            writeFileSync(appFile, setEnvValue(readFileSync(appFile, 'utf8'), 'EXPO_PUBLIC_API_URL', novo));
            ctx.appEnv.set('EXPO_PUBLIC_API_URL', novo);
            ctx.envChanged = true;
            issues.push(ok(`EXPO_PUBLIC_API_URL atualizado para ${novo} (o IP mudou)`));
        } else {
            issues.push(error(`EXPO_PUBLIC_API_URL aponta para ${host}, mas o IP atual da máquina é ${ctx.ip}`, '--fix atualiza o taskflow-app/.env'));
        }
    } else if (host) {
        issues.push(ok(`IP da máquina ${ctx.ip} bate com EXPO_PUBLIC_API_URL`));
    }
    ctx.apiUrl = ctx.appEnv.get('EXPO_PUBLIC_API_URL');
    return issues;
}

async function checkDocker(ctx, fix) {
    if (sh('docker info', { timeout: 20_000 }).ok) return [ok('Docker Desktop ligado')];
    if (!fix) return [error('Docker Desktop desligado', '--fix abre e espera ele responder')];

    if (IS_WIN) spawn('C:\\Program Files\\Docker\\Docker\\Docker Desktop.exe', [], { detached: true, stdio: 'ignore' }).unref();
    else sh('open -a Docker');
    process.stdout.write('   … abrindo o Docker Desktop (até 3 min)\n');
    const up = await waitFor(() => sh('docker info', { timeout: 20_000 }).ok, { timeoutMs: 180_000, intervalMs: 3000 });
    return [up ? ok('Docker Desktop aberto') : error('Docker Desktop não respondeu em 3 min', 'abra-o manualmente')];
}

async function checkContainers(ctx, fix) {
    const issues = [];
    if (!sh('docker info', { timeout: 20_000 }).ok) return [warn('Containers não conferidos: Docker desligado')];

    const healthy = () => containerState('taskflow-postgres') === 'running healthy' && containerState('taskflow-api').startsWith('running');
    if (!healthy()) {
        if (!fix) {
            issues.push(error(`Containers: postgres=${containerState('taskflow-postgres')}, api=${containerState('taskflow-api')}`, '--fix roda docker compose up -d'));
            return issues;
        }
        process.stdout.write('   … docker compose up -d\n');
        let r = sh('docker compose up -d', { timeout: 180_000 });
        if (!r.ok && /zombie|cannot stop container/i.test(r.out)) {
            // container da API travado (já aconteceu): recria só ele, o banco não é tocado
            sh('docker rm -f taskflow-api', { timeout: 60_000 });
            r = sh('docker compose up -d --no-deps api', { timeout: 180_000 });
        }
        await waitFor(healthy, { timeoutMs: 120_000 });
    }
    issues.push(healthy()
        ? ok('Containers taskflow-postgres e taskflow-api rodando')
        : error(`Containers: postgres=${containerState('taskflow-postgres')}, api=${containerState('taskflow-api')}`, 'veja: docker compose logs api'));

    // Imagem da API mais antiga que o código: a API rodaria uma versão velha.
    const created = sh('docker image inspect taskflow-api -f "{{.Created}}"').out.trim();
    const changed = sh('git log -1 --format=%cI -- taskflow-api-spring').out.trim();
    if (created && changed && new Date(created) < new Date(changed)) {
        if (fix) {
            process.stdout.write('   … imagem da API desatualizada: docker compose build api (alguns minutos)\n');
            const built = sh('docker compose build api', { timeout: 900_000 }).ok && sh('docker compose up -d api', { timeout: 180_000 }).ok;
            issues.push(built ? ok('Imagem da API reconstruída com o código atual') : error('Falha ao reconstruir a API', 'docker compose build api'));
        } else {
            issues.push(warn('Imagem da API mais antiga que o código', '--fix reconstrói (docker compose build api)'));
        }
    }
    return issues;
}

async function checkApi(ctx) {
    const issues = [];
    if (!ctx.rootEnv || !ctx.apiUrl) return [warn('API não conferida: falta .env')];

    const status = await waitFor(async () => (await httpStatus(`${ctx.apiUrl}/`)) === 200, { timeoutMs: 60_000 });
    issues.push(status
        ? ok(`API respondendo em ${ctx.apiUrl}`)
        : error(`API não responde em ${ctx.apiUrl}`, 'veja: docker compose logs api'));

    const google = await httpStatus(`${ctx.apiUrl}/auth/google`);
    if (google === 503) issues.push(error('POST /auth/google responde 503: a API não tem GOOGLE_CLIENT_IDS', 'preencha no .env da raiz e rode docker compose up -d api'));

    const version = psql(ctx.rootEnv, 'select max(version)::int from flyway_schema_history');
    const expected = latestMigration();
    if (version == null) issues.push(warn('Não consegui ler a versão do banco'));
    else if (expected && Number(version) < expected) issues.push(error(`Banco na V${version}, código espera V${expected}`, 'reinicie a API (o Flyway migra na subida)'));
    else issues.push(ok(`Banco na V${version}`));

    ctx.counts = psql(ctx.rootEnv, "select (select count(*) from users)||' usuários, '||(select count(*) from tasks)||' tarefas'");
    return issues;
}

async function checkAndroid(ctx, fix) {
    const issues = [];
    const adb = adbPath();
    if (!adb) return [warn('Android não conferido: adb não encontrado')];
    ctx.adb = adb;

    let devices = parseAdbDevices(sh(`${adb} devices`).out);
    if (devices.length === 0 && fix) {
        const emulator = emulatorPath();
        const avds = emulator ? sh(`"${emulator}" -list-avds`).out.split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [];
        const avd = avds.find((a) => a === 'Pixel_4a') ?? avds[0];
        if (avd) {
            process.stdout.write(`   … abrindo o emulador ${avd} (até 3 min)\n`);
            spawn(emulator, ['-avd', avd], { detached: true, stdio: 'ignore' }).unref();
            await waitFor(() => sh(`${adb} shell getprop sys.boot_completed`).out.trim() === '1', { timeoutMs: 180_000, intervalMs: 3000 });
            devices = parseAdbDevices(sh(`${adb} devices`).out);
        }
    }
    if (devices.length === 0) return [error('Nenhum celular ou emulador conectado', '--fix abre o emulador; celular: ative a depuração USB')];
    ctx.device = devices[0];
    issues.push(ok(`Aparelho conectado: ${devices.join(', ')}`));

    const packages = sh(`${adb} shell pm list packages`).out;
    if (packages.includes(`package:${OLD_PACKAGE}`)) {
        if (fix) {
            sh(`${adb} uninstall ${OLD_PACKAGE}`);
            issues.push(ok(`App antigo ${OLD_PACKAGE} desinstalado (tinha o mesmo nome e ícone)`));
        } else {
            issues.push(warn(`App antigo ${OLD_PACKAGE} instalado, com o mesmo nome e ícone (o Google o recusa)`, '--fix desinstala'));
        }
    }
    if (!packages.includes(`package:${PACKAGE}`)) {
        ctx.installed = null;
        issues.push(warn('TaskFlow não está instalado no aparelho', 'npm run demo (APK) ou npm run demo:dev (build de desenvolvimento)'));
    } else {
        ctx.installed = isDebuggable(sh(`${adb} shell dumpsys package ${PACKAGE}`).out) ? 'dev' : 'apk';
        issues.push(ok(`TaskFlow instalado (${ctx.installed === 'dev' ? 'build de desenvolvimento' : 'APK de apresentação'})`));
    }
    return issues;
}

function checkPresentationApk(ctx) {
    const issues = [];
    const appJson = JSON.parse(readFileSync(join(APP, 'app.json'), 'utf8'));
    const props = appJson.expo.plugins?.find((p) => Array.isArray(p) && p[0] === 'expo-build-properties');
    if (!props?.[1]?.android?.usesCleartextTraffic) {
        issues.push(error('APK de release não acessa http:// (falta usesCleartextTraffic no expo-build-properties)', 'veja o app.json'));
    }

    if (!existsSync(APK_META)) {
        issues.push(warn('APK de apresentação ainda não gerado', 'npm run apk'));
        return issues;
    }
    const meta = JSON.parse(readFileSync(APK_META, 'utf8'));
    ctx.apkMeta = meta;
    if (ctx.apiUrl && meta.apiUrl !== ctx.apiUrl) {
        issues.push(error(`APK aponta para ${meta.apiUrl}, mas a API agora está em ${ctx.apiUrl}`, 'npm run apk (o endereço vai dentro do APK)'));
    } else if (ctx.appEnv && meta.webClientId !== ctx.appEnv.get('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID')) {
        issues.push(error('APK gerado com outro ID do Google', 'npm run apk'));
    } else {
        const commit = sh('git rev-parse --short HEAD').out.trim();
        issues.push(meta.commit === commit
            ? ok(`APK de apresentação em dia (${meta.builtAt.slice(0, 16).replace('T', ' ')})`)
            : warn(`APK gerado no commit ${meta.commit}; o código está no ${commit}`, 'npm run apk, se o app mudou'));
    }
    return issues;
}

function checkMetro(ctx) {
    if (!IS_WIN) return [];
    const r = sh('powershell -NoProfile -Command "$c=Get-NetTCPConnection -LocalPort 8081 -State Listen -ErrorAction SilentlyContinue | Select -First 1; if($c){(Get-Process -Id $c.OwningProcess).StartTime.ToString(\'o\')}"', { timeout: 20_000 });
    const started = r.out.trim();
    if (!started) return [];
    const envChanged = statSync(join(APP, '.env')).mtime;
    if (ctx.envChanged || envChanged > new Date(started)) {
        return [warn('O Metro foi iniciado antes da última mudança no taskflow-app/.env (está servindo os valores antigos)', 'pare o Metro e rode: npx expo start --dev-client --clear')];
    }
    return [ok('Metro rodando com o .env atual')];
}

function checkMemory() {
    const gb = freemem() / 1024 ** 3;
    return [gb < 2
        ? warn(`Só ${gb.toFixed(1)} GB de RAM livre: build e instalação ficam muito lentos`, 'feche navegador e outros programas')
        : ok(`${gb.toFixed(1)} GB de RAM livre`)];
}

// ---------- execução ----------

const ICON = { ok: '\x1b[32m✔\x1b[0m', warn: '\x1b[33m⚠\x1b[0m', error: '\x1b[31m✖\x1b[0m' };

function print(title, issues) {
    console.log(`\n\x1b[1m${title}\x1b[0m`);
    for (const i of issues) {
        console.log(` ${ICON[i.level]} ${i.msg}`);
        if (i.fix && i.level !== 'ok') console.log(`     → ${i.fix}`);
    }
}

export async function doctor({ fix = false, quiet = false } = {}) {
    const ctx = {};
    const sections = [
        ['Ferramentas', () => checkTools()],
        ['Configuração (.env)', () => checkEnvFiles(ctx, fix)],
        ['Docker', () => checkDocker(ctx, fix)],
        ['Banco e API', async () => [...(await checkContainers(ctx, fix)), ...(await checkApi(ctx))]],
        ['Android', () => checkAndroid(ctx, fix)],
        ['APK de apresentação', () => checkPresentationApk(ctx)],
        ['Metro e memória', () => [...checkMetro(ctx), ...checkMemory()]],
    ];
    const all = [];
    for (const [title, run] of sections) {
        const issues = await run();
        all.push(...issues);
        if (!quiet) print(title, issues);
    }
    const errors = all.filter((i) => i.level === 'error').length;
    const warns = all.filter((i) => i.level === 'warn').length;
    if (!quiet) {
        console.log(`\n${errors ? ICON.error : warns ? ICON.warn : ICON.ok} ${errors} erro(s), ${warns} aviso(s)`);
        if (ctx.counts) console.log(`   Banco: ${ctx.counts}`);
        if (errors && !fix) console.log('   Rode \x1b[1mnpm run doctor -- --fix\x1b[0m para corrigir o que der automaticamente.');
    }
    return { ok: worst(all) !== 'error', errors, warns, ctx };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const fix = process.argv.includes('--fix');
    console.log(`\x1b[1mTaskFlow doctor\x1b[0m${fix ? ' (--fix)' : ''}`);
    const result = await doctor({ fix });
    process.exit(result.ok ? 0 : 1);
}
