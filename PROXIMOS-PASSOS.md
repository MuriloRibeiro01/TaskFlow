# TaskFlow — o que falta fazer

Documento de continuação para retomar o trabalho em outra máquina. Estado em **30/10/2026**, branch `feature/backend-spring`.

Leia antes: [actions/2026-10-27-ligacao-app-api-spring.md](actions/2026-10-27-ligacao-app-api-spring.md) (o que foi feito) e [analises/analise-migracao-spring.md](analises/analise-migracao-spring.md) (decisões da migração).

## Decisões já tomadas (não rediscutir)

- Backend é **só o Spring** (`taskflow-api-spring/`). O Supabase fica **apenas como provedor de login** (Google).
- O app troca o token do Supabase por um JWT da API em `POST /auth/supabase-login`.
- **Flyway é o único dono do schema.** Migration nova = `V3__...sql` (nunca Prisma, nunca `ddl-auto=update`). Faça `pg_dump` antes de migrar dados reais.
- Metodologia: **testes antes da implementação** e, no fim de cada demanda, um `.md` datado em `actions/`.

## Estado atual

| Parte | Situação |
|---|---|
| API Spring: auth (dev-login e supabase-login), `/users/me`, CRUD de `/tasks`, CRUD de `/sessions` | Pronta. 49 testes (Testcontainers). |
| Banco (Postgres 15 no Docker, porta 5435) | Na V2 (`due_date`, `quadrant`). Vazio (0 usuários). |
| App: cliente HTTP, mappers, `SyncService` apontado para a API, gatilhos de sync | Escrito e testado em Jest. **Nunca rodou em aparelho/emulador.** |
| Login com Google ponta a ponta (app → Supabase → API) | **Não validado.** |

## Falta fazer (em ordem)

### 1. Configurar e validar a ligação de ponta a ponta (bloqueia todo o resto)

- [ ] No `.env` da raiz, preencher `SUPABASE_URL` e `SUPABASE_ANON_KEY` (os mesmos valores do app). Sem eles `POST /auth/supabase-login` responde 503.
- [ ] No `.env` do app, definir `EXPO_PUBLIC_API_URL` com o **IP da máquina** (ex.: `http://192.168.0.10:3000`). No aparelho/emulador `localhost` é o próprio aparelho.
- [ ] Reconstruir a API: `docker compose build api && docker compose up -d api`. A imagem atual **não tem** a correção de segurança abaixo (email confirmado).
- [ ] Rodar o app, entrar com Google e conferir: criar tarefa → sync → linha em `tasks` no Postgres (`docker exec taskflow-postgres psql ...`).
- [ ] Testar o ciclo completo: editar, concluir, apagar, concluir um pomodoro (gera sessão) e abrir o app em outro aparelho/reinstalar para ver o pull.
- [ ] Confirmar que `GET /user` do Supabase devolve `email_confirmed_at` para contas do Google (a API agora exige isso; se vier vazio, o login dá 401).

### 2. Pendências de código no app

- [ ] **Limpar campo no servidor:** o `PATCH` ignora `null`, então apagar descrição/prazo no app não apaga no servidor. Decidir: aceitar o limite ou mudar a API para distinguir "ausente" de "null".
- [ ] **Apagado em outro aparelho não some neste.** Só o apagado local chega na API. Solução provável: coluna `deleted_at` na API (soft delete) ou comparar a lista remota com a local.
- [ ] **Sync após gravar:** hoje só roda no login, ao voltar para o app e ao reconectar. Avaliar disparar após criar/editar.
- [ ] **`database/pomodoro.ts`:** `completeSession`/`cancelSession` usam a coluna `duration_minutes`, que não existe no schema, e `createSession` usa `type: 'break'`, que a API não aceita (`short_break`/`long_break`). O caminho real (`recordCompletedPomodoro`) está certo. Corrigir ou remover.
- [ ] **Código morto que ainda chama o Supabase para dados:** `database/services/tasks.service.ts`, `database/services/pomodoro.service.ts`, `database/sync/sync.strategy.ts`, `database/sync/realtime.service.ts`. Nenhuma tela usa. Remover **com aprovação do grupo**.
- [ ] `tsc --noEmit` tem 4 erros antigos em `app/` (rotas tipadas do expo-router: `/priorizar`, `/historico`, `/estatisticas` e um spread em `index.tsx`). Não vieram desta etapa.

### 3. Pendências de backend

- [ ] `SupabaseAuth` não tem **timeout**: um Supabase lento segura a requisição e uma conexão do banco (o `supabaseLogin` é `@Transactional` e faz a chamada HTTP dentro da transação). Configurar timeout e, de preferência, verificar o token antes de abrir a transação.
- [ ] Sem **rate limit** em `/auth/supabase-login` e `/auth/dev-login`.
- [ ] Passo 5 original do plano (Google direto na API) ficou **descartado** pela decisão de manter o Supabase como login.
- [ ] Sem endpoint de **estatísticas/histórico**: o app calcula tudo localmente a partir do SQLite. Só vira necessidade se quiserem dados consolidados no servidor.

### 4. Limpeza do repositório (precisa da aprovação do grupo)

- [ ] **Pasta `taskflow-api/` (NestJS) aparece apagada no `git status` (125 arquivos), sem commit.** Não foi feito pelo trabalho desta etapa que eu saiba. Está **fora do commit** feito agora. Decidir: `git restore taskflow-api` (voltar) ou commitar a remoção. Se for removida, apagar também `prisma7.config.ts` e referências a Nest/Prisma no `README.md` e no `.env.example` (`DATABASE_URL`, `JWT_REFRESH_SECRET`, `GOOGLE_CLIENT_ID`, `APPLE_CLIENT_ID` já não são usados pelo Spring).
- [ ] Atualizar o `README.md` (ainda descreve NestJS).
- [ ] Abrir PR de `feature/backend-spring` para `main`.

## Como rodar (referência rápida)

```bash
# Banco + API (a API precisa do .env da raiz: POSTGRES_*, JWT_SECRET, ENABLE_DEV_LOGIN, SUPABASE_*)
docker compose up -d

# Testes do backend (Docker precisa estar ativo; usa Postgres descartável via Testcontainers)
cd taskflow-api-spring && ./mvnw test

# Testes do app
cd taskflow-app && npx jest
```

**Atenção à RAM:** a máquina anterior tinha ~8 GB e a última sessão foi encerrada por falta de memória. Antes de `./mvnw test`, pare a API (`docker stop taskflow-api`) e não rode Maven e Jest ao mesmo tempo. Use `npx jest --runInBand`.

## Mapa rápido do que mudou nesta etapa

- **API:** `taskflow-api-spring/src/main/java/com/taskflow/api/` → `session/` (novo), `auth/SupabaseAuth.java` e `auth/SupabaseLoginRequest.java` (novos), `task/Quadrant.java` (novo); migration `src/main/resources/db/migration/V2__task_due_date_quadrant.sql`.
- **App:** `taskflow-app/database/api/` (`client.ts`, `mappers.ts`), `database/sync/sync.service.ts` (reescrito), `database/tasks.ts` (marca `pending`, guarda deletes em `pending_deletes`), `database/context/auth_context.tsx` (dispara o sync).
- **Fluxo:** Google → Supabase (login) → `POST /auth/supabase-login` → JWT da API (vale 1 dia, renovado sozinho no 401) → `SyncService` envia pendentes e baixa o resto.
