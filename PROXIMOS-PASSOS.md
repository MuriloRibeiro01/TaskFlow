# TaskFlow — o que falta fazer

Documento de continuação para retomar o trabalho em outra máquina. Estado em **30/10/2026**, branch `feature/backend-spring`.

Leia antes: [actions/2026-10-30-login-google-direto-api.md](actions/2026-10-30-login-google-direto-api.md) (última etapa), [actions/2026-10-27-ligacao-app-api-spring.md](actions/2026-10-27-ligacao-app-api-spring.md) (ligação app ↔ API) e [analises/analise-migracao-spring.md](analises/analise-migracao-spring.md) (decisões da migração).

## Decisões já tomadas (não rediscutir)

- Backend é **só o Spring** (`taskflow-api-spring/`). **Sem Supabase**, nem para o login (decisão de 30/10).
- Login com Google direto na API: o app manda o `idToken` do Google para `POST /auth/google` e recebe o JWT da API (30 dias).
- **Flyway é o único dono do schema.** Migration nova = `V3__...sql` (nunca Prisma, nunca `ddl-auto=update`). Faça `pg_dump` antes de migrar dados reais.
- Metodologia: **testes antes da implementação** e, no fim de cada demanda, um `.md` datado em `actions/`.

## Estado atual

| Parte | Situação |
|---|---|
| API Spring: auth (dev-login e Google), `/users/me`, CRUD de `/tasks`, CRUD de `/sessions` | Pronta. 59 testes (Testcontainers). Rodando no Docker desta máquina. |
| Banco (Postgres 15 no Docker, porta 5435) | Na V2 (`due_date`, `quadrant`). Vazio (0 usuários). |
| App: cliente HTTP, mappers, `SyncService` apontado para a API, gatilhos de sync | Escrito e testado em Jest. **Nunca rodou em aparelho/emulador.** |
| Login com Google ponta a ponta (app → Google → API) | Escrito e testado em Jest/JUnit. **Não validado: faltam os Client IDs do Google.** |

## Falta fazer (em ordem)

### 1. Configurar o Google e validar de ponta a ponta (bloqueia todo o resto)

Já feito nesta máquina: `.env` da raiz, `EXPO_PUBLIC_API_URL=http://192.168.0.179:3000`, `docker compose up -d` (banco na V2, vazio).

- [ ] **Google Cloud Console** (APIs e serviços → Credenciais), no mesmo projeto em que o Supabase tinha o provedor Google, se ainda existir:
  - Tela de consentimento OAuth configurada (modo teste: adicione os emails do grupo como testadores).
  - Client ID **Web application** → vai em `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (app) e em `GOOGLE_CLIENT_IDS` (raiz). O Web Client que o Supabase usava serve.
  - Client ID **Android**: pacote `com.taskflow.app` + SHA-1 da chave de debug (`keytool -list -v -keystore taskflow-app/android/app/debug.keystore -alias androiddebugkey -storepass android -keypass android`). Não vai em `.env`, mas sem ele o Google recusa o app.
  - (iOS, se for usar) Client ID iOS → `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` e também em `GOOGLE_CLIENT_IDS`; o plugin no `app.json` precisa do `iosUrlScheme`.
- [ ] `docker compose up -d api` depois de preencher `GOOGLE_CLIENT_IDS` (sem ele `POST /auth/google` responde 503).
- [ ] **Novo dev build** (entrou código nativo do Google Sign-In; não roda no Expo Go): `cd taskflow-app && npx expo prebuild --clean && npx expo run:android`.
- [ ] Entrar com Google e conferir: criar tarefa → sync → linha em `tasks` no Postgres (`docker exec taskflow-postgres psql ...`).
- [ ] Testar o ciclo completo: editar, concluir, apagar, concluir um pomodoro (gera sessão) e abrir o app em outro aparelho/reinstalar para ver o pull.
- [ ] Se o aparelho não alcançar a API: liberar a porta 3000 no Firewall do Windows.

### 2. Pendências de código no app

- [ ] **Limpar campo no servidor:** o `PATCH` ignora `null`, então apagar descrição/prazo no app não apaga no servidor. Decidir: aceitar o limite ou mudar a API para distinguir "ausente" de "null".
- [ ] **Apagado em outro aparelho não some neste.** Só o apagado local chega na API. Solução provável: coluna `deleted_at` na API (soft delete) ou comparar a lista remota com a local.
- [ ] **Sync após gravar:** hoje só roda no login, ao voltar para o app e ao reconectar. Avaliar disparar após criar/editar.
- [ ] **`database/pomodoro.ts`:** `completeSession`/`cancelSession` usam a coluna `duration_minutes`, que não existe no schema, e `createSession` usa `type: 'break'`, que a API não aceita (`short_break`/`long_break`). O caminho real (`recordCompletedPomodoro`) está certo. Corrigir ou remover.
- [ ] **Tarefas locais antigas:** as criadas com o usuário do Supabase (UUID em `user_id`) não aparecem para o usuário novo da API. Decidir se vale migrar (ex.: adotar no primeiro login as tarefas de outro `user_id`).
- [ ] `tsc --noEmit` tem 4 erros antigos em `app/` (rotas tipadas do expo-router: `/priorizar`, `/historico`, `/estatisticas` e um spread em `index.tsx`). Não vieram desta etapa.

### 3. Pendências de backend

- [x] ~~Timeout e chamada externa dentro da transação~~: resolvido no `GoogleAuth` (JWKS com timeout de 5 s, token conferido antes da transação).
- [ ] Sem **rate limit** em `/auth/google` e `/auth/dev-login`.
- [ ] Sem **refresh token**: o JWT vale 30 dias e depois o app pede o login com Google de novo. Se incomodar, criar `/auth/refresh`.
- [ ] Sem endpoint de **estatísticas/histórico**: o app calcula tudo localmente a partir do SQLite. Só vira necessidade se quiserem dados consolidados no servidor.

### 4. Limpeza do repositório (precisa da aprovação do grupo)

- [ ] **Pasta `taskflow-api/` (NestJS):** está de volta no repositório (125 arquivos versionados). Decidir com o grupo se remove. Se remover, apagar também `prisma7.config.ts`, as referências a Nest/Prisma no `README.md` e `DATABASE_URL` no `.env.example`.
- [ ] Atualizar o `README.md` (ainda descreve NestJS e o Supabase).
- [ ] Abrir PR de `feature/backend-spring` para `main`.

## Como rodar (referência rápida)

```bash
# Banco + API (a API precisa do .env da raiz: POSTGRES_*, JWT_SECRET, ENABLE_DEV_LOGIN, GOOGLE_CLIENT_IDS)
docker compose up -d

# Testes do backend (Docker precisa estar ativo; usa Postgres descartável via Testcontainers)
cd taskflow-api-spring && ./mvnw test

# Testes do app
cd taskflow-app && npx jest
```

**Atenção à RAM:** a máquina anterior tinha ~8 GB e a última sessão foi encerrada por falta de memória. Antes de `./mvnw test`, pare a API (`docker stop taskflow-api`) e não rode Maven e Jest ao mesmo tempo. Use `npx jest --runInBand`.

## Mapa rápido do que mudou nesta etapa (30/10)

- **API:** `auth/GoogleAuth.java` e `auth/GoogleLoginRequest.java` (novos), `POST /auth/google` em `AuthController`; saíram `SupabaseAuth` e `/auth/supabase-login`.
- **App:** `database/services/auth.ts` (Google nativo), `database/api/client.ts` (sessão da API no SecureStore, 401 → login), `database/context/auth_context.tsx`; saiu `database/supabase/` e o código morto do Supabase.
- **Fluxo:** Google (nativo) → `idToken` → `POST /auth/google` → JWT da API (30 dias, salvo no aparelho) → `SyncService` envia pendentes e baixa o resto.
