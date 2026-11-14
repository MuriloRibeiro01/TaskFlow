#!/usr/bin/env node
// Roteiro do dia: confere e corrige o ambiente, sobe banco e API e abre o app no aparelho.
//   npm run demo       APK de apresentação (não depende do Metro): o caminho principal
//   npm run demo:dev   build de desenvolvimento + Metro: o plano B
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { doctor, sh, waitFor, APP, APK_META, PACKAGE } from './doctor.mjs';
import { buildApk, installApk, run, APK_FILE } from './apk.mjs';

const METRO = 'http://localhost:8081';
const BUNDLE = `${METRO}/node_modules/expo-router/entry.bundle?platform=android&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=app&unstable_transformProfile=hermes-stable`;

const metroUp = async () => {
    try {
        return (await (await fetch(`${METRO}/status`, { signal: AbortSignal.timeout(3000) })).text()).includes('running');
    } catch {
        return false;
    }
};

function installedAt(adb, device) {
    const m = /lastUpdateTime=(\S+ \S+)/.exec(sh(`${adb} -s ${device} shell dumpsys package ${PACKAGE}`).out);
    return m ? new Date(m[1].replace(' ', 'T')) : null;
}

function summary(ctx, mode) {
    console.log('\n\x1b[1m\x1b[32mPronto para apresentar\x1b[0m');
    console.log(`   Modo:  ${mode}`);
    console.log(`   API:   ${ctx.apiUrl}`);
    if (ctx.counts) console.log(`   Banco: ${ctx.counts}`);
    console.log('   Login: Google. A conta precisa estar em "usuários de teste" na tela de consentimento OAuth.');
    console.log('   Celular físico sem acesso à API? Mesma rede Wi-Fi e porta 3000 liberada no Firewall do Windows.');
}

async function demoApk(ctx) {
    const meta = existsSync(APK_META) ? JSON.parse(readFileSync(APK_META, 'utf8')) : null;
    const stale = !meta || !existsSync(APK_FILE)
        || meta.apiUrl !== ctx.apiUrl
        || meta.webClientId !== ctx.appEnv.get('EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID');

    if (stale) {
        console.log(`\n⚠ ${meta ? 'O APK foi gerado com outro endereço da API ou outro ID do Google' : 'O APK de apresentação ainda não existe'}: gerando agora.`);
        if (!(await buildApk({ install: true }))) return false;
    } else {
        const at = installedAt(ctx.adb, ctx.device);
        if (ctx.installed !== 'apk' || !at || at < new Date(meta.builtAt)) {
            if (!installApk(ctx.adb, ctx.device)) return false;
        } else {
            console.log('\n✔ O APK de apresentação já está instalado');
        }
    }

    sh(`${ctx.adb} -s ${ctx.device} shell am force-stop ${PACKAGE}`);
    sh(`${ctx.adb} -s ${ctx.device} shell monkey -p ${PACKAGE} -c android.intent.category.LAUNCHER 1`);
    summary(ctx, 'APK de apresentação (sem Metro)');
    return true;
}

async function demoDev(ctx) {
    if (ctx.installed !== 'dev') {
        console.log('\n… a build de desenvolvimento não está instalada: compilando (10 a 20 min na primeira vez)');
        if (!(await run('npx', ['expo', 'run:android', '--no-bundler'], APP))) return false;
    }

    let metro = null;
    if (await metroUp()) {
        console.log('\n✔ Metro já está rodando (se mudou o taskflow-app/.env, pare-o e rode de novo)');
    } else {
        console.log('\n… iniciando o Metro com cache limpo');
        metro = spawn('npx expo start --dev-client --clear', { cwd: APP, stdio: 'inherit', shell: true });
        if (!(await waitFor(metroUp, { timeoutMs: 120_000 }))) {
            console.error('✖ O Metro não subiu em 2 min');
            return false;
        }
    }

    // Compila o bundle antes de abrir o app: o app abre com tudo pronto, sem ficar parado em "Bundling 90%".
    console.log('… compilando o JavaScript antes de abrir o app (alguns minutos com o cache limpo)');
    const res = await fetch(BUNDLE, { signal: AbortSignal.timeout(900_000) }).catch(() => null);
    if (!res?.ok) console.log('⚠ Não consegui compilar o bundle antes; o app vai compilar ao abrir.');
    else await res.arrayBuffer();

    sh(`${ctx.adb} -s ${ctx.device} shell am force-stop ${PACKAGE}`);
    sh(`${ctx.adb} -s ${ctx.device} shell am start -a android.intent.action.VIEW -d "exp+taskflow://expo-development-client/?url=http%3A%2F%2F${ctx.ip}%3A8081" ${PACKAGE}`);
    summary(ctx, 'build de desenvolvimento + Metro (deixe este terminal aberto)');

    if (metro) await new Promise((resolve) => metro.on('exit', resolve));
    return true;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    const dev = process.argv.includes('--dev');
    console.log(`\x1b[1mTaskFlow demo\x1b[0m (${dev ? 'build de desenvolvimento' : 'APK de apresentação'})`);
    const { ok, ctx } = await doctor({ fix: true });
    if (!ok) {
        console.error('\n✖ Corrija os erros acima antes da demo (os que o --fix não resolve sozinho).');
        process.exit(1);
    }
    if (!ctx.adb || !ctx.device) {
        console.error('\n✖ Sem aparelho conectado.');
        process.exit(1);
    }
    process.exit((await (dev ? demoDev(ctx) : demoApk(ctx))) ? 0 : 1);
}
