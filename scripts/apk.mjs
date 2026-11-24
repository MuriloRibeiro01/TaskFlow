#!/usr/bin/env node
// Gera o APK de apresentação: build de release com o JavaScript dentro (não precisa de Metro),
// assinado com a chave de debug.
// O endereço da API entra no APK: mudou o IP, gere de novo.
//   npm run apk                  gera e instala no aparelho conectado
//   npm run apk -- --no-install  só gera
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { platform } from 'node:os';
import { pathToFileURL } from 'node:url';
import { doctor, sh, APP, ROOT, APK_META, PACKAGE } from './doctor.mjs';

export const APK_FILE = join(ROOT, 'dist', 'taskflow-apresentacao.apk');

export function run(command, args, cwd, env = {}) {
    return new Promise((resolve) => {
        const line = [command, ...args].map((a) => (/\s/.test(a) ? `"${a}"` : a)).join(' ');
        const child = spawn(line, { cwd, stdio: 'inherit', shell: true, env: { ...process.env, ...env } });
        child.on('exit', (code) => resolve(code === 0));
    });
}

export function installApk(adb, device) {
    console.log('\n… instalando o APK no aparelho (substitui a build anterior e mantém os dados e o login)');
    const r = sh(`${adb} -s ${device} install -r "${APK_FILE}"`, { timeout: 600_000 });
    if (!r.ok || !/Success/.test(r.out)) {
        console.error(r.out.trim());
        return false;
    }
    return true;
}

export async function buildApk({ install = true } = {}) {
    console.log('\x1b[1mAPK de apresentação\x1b[0m: conferindo o ambiente antes (corrige o IP no .env, se mudou)');
    const { ctx } = await doctor({ fix: true, quiet: true });
    const apiUrl = ctx.appEnv?.get('EXPO_PUBLIC_API_URL');
    if (!apiUrl) {
        console.error('✖ app/.env sem EXPO_PUBLIC_API_URL. Rode npm run doctor.');
        return false;
    }
    console.log(`   API: ${apiUrl}`);

    // Daemon do Gradle de um build anterior trava arquivos em android/ e o prebuild não consegue recriar a pasta.
    const gradlewExisting = join(APP, 'android', platform() === 'win32' ? 'gradlew.bat' : 'gradlew');
    if (existsSync(gradlewExisting)) await run(gradlewExisting, ['--stop'], join(APP, 'android'));

    console.log('\n… atualizando a configuração nativa (expo prebuild)');
    if (!(await run('npx', ['expo', 'prebuild', '--platform', 'android'], APP, { CI: '1' }))) return false;

    console.log('\n… compilando em release (10 a 20 min na primeira vez; feche outros programas se a RAM estiver baixa)');
    const gradlew = join(APP, 'android', platform() === 'win32' ? 'gradlew.bat' : 'gradlew');
    if (!(await run(gradlew, ['assembleRelease'], join(APP, 'android'), { NODE_ENV: 'production' }))) {
        console.error('✖ O build falhou (veja o erro acima).');
        return false;
    }

    mkdirSync(join(ROOT, 'dist'), { recursive: true });
    copyFileSync(join(APP, 'android', 'app', 'build', 'outputs', 'apk', 'release', 'app-release.apk'), APK_FILE);
    const meta = {
        apiUrl,
        commit: sh('git rev-parse --short HEAD').out.trim(),
        builtAt: new Date().toISOString(),
        package: PACKAGE,
    };
    writeFileSync(APK_META, `${JSON.stringify(meta, null, 2)}\n`);
    console.log(`\n✔ APK gerado: ${APK_FILE}`);

    if (install) {
        if (!ctx.adb || !ctx.device) {
            console.log('⚠ Nenhum aparelho conectado: instale depois com npm run demo');
        } else if (!installApk(ctx.adb, ctx.device)) {
            return false;
        } else {
            console.log('✔ Instalado');
        }
    }
    return true;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
    if (!existsSync(join(APP, 'node_modules'))) {
        console.error('✖ Rode npm install em app antes.');
        process.exit(1);
    }
    process.exit((await buildApk({ install: !process.argv.includes('--no-install') })) ? 0 : 1);
}
