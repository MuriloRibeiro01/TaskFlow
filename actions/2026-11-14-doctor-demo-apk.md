# 14/11/2026 — Doctor, demo e APK de apresentação

- **Branch:** `develop`
- **Objetivo:** rodar o sistema de primeira no dia da apresentação.
- **Decisões do usuário:** doctor + demo + APK de apresentação; login real com Google no APK.
- **Metodologia:** testes das funções puras do doctor escritos antes (falharam por módulo inexistente) e depois a implementação.

## Comandos novos (raiz do projeto)

| Comando | O que faz |
|---|---|
| `npm run doctor` | Confere ferramentas (Node, Java 17, Docker, adb), os dois `.env`, IP × `EXPO_PUBLIC_API_URL`, Docker, containers, imagem da API × código, API, versão do banco (Flyway × migrations), aparelho, app antigo instalado, variante instalada, APK de apresentação, Metro × `.env` e RAM |
| `npm run doctor -- --fix` | Abre Docker e emulador, `docker compose up -d` (recria só a API se o container travar), reconstrói a imagem desatualizada, atualiza `EXPO_PUBLIC_API_URL` quando o IP muda, desinstala `com.taskflow.app` |
| `npm run apk` | Para os daemons do Gradle, `expo prebuild`, `gradlew assembleRelease`, copia para `dist/taskflow-apresentacao.apk` com `dist/taskflow-apresentacao.json` (API, ID do Google, commit, data) e instala |
| `npm run demo` | Doctor `--fix`, gera o APK de novo se o IP ou o ID do Google mudaram, instala se preciso e abre o app |
| `npm run demo:dev` | Plano B: build de desenvolvimento + Metro, compilando o bundle antes de abrir o app (evita o "Bundling 90%" parado) |
| `npm run test:doctor` | 17 testes (`node:test`, sem dependência nova) |

Arquivos: `scripts/doctor.mjs`, `scripts/doctor/lib.mjs` (+ `lib.test.mjs`), `scripts/apk.mjs`, `scripts/demo.mjs`. Roteiro do dia no `README.md` ("Rodar rápido: doctor e demo").

## Problemas encontrados no caminho

| Problema | Solução |
|---|---|
| APK de release bloquearia `http://` (só as builds de debug liberavam): o app abriria, mas não falaria com a API | `expo-build-properties` com `android.usesCleartextTraffic: true` no `app.json`; o doctor confere |
| Assinatura do APK | O release local é assinado com a chave de debug padrão, cujo SHA-1 já está no Client ID Android: login com Google funciona sem novo cadastro. O EAS na nuvem usaria outra chave (não usado) |
| Daemon do Gradle travando `android/` e o `prebuild` falhando com `EBUSY` | `gradlew --stop` antes do `prebuild` |
| `java -version` escreve na saída de erro (doctor dizia "Java 0") | Lê as duas saídas |
| Metro caiu durante o `npm install` (arquivo do `expo-router` sumiu no meio) | Nada a corrigir no código: não instalar pacotes com o Metro rodando |

## Verificação

- `npm run doctor`: 0 erros; avisos esperados (`ENABLE_DEV_LOGIN=true`, RAM baixa).
- `npm run apk`: build de release em 32 min (4 arquiteturas), APK de 126 MB instalado no emulador.
- `npm run demo`: rodou do início ao fim; app aberto **sem Metro**, build de release (sem `DEBUGGABLE`), sincronizou com a API por `http://` e manteve o login.
- Login com Google no APK confirmado pelo usuário (sair e entrar de novo).
- Sync logo após gravar confirmado no aparelho: tarefa concluída no app às 21:57:54 chegou ao servidor no mesmo segundo.
- Testes: doctor 17, app 106, backend 127.

## Não testado

- `npm run demo:dev` de ponta a ponta (as partes dele foram testadas separadamente nas sessões anteriores).
- Celular físico e outro Wi-Fi (o `--fix` do IP foi testado só nos testes unitários).
- macOS (o doctor foi escrito para funcionar, mas só rodou no Windows).
