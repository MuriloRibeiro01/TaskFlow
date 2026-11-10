# Análise: plano de endpoints da API (CRUD + autenticação)

Data: 2026-10-14 · Branch: `develop` (commit `0407a26` + mudanças locais em `compose.yml`/`package.json`) · Nenhum código foi alterado.

Continua a [análise do backend e banco](analise-backend-e-banco.md). Os containers já sobem, o `GET /` responde e as tabelas `users`, `tasks` e `pomodoro_sessions` existem no Postgres (vazias).

---

## 1. Resumo

Para ter CRUD + login funcionando e popular o banco com dados de teste, são **5 peças**, nesta ordem:

1. **Conexão com o banco no código:** `PrismaService` com o driver adapter `pg` (obrigatório no Prisma 7).
2. **Auth:** `POST /auth/google` (valida o ID token do Google e devolve um JWT próprio) + `POST /auth/dev-login` (só em desenvolvimento, para testar sem Google) + um `AuthGuard` que protege o resto.
3. **Users:** `GET/PATCH/DELETE /users/me`.
4. **Tasks:** CRUD completo em `/tasks`.
5. **Pomodoro sessions:** CRUD em `/sessions`.

Regra central: **o `userId` sempre vem do JWT, nunca do corpo da requisição.** Cada usuário só enxerga e altera o que é dele.

---

## 2. Dependências a instalar

```bash
cd taskflow-api
npm install @prisma/adapter-pg@7.10.0 pg @nestjs/jwt google-auth-library class-validator class-transformer
npm install -D @types/pg
```

| Pacote | Para quê |
|---|---|
| `@prisma/adapter-pg` + `pg` | o `PrismaClient` do Prisma 7 (gerador `prisma-client`) não instancia sem adapter |
| `@nestjs/jwt` | assinar e verificar o JWT da própria API |
| `google-auth-library` | validar o ID token do Google (`verifyIdToken`) |
| `class-validator` + `class-transformer` | validar os DTOs com o `ValidationPipe` (fronteira de confiança) |

Fica de fora: Passport (um guard de ~15 linhas com `JwtService` resolve, como na doc oficial do Nest), `@nestjs/config` (`process.env` já basta), Swagger (dá para adicionar depois).

Variáveis que a API vai ler (já estão no `.env.example`): `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`. Precisa passar `JWT_SECRET` e `GOOGLE_CLIENT_ID` para o container no `compose.yml` (hoje ele só passa `DATABASE_URL`), mais uma flag `ENABLE_DEV_LOGIN=true` só no ambiente local.

---

## 3. Estrutura de pastas proposta

Segue o padrão do Nest (um módulo por recurso, `nest g resource` gera quase tudo):

```
taskflow-api/src/
├── main.ts                    ← + ValidationPipe global + enableCors
├── app.module.ts              ← importa os módulos abaixo
├── prisma/
│   ├── prisma.module.ts       ← @Global, exporta PrismaService
│   └── prisma.service.ts
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts     ← POST /auth/google, POST /auth/dev-login
│   ├── auth.service.ts        ← valida token Google, upsert do usuário, emite JWT
│   ├── auth.guard.ts          ← lê "Authorization: Bearer", coloca req.user
│   └── current-user.decorator.ts
├── users/   (module, controller, service, dto/update-user.dto.ts)
├── tasks/   (module, controller, service, dto/create-task.dto.ts, dto/update-task.dto.ts)
└── sessions/(module, controller, service, dto/create-session.dto.ts, dto/update-session.dto.ts)
```

---

## 4. Conexão com o banco

`src/prisma/prisma.service.ts`:

```ts
import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor() {
    super({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  }
  onModuleDestroy() {
    return this.$disconnect();
  }
}
```

`src/prisma/prisma.module.ts`: `@Global() @Module({ providers: [PrismaService], exports: [PrismaService] })`. Com isso qualquer service recebe `PrismaService` no construtor.

> Conferir o caminho exato do import depois do `prisma generate`. O schema gera em `src/generated/prisma`, e o Prisma 7 exporta o client em `.../client`.

---

## 5. Autenticação

### 5.1 Como funciona (o que o README já define)

```
App (Expo)                     TaskFlow API                         Google
──────────                     ────────────                         ──────
login Google  ───────────────────────────────────────────────────►  devolve id_token
POST /auth/google {idToken} ──► verifyIdToken(idToken, GOOGLE_CLIENT_ID)
                                 ├─ inválido → 401
                                 └─ ok → upsert users por email
                                         (atualiza display_name, avatar_url)
                              ◄── { accessToken: <JWT>, user }
GET /tasks  + Authorization: Bearer <JWT>
                               AuthGuard: jwt.verify → req.user = { sub: userId }
```

O JWT da API carrega só `{ sub: user.id, email }`, com expiração curta (ex.: `1d` para testes). O refresh token (`JWT_REFRESH_SECRET`) pode esperar: é uma feature separada, não precisa entrar agora.

### 5.2 Login de desenvolvimento (para testar sem Google)

Pegar um `id_token` real do Google pelo curl é chato (dá para fazer pelo [OAuth Playground](https://developers.google.com/oauthplayground), mas o token expira em 1h). Para popular o banco com testes, o caminho prático é:

```
POST /auth/dev-login   { "email": "teste1@taskflow.dev", "displayName": "Teste 1" }
→ faz o mesmo upsert + emite o mesmo JWT, sem validar nada
```

**Isso é uma porta aberta.** Proteções obrigatórias:
- o controller só registra a rota se `process.env.ENABLE_DEV_LOGIN === 'true'` (senão responde 404);
- a flag fica **só** no `.env` local, nunca no `.env.example` com `true`, nunca em produção;
- um teste unitário garantindo o 404 quando a flag não está ligada.

### 5.3 Ponto de atenção do schema

`users` só tem `email` como identificador único. Para o Google funciona (o email vem verificado no token). Para **Apple** não: o usuário pode esconder o email, e ele só vem no primeiro login. Quando chegar a vez da Apple, vale uma migration adicionando `provider` + `provider_id` (único). Para o CRUD de agora, não precisa.

### 5.4 O guard

```ts
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest();
    const [type, token] = req.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer' || !token) throw new UnauthorizedException();
    try {
      req.user = await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException();
    }
    return true;
  }
}
```

Usar `@UseGuards(AuthGuard)` nos controllers de users, tasks e sessions, e um decorator `@CurrentUser()` que devolve `req.user.sub`.

---

## 6. Endpoints

Todos, menos `/auth/*` e `GET /`, exigem `Authorization: Bearer <JWT>`.

### 6.1 Auth

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| POST | `/auth/google` | `{ idToken }` | `200 { accessToken, user }` · `401` token inválido |
| POST | `/auth/dev-login` | `{ email, displayName? }` | `200 { accessToken, user }` · `404` se a flag estiver desligada |

### 6.2 Users

| Método | Rota | Corpo | Resposta |
|---|---|---|---|
| GET | `/users/me` | — | `200 user` |
| PATCH | `/users/me` | `{ displayName?, avatarUrl? }` | `200 user` |
| DELETE | `/users/me` | — | `204` |

Sem `GET /users` (listar todos) nem `POST /users`: o usuário nasce no login. Um endpoint que lista todo mundo vazaria emails.

> **Cuidado com o DELETE:** as FKs são `ON DELETE SET NULL`, então apagar o usuário deixa as tarefas e sessões dele **órfãs** (com `user_id` nulo), não apagadas. Para a limpeza dos testes isso importa (ver seção 8). Se a regra for "apagar a conta apaga tudo", o service deve fazer `deleteMany` de sessions e tasks antes, numa `$transaction`.

### 6.3 Tasks

| Método | Rota | Corpo / query | Resposta |
|---|---|---|---|
| POST | `/tasks` | `CreateTaskDto` | `201 task` |
| GET | `/tasks` | `?status=pending` (opcional) | `200 task[]`, só as do usuário, `createdAt desc` |
| GET | `/tasks/:id` | — | `200 task` · `404` se não existe **ou é de outro usuário** |
| PATCH | `/tasks/:id` | `UpdateTaskDto` | `200 task` · `404` |
| DELETE | `/tasks/:id` | — | `204` · `404` |

DTOs (alinhados com `taskflow-app/database/services/tasks.service.ts`, mas em camelCase como no Prisma):

```ts
export class CreateTaskDto {
  @IsString() @IsNotEmpty() @MaxLength(200) title: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(Priority) priority?: Priority;
  @IsOptional() @IsInt() @Min(1) estimatedPomodoros?: number;
}

export class UpdateTaskDto {
  // mesmos campos, todos @IsOptional(), mais:
  @IsOptional() @IsEnum(TaskStatus) status?: TaskStatus;
  @IsOptional() @IsInt() @Min(0) completedPomodoros?: number;
}
```

Regras no service:
- **Ownership:** usar `findFirst({ where: { id, userId } })` em vez de `findUnique({ where: { id } })`. Se não achar, `NotFoundException` (404, não 403, para não revelar que o id existe).
- `status` passou para `done` → preencher `completedAt = new Date()`. Saiu de `done` → `completedAt = null`.
- `userId`, `syncStatus`, `createdAt` **não** entram nos DTOs. Com `ValidationPipe({ whitelist: true, forbidNonWhitelisted: true })` o cliente não consegue mandar esses campos.
- `:id` com `ParseIntPipe` (o id é `Int`).

O app tem `due_date` e `quadrant`, mas o Postgres ainda não. Ficam fora até a migration de alinhamento (seção 5.4 da análise anterior).

### 6.4 Pomodoro sessions

| Método | Rota | Corpo / query | Resposta |
|---|---|---|---|
| POST | `/sessions` | `{ taskId?, type, startedAt }` | `201 session` |
| GET | `/sessions` | `?taskId=` (opcional) | `200 session[]` do usuário |
| GET | `/sessions/:id` | — | `200` · `404` |
| PATCH | `/sessions/:id` | `{ endedAt?, durationSeconds?, status? }` | `200` · `404` |
| DELETE | `/sessions/:id` | — | `204` · `404` |

Regras:
- Se vier `taskId`, conferir que a task é do usuário, senão `404`. Sem isso dá para pendurar sessão na tarefa de outra pessoa.
- PATCH com `status: completed` e `type: focus` → incrementar `tasks.completedPomodoros` na mesma `$transaction`. É o que o app faz localmente com `completeSession`.
- Uma sessão em andamento fica com `status = null`, porque o enum não tem `in_progress` (diferença já registrada na análise anterior).

---

## 7. Testes (TDD)

Jest já está configurado na API (`npm test`, `npm run test:e2e`). Sugestão mínima, escrita **antes** de cada service:

**Unitários** (Prisma mockado com `{ task: { findFirst: jest.fn(), ... } }`):
- `TasksService.findOne` lança `NotFoundException` quando a task é de outro usuário.
- `TasksService.update` com `status: 'done'` preenche `completedAt`.
- `SessionsService.create` rejeita `taskId` de outro usuário.
- `AuthService.loginWithGoogle` lança `UnauthorizedException` com token inválido (mock do `OAuth2Client.verifyIdToken`).
- `AuthGuard` rejeita sem header, com header sem `Bearer` e com token inválido.
- `dev-login` responde 404 sem `ENABLE_DEV_LOGIN`.

**E2E** (`test/`, contra o Postgres do Docker): dev-login → criar task → listar → editar → apagar; e um segundo usuário recebendo 404 na task do primeiro.

---

## 8. Popular o banco com dados de teste

### 8.1 Rodar a API

Para desenvolver, é mais rápido deixar só o banco no Docker e a API local com hot reload (sem rebuild a cada mudança):

```bash
docker compose up db -d
cd taskflow-api
# taskflow-api/.env (está no .gitignore)
#   DATABASE_URL=postgresql://postgres:<senha>@localhost:5435/taskflow?schema=public
#   JWT_SECRET=qualquer-coisa-longa-para-dev
#   ENABLE_DEV_LOGIN=true
npm run start:dev
```

Porta **5435**: é a que está hoje no seu `compose.yml`. Pare o container `taskflow-nestjs` antes (`docker compose stop api`), senão a porta 3000 conflita.

### 8.2 Requisições pelo terminal

```bash
API=http://localhost:3000

# 1. login de teste → guarda o token
TOKEN=$(curl -s -X POST $API/auth/dev-login \
  -H 'Content-Type: application/json' \
  -d '{"email":"teste1@taskflow.dev","displayName":"Teste 1"}' | jq -r .accessToken)

# 2. criar tarefas
curl -s -X POST $API/tasks -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Estudar Prisma","priority":"high","estimatedPomodoros":4}'
curl -s -X POST $API/tasks -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"Revisar PR do app","priority":"medium"}'

# 3. listar / editar / apagar
curl -s $API/tasks -H "Authorization: Bearer $TOKEN" | jq
curl -s -X PATCH $API/tasks/1 -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"status":"done"}'
curl -s -X DELETE $API/tasks/2 -H "Authorization: Bearer $TOKEN" -i

# 4. sessão pomodoro numa task
curl -s -X POST $API/sessions -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"taskId\":1,\"type\":\"focus\",\"startedAt\":\"$(date -Iseconds)\"}"

# 5. conferir no banco
docker exec -it taskflow-postgres psql -U postgres -d taskflow -c 'select id,title,status,user_id from tasks;'
```

Dá para salvar isso como `taskflow-api/scripts/popular-teste.sh` e rodar quantas vezes quiser. Testar pela API (e não com `INSERT` direto) é o objetivo: assim se exercita validação, auth e ownership de verdade.

Para ver os dados com interface: `npx prisma studio` dentro de `taskflow-api` (com o `.env` local).

### 8.3 Apagar os dados de teste depois

Escolha conforme o que quer manter:

```bash
# só os dados, mantém tabelas e migrations
docker exec -it taskflow-postgres psql -U postgres -d taskflow \
  -c 'TRUNCATE pomodoro_sessions, tasks, users RESTART IDENTITY;'

# tudo (volume inteiro); na próxima subida o migrate deploy recria as tabelas
docker compose down -v
```

Não use `DELETE /users/me` como limpeza: por causa do `ON DELETE SET NULL`, as tarefas e sessões ficam órfãs no banco (seção 6.2).

---

## 9. Ordem de implementação sugerida

| # | Passo | Pronto quando |
|---|---|---|
| 1 | Instalar deps + `PrismaModule` + `ValidationPipe`/CORS no `main.ts` | API sobe e `prisma.user.count()` funciona |
| 2 | `AuthModule`: dev-login + guard + `GET /users/me` | curl da seção 8.2 passo 1 devolve token e `/users/me` responde |
| 3 | `TasksModule` (CRUD + ownership) | testes da seção 7 verdes; segundo usuário recebe 404 |
| 4 | `SessionsModule` | criar/fechar sessão incrementa `completedPomodoros` |
| 5 | `POST /auth/google` | login com `id_token` do OAuth Playground funciona |
| 6 | `compose.yml`: passar `JWT_SECRET`/`GOOGLE_CLIENT_ID` + `healthcheck` no db | `docker compose up --build` sobe sem erro de corrida |

O app mobile continua usando Supabase durante tudo isso. Trocar o app para a API é uma etapa separada, depois que estes endpoints estiverem estáveis.

---

## 10. Riscos e pendências

- **`dev-login` vazar para produção** é o maior risco: login sem senha para qualquer email. Mitigado pela flag + teste (5.2).
- **`JWT_SECRET` fraco ou ausente:** o `JwtModule.register` deve falhar na inicialização se a variável não existir, em vez de assinar com `undefined`.
- **Corrida banco × API** (já registrada antes): no compose, a API pode tentar o `migrate deploy` antes do Postgres aceitar conexões. Passo 6 resolve.
- **Schema desalinhado com o app** (`due_date`, `quadrant`, `remote_id`, id do usuário `TEXT` × `INT`): não bloqueia o CRUD, mas bloqueia a sincronização app ↔ API. Precisa de uma migration própria antes dessa etapa.
- **`.env.example` está no `.gitignore`**, mas já é versionado, então alterações nele continuam indo para o git. A linha no `.gitignore` só confunde; dá para removê-la.
