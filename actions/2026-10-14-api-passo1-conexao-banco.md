# 14/10/2026 — API: passo 1 (conexão com o banco, validação e CORS)

- **Branch:** `develop` (alterações não commitadas)
- **Base:** [analises/analise-endpoints-crud-e-auth.md](../analises/analise-endpoints-crud-e-auth.md), seção 9, passo 1
- **Metodologia:** TDD. Os testes foram escritos antes e falharam (`Cannot find module './prisma.service'` / `'./configure-app'`); depois veio a implementação até ficarem verdes.

## Resumo

A API agora tem um `PrismaService` global que conversa com o Postgres pelo driver adapter `pg` (exigido pelo Prisma 7). Todo corpo de requisição passa por um `ValidationPipe` que rejeita campos fora do DTO, e o CORS está ligado. Nenhum endpoint novo foi criado: isso começa no passo 2 (auth). A suíte de testes da API, que já estava quebrada antes desta demanda, voltou a rodar.

## O que foi feito

| Item | O que foi feito | Arquivos |
|---|---|---|
| Dependências | `@prisma/adapter-pg@7.10.0`, `pg`, `class-validator`, `class-transformer` e `@types/pg` (dev). O `@nestjs/jwt` e o `google-auth-library` já estavam no `package.json` e ficam para o passo 2. | `package.json`, `package-lock.json` |
| `PrismaService` | Estende o `PrismaClient` com o adapter `PrismaPg`. **Falha na inicialização** se `DATABASE_URL` não existir, em vez de tentar `localhost` em silêncio. Desconecta no `onModuleDestroy`. | `src/prisma/prisma.service.ts` (novo) |
| `PrismaModule` | `@Global()`: qualquer service futuro recebe `PrismaService` no construtor sem importar o módulo. | `src/prisma/prisma.module.ts` (novo), `src/app.module.ts` |
| `configureApp` | `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })` + `enableCors()`. Fica separado do `main.ts` para os testes usarem a mesma configuração da produção. | `src/configure-app.ts` (novo) |
| `main.ts` | Carrega `dotenv/config` (para rodar fora do Docker), chama `configureApp` e `enableShutdownHooks()`. O último é o que faz o `onModuleDestroy` rodar e fechar as conexões quando o container para. | `src/main.ts` |

### Correções na infraestrutura de testes (já quebrada antes)

Antes desta demanda, `npm test` falhava até no `app.controller.spec.ts` original. Foram três causas:

| Problema | Correção | Arquivo |
|---|---|---|
| TypeScript 6 exige `rootDir` explícito (`TS5011`) | `"rootDir": "./"` no `tsconfig.json`. O build não muda, porque o `tsconfig.build.json` já define `rootDir: ./src` (conferido: `dist/main.js` continua no lugar). | `tsconfig.json` |
| Nest 12 é distribuído só como ESM e o Jest não carregava (`Must use import to load ES Module`) | Scripts `test`, `test:watch`, `test:cov` e `test:e2e` agora rodam `node --experimental-vm-modules node_modules/jest/bin/jest.js`. O formato funciona também no Windows. | `package.json` |
| O client gerado pelo Prisma importa `./x.js` apontando para `./x.ts` | `moduleNameMapper` `'^(\.{1,2}/.*)\.js$' → '$1'` nas duas configs do Jest. No e2e também entrou `setupFiles: ['dotenv/config']`. | `jest.config.ts`, `test/jest-e2e.json` |

## Testes criados

| Arquivo | Casos |
|---|---|
| `src/prisma/prisma.service.spec.ts` | 3 casos: erro claro sem `DATABASE_URL`; client criado com os delegates (`user`, `task`) sem abrir conexão; `$disconnect` chamado no `onModuleDestroy`. |
| `src/configure-app.spec.ts` | 4 casos, com um controller e DTO de exemplo: corpo válido chega como instância do DTO; tipo errado → 400; **campo fora do DTO (`userId`) → 400**; preflight de CORS → 204. |
| `test/prisma.e2e-spec.ts` | 1 caso contra o Postgres real: `prisma.user.count()` responde. **Só leitura**, não grava nada no banco. |

## Validação

| Comando | Resultado |
|---|---|
| `npm test` | 3 suítes, 8 testes passando |
| `npm run test:e2e` (com `DATABASE_URL` apontando para `localhost:5435`) | 2 suítes, 2 testes passando |
| `npm run lint` | sem erros |
| `npm run build` | `dist/main.js` gerado |
| `docker compose up --build -d api` | logs mostram `PrismaModule dependencies initialized` e `No pending migrations to apply` |
| `curl localhost:3000` / `OPTIONS` com `Origin` | `Hello World!` / `204` |

Para rodar o e2e localmente, a API precisa de um `DATABASE_URL` com host `localhost:5435` (porta atual do `compose.yml`). Isso pode vir de um `taskflow-api/.env`, que está no `.gitignore`, ou de uma variável no terminal. Dentro do Docker, o compose já injeta a URL com host `db`.

## Riscos e possíveis soluções

| # | Risco | Impacto | Solução |
|---|---|---|---|
| 1 | **Postgres exposto na rede.** O `compose.yml` publica `0.0.0.0:5435`, então qualquer máquina na mesma rede (Wi-Fi da faculdade, por exemplo) alcança o banco, protegido só pela senha do `.env`. | Acesso direto aos dados, sem passar pela validação nem pela auth da API. | Trocar para `"127.0.0.1:5435:5432"` no `compose.yml` e usar senha forte. **Não alterei**, porque o arquivo é compartilhado com o grupo. |
| 2 | **Sem `.dockerignore`.** Agora existe `taskflow-api/node_modules` local, e o `COPY . .` do Dockerfile copia essa pasta por cima da instalada pelo `npm ci`. Também copiaria um `taskflow-api/.env` para dentro da imagem. | Imagem com dependências da sua máquina em vez das do lockfile; segredo embutido na imagem. | Criar `taskflow-api/.dockerignore` com `node_modules`, `dist`, `.env`, `coverage` e `src/generated`. |
| 3 | **Corrida banco × API.** `depends_on` não espera o Postgres aceitar conexões. Na primeira subida, o `migrate deploy` pode falhar e o container reinicia. | Logs de erro no começo; resolve sozinho por causa do `restart: always`. | `healthcheck` com `pg_isready` no serviço `db` + `condition: service_healthy` na API. Está previsto no passo 6. |
| 4 | **Pool de conexões.** Cada `PrismaService` abre um pool `pg`, por padrão até 10 conexões. Como o módulo é global, existe uma instância só na API. O risco é algum teste ou script criar várias instâncias e esgotar o limite do Postgres (100). | `too many clients` no banco. | Sempre injetar o `PrismaService` em vez de dar `new`. Os testes que dão `new` fecham a conexão no `afterAll` ou nem chegam a conectar. |
| 5 | **CORS liberado para qualquer origem.** | Baixo hoje: a auth vai ser por header `Authorization`, e o navegador não envia esse header automaticamente como envia cookie. | Se algum dia a auth passar a usar cookies, restringir com `enableCors({ origin: [...] })`. |
| 6 | **`--experimental-vm-modules` é experimental.** | Uma versão futura do Node ou do Jest pode mudar o comportamento e quebrar os testes de novo. | Quando o Jest suportar ESM do Nest sem flag, ou migrando para Vitest, remover a flag dos scripts. |
| 7 | **`tsconfig.build.tsbuildinfo` versionado** (apareceu como modificado depois do build). | Builds incrementais podem pular a geração do `dist/` (ver análise anterior). | Remover do git e adicionar ao `.gitignore`. |

## Próximo passo

Passo 2: `AuthModule` com `POST /auth/dev-login` (atrás de `ENABLE_DEV_LOGIN`), `AuthGuard` com JWT e `GET /users/me`.
