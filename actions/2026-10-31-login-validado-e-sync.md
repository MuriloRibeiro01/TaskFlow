# 31/10/2026 — Login validado de ponta a ponta, login obrigatório e correções do sync

- **Branch:** `feature/backend-spring`
- **Metodologia:** testes escritos antes (falharam) e depois a implementação. Exceção: o bloqueio de login não tem teste automatizado (motivo abaixo).

## Validação de ponta a ponta

No emulador Android, com o dev build: login com Google → `POST /auth/google` criou o usuário na API (id 2, `murilo.ribeiro2709@gmail.com`) → tarefa "CHurrasco" criada no app → sync → linha em `tasks` no Postgres com `user_id = 2`, e no SQLite `sync_status = synced`, `remote_id = 2`.

O que precisou ser resolvido no caminho:

| Problema | Causa | Solução |
|---|---|---|
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID não definido` | Metro iniciado antes de o `.env` ser preenchido | `npx expo start --dev-client --clear` |
| `/auth/google` respondia 503 | ID posto em `GOOGLE_CLIENT_ID` (singular, sobra do NestJS) | Valor copiado para `GOOGLE_CLIENT_IDS` |
| Google Cloud: "nome do pacote e impressão digital já estão em uso" | `com.taskflow.app` + chave de debug padrão (pública, igual em todo projeto Expo) já cadastrados em outro projeto | Pacote trocado para `br.edu.ucb.taskflow` (`app.json`, Android e iOS) |
| `DEVELOPER_ERROR` | 1) testado o app antigo, ainda instalado; 2) `.env` com o ID de outro cliente, não o Web | Desinstalado o antigo; ID do "Cliente Web 1" nos dois `.env` |
| Container da API não parava (processo zumbi) | Docker Desktop | `docker rm -f` e recriado |

## App (`taskflow-app/`)

| Item | O que foi feito |
|---|---|
| `components/navigation/root-stack.tsx` (novo) | Login obrigatório de volta: `Stack.Protected` libera o app só com sessão e a tela de login só sem. Login, "Sair" e sessão expirada trocam de tela sozinhos. Mostra um carregando enquanto lê a sessão salva. `app/_layout.tsx` passa a usá-lo. |
| `database/sync/sync.service.ts` | **Bug corrigido:** o envio pegava pendentes de qualquer dono (`user_id IS NOT NULL`); com duas contas no mesmo aparelho, as tarefas de uma subiam para a outra. Agora filtra pelo usuário logado. Tarefas e sessões sem dono (criadas antes de existir login) passam a ser do usuário logado. Pedido de sync durante outro sync roda de novo no fim, em vez de se perder. |
| `database/sync/sync_trigger.ts` (novo) | Cada gravação local avisa; com usuário logado, o sync roda ~1,5 s depois da última gravação (gravações seguidas viram um sync só). |
| `database/tasks.ts`, `database/pomodoro.ts` | Criar, editar, concluir, reabrir, apagar tarefa e registrar pomodoro disparam o gatilho. |
| `database/services/prioritization.service.ts` | **Bug corrigido:** aplicar a priorização mudava quadrante e prioridade sem marcar `sync_status = 'pending'`, então nunca chegava à API. Agora marca e dispara o gatilho. |
| `database/context/auth_context.tsx` | Escuta o gatilho enquanto há usuário logado. |
| `app.json` | Pacote `br.edu.ucb.taskflow`; removido `edgeToEdgeEnabled` (obrigatório no Android 16). |

Testes do app: 85 (eram 72): `sync_trigger` (4), sync (dono, adoção, sync simultâneo), gatilho em `tasks`/`pomodoro`/`prioritization`.

**Bloqueio de login sem teste automatizado:** o `renderRouter` do expo-router precisa do `@testing-library/react-native` 13, que exige um React diferente do 19.2.3 do projeto; a versão 14 tem `render` assíncrono e é incompatível com o `renderRouter`. Validado à mão no emulador.

## Estado do backend (revisão)

Completo para o que o app usa: auth (Google e dev-login), `/users/me`, CRUD de `/tasks` e `/sessions`, isolamento por dono, Flyway na V2. Pendências registradas no `PROXIMOS-PASSOS.md`: `PATCH` não limpa campo, sem soft delete (apagado não se propaga entre aparelhos), sync baixa tudo sempre, sem rate limit, sem refresh token.

## Não testado

- O sync logo após gravar no aparelho (coberto só em Jest).
- Editar, concluir, apagar, pomodoro e priorização chegando ao Postgres no aparelho.
