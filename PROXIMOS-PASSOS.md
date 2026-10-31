# TaskFlow — o que falta fazer

Documento de continuação para retomar o trabalho em outra máquina. Estado em **31/10/2026**, branch `feature/backend-spring`.

Leia antes: [actions/2026-10-31-login-validado-e-sync.md](actions/2026-10-31-login-validado-e-sync.md) (última etapa), [actions/2026-10-30-login-google-direto-api.md](actions/2026-10-30-login-google-direto-api.md) (login com Google na API), [actions/2026-10-27-ligacao-app-api-spring.md](actions/2026-10-27-ligacao-app-api-spring.md) (ligação app ↔ API) e [analises/analise-migracao-spring.md](analises/analise-migracao-spring.md) (decisões da migração).

## Decisões já tomadas (não rediscutir)

- Backend é **só o Spring** (`taskflow-api-spring/`). **Sem Supabase**, nem para o login (decisão de 30/10).
- Login com Google direto na API: o app manda o `idToken` do Google para `POST /auth/google` e recebe o JWT da API (30 dias).
- **Flyway é o único dono do schema.** Migration nova = `V3__...sql` (nunca Prisma, nunca `ddl-auto=update`). Faça `pg_dump` antes de migrar dados reais.
- Metodologia: **testes antes da implementação** e, no fim de cada demanda, um `.md` datado em `actions/`.

## Estado atual

| Parte | Situação |
|---|---|
| API Spring: auth (dev-login e Google), `/users/me`, CRUD de `/tasks`, CRUD de `/sessions` | Pronta. 59 testes (Testcontainers). Rodando no Docker desta máquina. |
| Banco (Postgres 15 no Docker, porta 5435) | Na V2 (`due_date`, `quadrant`). Com 1 usuário e 1 tarefa vindos do app. |
| App: cliente HTTP, mappers, `SyncService`, gatilhos de sync (inclusive logo após gravar), login obrigatório | 85 testes em Jest. Rodando no emulador (dev build `br.edu.ucb.taskflow`). |
| Login com Google ponta a ponta (app → Google → API) | **Validado em 31/10:** login no emulador criou o usuário na API e a tarefa criada no app chegou ao Postgres. |

## Falta fazer (em ordem)

### 1. Terminar a validação de ponta a ponta

Feito em 31/10: Client IDs no Google Cloud (Web + Android `br.edu.ucb.taskflow`), `.env` da raiz e do app, dev build, login com Google e uma tarefa criada no app chegando ao Postgres.

- [ ] Conferir o sync **logo após gravar** no aparelho (criar uma tarefa e ver no Postgres em ~2 s, sem sair do app).
- [ ] Testar o resto do ciclo: editar, concluir, apagar, concluir um pomodoro (gera sessão), aplicar uma priorização e reinstalar o app para ver o pull.
- [ ] Cada integrante do grupo: adicionar o email como **usuário de teste** na tela de consentimento OAuth (modo teste) e rodar com o próprio `.env`.

**Armadilhas já vistas** (para quem for configurar em outra máquina):
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` e `GOOGLE_CLIENT_IDS` levam o ID do cliente do tipo **Aplicativo da Web**, não o do Android nem o do iOS (os três começam com o mesmo número). ID errado → `DEVELOPER_ERROR`.
- O Metro só lê o `.env` ao iniciar: depois de mudar o `.env` do app, `npx expo start --dev-client --clear`.
- A API lê `GOOGLE_CLIENT_IDS` (plural); `GOOGLE_CLIENT_ID` é sobra do NestJS.
- Ao trocar o pacote, o app antigo continua instalado com o mesmo nome e ícone: desinstale (`adb uninstall com.taskflow.app`).
- Se o aparelho não alcançar a API: liberar a porta 3000 no Firewall do Windows.

### 2. Pendências de código no app

- [ ] **Limpar campo no servidor:** o `PATCH` ignora `null`, então apagar descrição/prazo no app não apaga no servidor. Decidir: aceitar o limite ou mudar a API para distinguir "ausente" de "null".
- [ ] **Apagado em outro aparelho não some neste.** Só o apagado local chega na API. Solução provável: coluna `deleted_at` na API (soft delete) ou comparar a lista remota com a local.
- [x] ~~Sync após gravar~~: feito em 31/10 (cada gravação agenda um sync ~1,5 s depois).
- [ ] **`database/pomodoro.ts`:** `completeSession`/`cancelSession` usam a coluna `duration_minutes`, que não existe no schema, e `createSession` usa `type: 'break'`, que a API não aceita (`short_break`/`long_break`). O caminho real (`recordCompletedPomodoro`) está certo. Corrigir ou remover.
- [ ] **Tarefas locais antigas do Supabase** (UUID em `user_id`) não aparecem para o usuário novo da API. As **sem dono** (`user_id` vazio) já são adotadas no sync desde 31/10; as com UUID, não. Só afeta aparelhos que usaram a versão com Supabase.
- [ ] **Conflito entre aparelhos:** existe `ConflictResolver`, mas nada marca `sync_status = 'conflict'`. Na prática vale a última edição enviada.
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
