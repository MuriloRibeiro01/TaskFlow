# 29/09/2026 — Correção do fluxo de autenticação OAuth (Google + Supabase)

- **Branch:** `Backend` (alterações não commitadas)
- **Base:** [analises/analise-autenticacao-oauth.md](../analises/analise-autenticacao-oauth.md)
- **Metodologia:** TDD. Os testes foram escritos antes e falharam (13 falhas); depois veio a implementação até ficarem verdes.

## Resumo

O login com Google agora completa o fluxo PKCE: o `code` devolvido pelo navegador é trocado por uma sessão via `exchangeCodeForSession`. O projeto voltou a compilar, a proteção de rotas usa `Stack.Protected` e a sessão persiste mesmo passando do limite de 2 KB do SecureStore.

## Itens da análise aplicados

| Item | O que foi feito | Arquivos |
|---|---|---|
| 3.1 | A vírgula do `app.json` já tinha sido corrigida localmente pelo Murilo. Só validei com `expo config`. | `app.json` |
| 3.2 | Removido o import duplicado de `initDatabase` e a chamada duplicada no `useEffect`. Importado o `StatusBar`. `polyfills` movido para a primeira linha. | `app/_layout.tsx` |
| 3.3 | `exchangeCodeForSession(code)` após o `openAuthSessionAsync`. Nova função `extractAuthParams(url)` lê `?code`/`#error` do redirect. Erros do provedor e ausência de `code` viram exceções com mensagem clara. | `database/services/auth.ts` |
| 3.4 | A tela de callback não faz mais `getSession()` nem compete com o login. Ela espera o `user` do contexto e vai para `/(tabs)`, ou volta após 10s se o login falhar. | `app/auth/callback.tsx` |
| 3.5 | Não aplicado: as credenciais foram confirmadas como corretas. | — |
| 4.1 | Falha no upsert de `public.users` só gera log e não derruba mais o login. `saveLocalUser` é chamado uma vez só. | `database/services/auth.ts` |
| 4.2 | Erro no login mostra um `Alert` e mantém o usuário na tela de login, em vez de ir para a `not-found-page`. Imports não usados removidos. | `app/login.tsx` |
| 4.3 | `isLoading` do contexto agora representa só a restauração inicial da sessão. `signIn`/`signOut` não desmontam mais a navegação. | `database/context/auth_context.tsx` |
| 4.4 | `Stack.Protected` com `guard={!!user}` para `(tabs)` e `nova-tarefa`, e `guard={!user}` para `login`. Removidos os `useEffect` de redirecionamento das telas. | `app/_layout.tsx`, `app/(tabs)/index.tsx`, `app/login.tsx` |
| 4.5 | O contexto usa só o `onAuthStateChange` (o `INITIAL_SESSION` lê a sessão local e funciona offline). Removido `restoreLocalUser`. Auto-refresh do token ligado ao `AppState`. | `auth_context.tsx`, `services/session.ts`, `supabase/supabase.ts` |
| 4.6 | Novo adapter `chunkedSecureStorage`: divide a sessão em pedaços de até 1800 bytes UTF-8, é compatível com sessões salvas no formato antigo e limpa os pedaços que sobram. | `database/supabase/secure_storage.ts` (novo), `supabase/supabase.ts` |
| 4.7 | Removidos os logs de URL/anon key e o log que imprimia a sessão com tokens. | `supabase/supabase.ts`, `services/auth.ts` |
| 4.8 | `createTask` exige `user_id` e grava `sync_status = 'pending'`. `getAllTasks(userId)` filtra por usuário. As telas passam o `user.id` do `useAuth()`. | `database/tasks.ts`, `app/nova-tarefa.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/timer.tsx` |

### Decisão diferente do que a análise sugeria (4.8)
A análise sugeria **limpar o SQLite no logout**. Não fiz isso: a sincronização com o Supabase ainda não está ligada no app, então apagar no logout **perderia tarefas de forma permanente**. O isolamento entre usuários ficou garantido pelo filtro `WHERE user_id = ?`. Quando o sync estiver ativo, vale rever.

## Testes criados/alterados

| Arquivo | Casos |
|---|---|
| `database/__tests__/auth.test.ts` (novo) | 13 casos: `extractAuthParams` (query, fragmento com decodificação, vazio); `userAuthentication` (sessão existente, parâmetros do OAuth, troca do code, save local único + upsert, cancelamento, erro do provedor, sem code, falha na troca, upsert não fatal, URL ausente). |
| `database/__tests__/secure_storage.test.ts` (novo) | 9 casos: valor pequeno, chave inexistente, divisão respeitando o limite de bytes (com acentos e emoji), chaves válidas para o SecureStore, encolhimento, `removeItem`, leitura e sobrescrita do formato antigo, pedaço faltando. |
| `database/__tests__/tasks.test.ts` | `createTask` grava `user_id` e `sync_status`; `getAllTasks(userId)` filtra por usuário. |

## Validação

| Verificação | Resultado |
|---|---|
| `npx jest` | 36 de 37 passando. A única falha é `CompleteTask`, que **já falhava antes** desta demanda: o texto esperado no teste tem dois espaços antes de `WHERE`. |
| `npx tsc --noEmit` | Sem erros (antes: 3 erros no `_layout.tsx`). |
| `npx expo config` | `app.json` válido. |
| `npx expo export --platform android` | Bundle Hermes gerado com sucesso (6,66 MB). Confirma que o app monta sem erro de import/sintaxe. |
| `npx eslint app database` | Nenhum aviso novo. Os 2 erros e 12 avisos restantes já existiam (ex.: `key` faltando em `(tabs)/index.tsx:332`). |

**Não validado:** o login ponta a ponta num dispositivo (sem emulador disponível). Roteiro para testar no celular:
1. `npx expo run:android --device` (ou um APK de dev via EAS) e depois `npx expo start --dev-client`.
2. Tocar em "Entrar com Google", escolher a conta e conferir que o app cai nas abas.
3. Fechar e reabrir o app: deve abrir direto nas abas (sessão persistida).
4. Criar uma tarefa e conferir no SQLite/log que ela tem `user_id`.
5. Cancelar o login no navegador: deve continuar na tela de login, sem alerta.

## Pendências (fora do escopo desta demanda)
- Teste `CompleteTask` com o texto esperado incorreto.
- Tarefas criadas **antes** desta mudança têm `user_id = NULL` e não aparecem mais na lista (só afeta dados de teste locais).
- `app/test-auth.tsx` continua acessível; remover antes da entrega.
- `handleLogout` em `(tabs)/index.tsx` não está ligado a nenhum botão.
- `pomodoro_sessions` ainda não recebe `user_id` na criação.
- Itens menores da seção 5 da análise (`intentFilters` desnecessários, PKCE `plain` sem `crypto.subtle`, arquivos soltos).
