# Análise do backend (taskflow-api) e do banco de dados

Data: 2026-10-14 · Branch analisada: `develop` (commit `0407a26`) · Nenhum código foi alterado.

---

## 1. Resumo em uma frase

O backend hoje é **um esqueleto**: um projeto NestJS recém-gerado com **um único endpoint de teste (`GET /` → "Hello World!")**, um **schema Prisma com 3 tabelas** e uma **migration inicial**. **Não existe nenhuma requisição ao banco** no código da API, e o app mobile **não chama a API** em nenhum lugar — ele continua falando direto com o Supabase.

---

## 2. Onde está cada coisa

```
TaskFlow/
├── compose.yml              ← sobe 2 containers: Postgres (db) + API NestJS (api)
├── .env.example             ← modelo de variáveis (o .env real NÃO existe ainda)
└── taskflow-api/
    ├── Dockerfile           ← como a imagem da API é construída
    ├── prisma.config.ts     ← config do Prisma 7 (lê DATABASE_URL)
    ├── prisma7.config.ts    ← cópia quase idêntica, gerada pelo Prisma (sobra)
    ├── prisma/
    │   ├── schema.prisma    ← modelo das tabelas
    │   └── migrations/20261011142457_init/migration.sql  ← SQL que cria as tabelas
    └── src/
        ├── main.ts          ← liga o servidor na porta 3000
        ├── app.module.ts    ← módulo raiz (só registra AppController/AppService)
        ├── app.controller.ts← GET /
        └── app.service.ts   ← retorna "Hello World!"
```

Stack: NestJS 12, Prisma 7.10, PostgreSQL 15 (imagem Docker), Node 22 (alpine) dentro do container.

---

## 3. Endpoints existentes

| Método | Rota | O que faz | Toca no banco? |
|---|---|---|---|
| GET | `/` | Retorna o texto `Hello World!` | Não |

**Só isso.** Não há:
- módulos de tarefas, sessões Pomodoro ou usuários;
- autenticação (nada de JWT, Google ou Apple — as variáveis `JWT_SECRET`, `GOOGLE_CLIENT_ID` etc. do `.env.example` não são lidas por nenhum código);
- Swagger (o README diz que existe em `/docs`, mas o pacote `@nestjs/swagger` nem está instalado);
- validação (`class-validator`), CORS, `ConfigModule`.

Testes: `src/app.controller.spec.ts` e `test/app.e2e-spec.ts` só testam o "Hello World!".

---

## 4. Requisições ao banco

**Nenhuma.** Busquei por `PrismaClient`, `PrismaService`, `prisma.` e imports de `generated/prisma` em `taskflow-api/src` — não aparece nada. O Prisma é usado **apenas pela linha de comando** (`prisma generate` e `prisma migrate deploy`, no Dockerfile), ou seja: ele **cria as tabelas**, mas a API nunca lê nem grava nelas.

Para a API conseguir consultar o banco no Prisma 7, ainda faltaria (pendência, não bug atual):
- instalar um *driver adapter* — `@prisma/adapter-pg` + `pg` (o Prisma 7 com o gerador `prisma-client` exige isso para instanciar o `PrismaClient`; não está no `package.json`);
- criar um `PrismaService`/`PrismaModule` no Nest e injetá-lo nos serviços.

---

## 5. Como está o banco de dados

### 5.1 O container

Definido em `compose.yml`, serviço `db`:

| Item | Valor |
|---|---|
| Imagem | `postgres:15` |
| Nome do container | `taskflow-postgres` |
| Porta | `5432` do container exposta em `5432` da sua máquina |
| Usuário / senha / banco | vêm do `.env`: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` (no exemplo: `taskflow` / `taskflow` / `taskflow`) |
| Persistência | volume Docker `taskflow-pgdata` → os dados sobrevivem a `docker compose down` (só somem com `docker compose down -v`) |
| Reinício | `restart: always` |

**Estado atual na sua máquina:** os containers do TaskFlow **nunca foram criados** (`docker ps -a` não mostra `taskflow-postgres` nem `taskflow-nestjs`, e o volume `taskflow-pgdata` não existe). Há outro Postgres rodando (`postgres_db`, de outro projeto), mas ele está na porta **5433**, então **não conflita** com a 5432 do TaskFlow.

### 5.2 Como a API se conecta

O compose monta a URL e injeta na API:

```
DATABASE_URL = postgresql://<user>:<senha>@db:5432/<banco>?schema=public
```

O host é **`db`** (nome do serviço na rede interna do Docker). Isso só funciona **de dentro** de um container. Se for rodar a API fora do Docker (`npm run start:dev`), a URL tem de usar `localhost:5432`.

### 5.3 As tabelas (migration `20261011142457_init`)

```
users                      tasks                          pomodoro_sessions
─────────────              ─────────────────────          ─────────────────────
id (serial, PK)  ◄──┐      id (serial, PK)  ◄──┐          id (serial, PK)
email (único)       ├───── user_id (FK, null)   ├──────── task_id (FK, null)
display_name        │      title (obrigatório)  │         user_id (FK, null) ──► users
avatar_url          │      description          │         started_at / ended_at
                    │      priority  (low|medium|high, padrão medium)
                    │      estimated_pomodoros  │         duration_seconds
                    │      completed_pomodoros (padrão 0)  type (focus|short_break|long_break)
                    │      status (pending|in_progress|done)  status (completed|cancelled|interrupted)
                    │      completed_at         │         sync_status
                    │      sync_status (synced|pending|conflict)
                    │      created_at / updated_at
```

- Todas as FKs usam `ON DELETE SET NULL` (apagar um usuário não apaga as tarefas, só deixa `user_id` nulo).
- Índices em `tasks.user_id`, `pomodoro_sessions.task_id` e `pomodoro_sessions.user_id`.
- Os valores fixos (prioridade, status...) são `ENUM`s do Postgres.

### 5.4 Diferenças em relação ao banco local do app (SQLite)

O app (`taskflow-app/database/schemas.ts`) tem um modelo diferente. Quando a sincronização for apontada para a API, isso vai precisar ser alinhado:

| Ponto | App (SQLite) | API (Postgres) |
|---|---|---|
| ID do usuário | `TEXT` (UUID do Supabase) | `INTEGER` autoincremento |
| `remote_id` nas tarefas/sessões | existe | não existe |
| `due_date`, `quadrant` (Eisenhower) | existem | não existem |
| `prioritization_sessions` / `prioritization_decisions` | existem | não existem |
| `users.created_at` | existe | não existe |
| status de sessão `in_progress` | usado no `sync.service.ts` | não existe no enum |

---

## 6. Fluxo para subir o projeto

### O que acontece quando você roda `docker compose up --build`

```
1. Docker lê o .env da raiz  →  preenche ${POSTGRES_USER} etc. no compose.yml
2. Sobe o container "db" (Postgres 15) e cria o volume taskflow-pgdata
3. Constrói a imagem da API (Dockerfile):
     npm ci  →  npx prisma generate  →  npm run build  (gera dist/)
4. Sobe o container "api" (só espera o container db INICIAR, não ficar pronto)
5. Comando de início da API:
     npx prisma migrate deploy   ← cria as tabelas no Postgres (só na 1ª vez)
     node dist/main              ← servidor ouvindo em http://localhost:3000
```

### Passo a passo

```bash
# na raiz do repo
cp .env.example .env          # o .env ainda não existe na sua máquina
docker compose up --build     # sobe banco + API

# em outro terminal, conferir
curl http://localhost:3000     # deve responder: Hello World!
docker exec -it taskflow-postgres psql -U taskflow -d taskflow -c '\dt'
                               # deve listar users, tasks, pomodoro_sessions, _prisma_migrations
```

Para desligar: `docker compose down` (mantém os dados) ou `docker compose down -v` (apaga o banco).

### Alternativa: só o banco no Docker, API local (bom para desenvolver)

```bash
docker compose up db -d
cd taskflow-api
npm install
# criar taskflow-api/.env com:
#   DATABASE_URL=postgresql://taskflow:taskflow@localhost:5432/taskflow
npx prisma migrate deploy
npx prisma generate
npm run start:dev
```

> Observação: o app mobile não precisa da API hoje — ele continua usando Supabase + SQLite. Subir o backend agora serve para validar a infraestrutura, não para o app funcionar.

---

## 7. Pontos de atenção (podem fazer a subida falhar)

Não executei o build — estes são riscos encontrados lendo os arquivos, em ordem de probabilidade de dar problema:

1. **`.env` não existe.** Sem ele o compose sobe o Postgres com usuário/senha vazios e o container do banco recusa iniciar. É o primeiro passo obrigatório.

2. **`tsconfig.build.tsbuildinfo` está versionado** e não há `.dockerignore`. Com `incremental: true` + `deleteOutDir: true`, um problema conhecido do Nest/TypeScript é o build achar que "nada mudou" (por causa desse arquivo) e **não gerar a pasta `dist/`** — aí o container quebra com `Cannot find module dist/main`. Se acontecer, a solução é remover esse arquivo do repo/da imagem.

3. **`prisma generate` durante o build da imagem.** O `prisma.config.ts` usa `env('DATABASE_URL')`, que no Prisma 7 lança erro se a variável não existir — e no momento do `docker build` ela não existe (só é passada na execução). Possível falha no passo `RUN npx prisma generate`. O `prisma7.config.ts` usa `process.env[...]`, que não quebra, mas não é o arquivo que o Prisma lê por padrão.

4. **Corrida banco × API.** `depends_on` não espera o Postgres aceitar conexões. Na primeira subida, o `migrate deploy` pode falhar porque o banco ainda está se inicializando. Como a API tem `restart: always`, ela tenta de novo e normalmente acaba subindo — mas os logs vão mostrar erro no início. (Resolve-se com `healthcheck` + `condition: service_healthy`.)

5. **Sem `.dockerignore`**: o `COPY . .` leva para a imagem qualquer `node_modules`, `dist` ou `.env` que existam em `taskflow-api/` na sua máquina, deixando o build mais lento e podendo vazar segredos para a imagem.

6. **Menores:**
   - `version: '3.8'` no `compose.yml` é obsoleto (só gera aviso).
   - `.env.example` está listado no `.gitignore` (mas já está versionado, então segue no repo).
   - `.env.example` tem `DATABASE_URL` sem `?schema=public`; o compose ignora essa linha e monta a própria.
   - README desatualizado: fala em pasta `backend/` (é `taskflow-api/`), Postgres 16 (é 15) e Swagger em `/docs` (não existe).
   - `taskflow-api/README.md` ainda é o README padrão do NestJS.
   - Dois arquivos de config do Prisma (`prisma.config.ts` e `prisma7.config.ts`) — um sobra.

---

## 8. O que falta para o backend ser funcional (visão geral)

1. Conexão com o banco no código: `@prisma/adapter-pg` + `PrismaService`.
2. Módulos CRUD: `tasks`, `pomodoro-sessions`, `users`.
3. Autenticação OAuth (validar token Google/Apple → emitir JWT próprio), conforme o README e o Documento de Arquitetura.
4. Alinhar o schema Prisma com o SQLite do app (tabela 5.4).
5. Trocar no app as chamadas `supabase.from(...)` / `supabase.channel(...)` (em `database/sync/sync.service.ts` e `realtime.service.ts`) e `supabase.auth.*` por chamadas à API (`EXPO_PUBLIC_API_URL`).
