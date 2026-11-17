# TaskFlow — o que falta fazer

Documento de continuação para retomar o trabalho em outra máquina. Estado em **14/11/2026**, branch `develop`.

**Para rodar:** `npm run doctor` (confere tudo) e `npm run demo` (sobe e abre o app). Roteiro do dia da apresentação no `README.md`.

Leia antes: [actions/2026-11-14-doctor-demo-apk.md](actions/2026-11-14-doctor-demo-apk.md) (última etapa), [actions/2026-10-31-login-validado-e-sync.md](actions/2026-10-31-login-validado-e-sync.md), [actions/2026-10-30-login-google-direto-api.md](actions/2026-10-30-login-google-direto-api.md) (login com Google na API), [actions/2026-10-27-ligacao-app-api-spring.md](actions/2026-10-27-ligacao-app-api-spring.md) (ligação app ↔ API) e [analises/analise-migracao-spring.md](analises/analise-migracao-spring.md) (decisões da migração).

## Decisões já tomadas (não rediscutir)

- Backend é **só o Spring** (`taskflow-api-spring/`). **Sem Supabase**, nem para o login (decisão de 30/10).
- **O login com Google foi removido** (17/11): o acesso é por e-mail e senha (`POST /auth/register` e `/auth/login`), mais o `dev-login` só para demo local. O JWT é da própria API.
- **Flyway é o único dono do schema.** Migration nova = `V3__...sql` (nunca Prisma, nunca `ddl-auto=update`). Faça `pg_dump` antes de migrar dados reais.
- Metodologia: **testes antes da implementação** e, no fim de cada demanda, um `.md` datado em `actions/`.

## Estado atual

| Parte | Situação |
|---|---|
| API Spring: auth (e-mail/senha e dev-login), `/users/me`, CRUD de `/tasks`, CRUD de `/sessions` | Pronta. 59 testes (Testcontainers). Rodando no Docker desta máquina. |
| Banco (Postgres 15 no Docker, porta 5435) | Na V2 (`due_date`, `quadrant`). Com 1 usuário e 1 tarefa vindos do app. |
| App: cliente HTTP, mappers, `SyncService`, gatilhos de sync (inclusive logo após gravar), login obrigatório | 85 testes em Jest. Rodando no emulador (dev build `br.edu.ucb.taskflow`). |
| Login ponta a ponta (app → API) | Validado em 31/10 com o login antigo (Google, já removido): o usuário foi criado na API e a tarefa do app chegou ao Postgres. Refazer a validação com e-mail e senha. |

## Falta fazer (em ordem)

### 1. Terminar a validação de ponta a ponta

Feito em 31/10 (com o login antigo): `.env` da raiz e do app, dev build e uma tarefa criada no app chegando ao Postgres.

- [x] ~~Sync logo após gravar no aparelho~~: confirmado em 14/11.
- [ ] Testar o resto do ciclo: editar, concluir, apagar, concluir um pomodoro (gera sessão), aplicar uma priorização e reinstalar o app para ver o pull.
- [ ] Cada integrante do grupo: rodar com o próprio `.env`.

**Armadilhas já vistas** (para quem for configurar em outra máquina):
- O Metro só lê o `.env` ao iniciar: depois de mudar o `.env` do app, `npx expo start --dev-client --clear`.
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

- [x] ~~Rate limit em `/auth/*`~~: feito (`AuthRateLimit`).
- [ ] Sem **refresh token**: o JWT vale 30 dias e depois o app pede o login de novo. Se incomodar, criar `/auth/refresh`.
- [ ] Sem endpoint de **estatísticas/histórico**: o app calcula tudo localmente a partir do SQLite. Só vira necessidade se quiserem dados consolidados no servidor.

### 4. Limpeza do repositório (precisa da aprovação do grupo)

- [x] **Pasta `taskflow-api/` (NestJS):** removida (commit `363167a`), junto com o `prisma7.config.ts`, as referências do `README.md`/`compose.yml` e o `DATABASE_URL` do `.env.example`. Falta o grupo ser avisado.
- [x] `README.md` sem menção a NestJS nem ao Supabase.
- [ ] Abrir PR de `feature/backend-spring` para `main`.

## Como rodar (referência rápida)

```bash
# Banco + API (a API precisa do .env da raiz: POSTGRES_*, JWT_SECRET, ENABLE_DEV_LOGIN)
docker compose up -d

# Testes do backend (Docker precisa estar ativo; usa Postgres descartável via Testcontainers)
cd taskflow-api-spring && ./mvnw test

# Testes do app
cd taskflow-app && npx jest
```

**Atenção à RAM:** a máquina anterior tinha ~8 GB e a última sessão foi encerrada por falta de memória. Antes de `./mvnw test`, pare a API (`docker stop taskflow-api`) e não rode Maven e Jest ao mesmo tempo. Use `npx jest --runInBand`.

## Mapa rápido do que mudou nesta etapa (30/10, histórico: o login com Google foi removido depois)

- **API:** `auth/GoogleAuth.java` e `auth/GoogleLoginRequest.java` (novos), `POST /auth/google` em `AuthController`; saíram `SupabaseAuth` e `/auth/supabase-login`.
- **App:** `database/services/auth.ts` (Google nativo), `database/api/client.ts` (sessão da API no SecureStore, 401 → login), `database/context/auth_context.tsx`; saiu `database/supabase/` e o código morto do Supabase.
- **Fluxo:** Google (nativo) → `idToken` → `POST /auth/google` → JWT da API (30 dias, salvo no aparelho) → `SyncService` envia pendentes e baixa o resto.
