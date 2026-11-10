# 27/10/2026 — Ligação do app com a API Spring (Supabase só para login)

- **Branch:** `feature/backend-spring` (alterações não commitadas)
- **Decisão do usuário:** o Supabase fica **só como provedor de login**; o backend é só o Spring.
- **Metodologia:** testes escritos antes (falharam por classe/método inexistente) e depois a implementação.

## Resumo

O app agora sincroniza tarefas e sessões com a API Spring. O login com Google continua no Supabase; o app troca o token do Supabase por um JWT da API.

## Correção do diagnóstico anterior

A análise anterior dizia que o sync usava o Supabase. Na verdade o `SyncService`, o `TasksService` e o `PomodoroService` **não eram importados por nenhuma tela**: o app só gravava no SQLite e nunca sincronizava. Além disso, `editTask`/`completeTask`/`reopenTask` não marcavam a tarefa como `pending` e `deleteTask` não deixava rastro (o pull traria a tarefa de volta).

## Backend (`taskflow-api-spring/`)

| Item | O que foi feito |
|---|---|
| Migration `V2__task_due_date_quadrant.sql` | `tasks.due_date` e `tasks.quadrant` (CHECK com os 4 quadrantes). Aplicada no banco de dev; `pg_dump` feito antes. |
| Tasks | `dueDate` e `quadrant` em criar/editar/listar. |
| Sessões (`/sessions`) | `POST`, `GET`, `PATCH /{id}`, `DELETE /{id}`. Toda consulta filtra pelo dono; sessão ligada à tarefa de outro usuário dá 404. |
| `POST /auth/supabase-login` | Recebe `{accessToken}` do Supabase, confirma com `GET {SUPABASE_URL}/auth/v1/user` (funciona com qualquer tipo de chave do projeto), acha ou cria o usuário pelo email (minúsculo) e devolve o JWT da API. Sem `SUPABASE_URL`/`SUPABASE_ANON_KEY` responde 503. |
| `compose.yml` / `.env.example` | Variáveis `SUPABASE_URL` e `SUPABASE_ANON_KEY` na API. |

Testes: 49 (eram 35). Novos: `SessionIntegrationTest` (5), `SupabaseAuthTest` (5), `SupabaseLoginIntegrationTest` (3), mais um caso em `TaskIntegrationTest`.

## App (`taskflow-app/`)

| Item | O que foi feito |
|---|---|
| `database/api/client.ts` | `api(método, caminho, corpo)`: troca o token do Supabase pelo da API, reaproveita, renova e repete uma vez no 401. Lê `EXPO_PUBLIC_API_URL`. |
| `database/api/mappers.ts` | snake_case ↔ camelCase; datas do SQLite (`AAAA-MM-DD HH:MM:SS`, UTC sem fuso) viram ISO; só id numérico conta como id da API. |
| `database/sync/sync.service.ts` | Reescrito sobre a API. Ordem: apagados → tarefas (envia, depois baixa) → sessões. A sessão só sobe depois da tarefa dela. Mantém a interface pública (`syncAll`, `syncTask`, `syncSession`, ...). |
| `database/tasks.ts` | Editar, concluir e reabrir marcam `sync_status='pending'` e atualizam `updated_at`. `deleteTask` guarda o id da API na nova tabela `pending_deletes`. |
| `database/schemas.ts` | Tabela `pending_deletes`. |
| `database/context/auth_context.tsx` | Dispara o sync ao entrar, ao voltar para o app e ao reconectar. |
| `database/services/auth.ts` | Não grava mais o perfil na tabela `users` do Supabase (a API guarda o perfil no login). |
| `database/services/session.ts` | `logout` zera o token da API. |
| `database/services/network.service.ts` | Consulta o estado da rede na criação (antes o primeiro sync achava que estava offline). |

Registros antigos com `remote_id` em UUID (Supabase) voltam para a fila e são criados na API no primeiro sync.

Testes do app: 73 passando (`api_client`, `api_mappers`, `sync` novos; `tasks` e `auth` ajustados). `tsc --noEmit`: os mesmos 4 erros de `app/` que já existiam (rotas tipadas).

## Validação no banco real

Container reconstruído; Flyway aplicou a V2 sobre o baseline; login, criação de tarefa com `dueDate`/`quadrant`, sessão ligada à tarefa e o 503 do `supabase-login` sem configuração conferidos com curl. Dados de teste removidos (banco volta a 0 usuários, 0 tarefas, 0 sessões).

## Para a ligação funcionar de ponta a ponta

1. No `.env` da raiz: `SUPABASE_URL` e `SUPABASE_ANON_KEY` (os mesmos valores do app). Depois `docker compose up -d api`.
2. No `.env` do app: `EXPO_PUBLIC_API_URL` com o IP da máquina (no aparelho/emulador `localhost` é o próprio aparelho).

## Limitações conhecidas

- `PATCH` ignora campo `null`: limpar a descrição/prazo no app não limpa no servidor.
- Apagado em outro aparelho não some deste (só o apagado local chega na API).
- Sem sync automático após cada gravação; roda no login, ao voltar para o app e ao reconectar.
- `pomodoro.ts` (`createSession`/`completeSession`) usa a coluna `duration_minutes`, que não existe no schema, e `type: 'break'`, que a API não aceita. O caminho real (`recordCompletedPomodoro`) está correto.
- Código morto ainda chamando o Supabase para dados: `tasks.service.ts`, `pomodoro.service.ts`, `sync.strategy.ts`, `realtime.service.ts`. Nenhuma tela usa; remover com o grupo.
- Não testado: o app em aparelho/emulador e a troca real de token com o Supabase.
