# Demo local sem tela de login (2026-11-11)

**Demanda:** mostrar o fluxo de priorização com IA rodando localmente, sem precisar do login do Google.

## O que mudou
| Arquivo | Mudança |
|---|---|
| `taskflow-app/database/api/client.ts` | `loginWithGoogle` e o novo `loginDev(email)` passam a usar a função `login(path, body)`, que guarda a sessão igual nos dois casos. `loginDev` chama `POST /auth/dev-login`. |
| `taskflow-app/database/context/auth_context.tsx` | Sem sessão salva e com `EXPO_PUBLIC_DEV_LOGIN_EMAIL` definida, o app faz o dev-login sozinho ao abrir. Sem a variável, nada muda. |
| `taskflow-app/database/__tests__/api_client.test.ts` | 2 testes novos de `loginDev` (escritos antes): sessão salva e 404 sem salvar nada. |
| `taskflow-app/eas.json` | Perfis `development` e `preview` (APK) para o build na nuvem. |
| `.env`, `taskflow-app/.env`, `.env.example` | As `EXPO_PUBLIC_*` passaram para `taskflow-app/.env`, único que o Expo lê. |

## Verificação
`npx jest`: 12 suítes, 106 testes passando. `npx tsc --noEmit`: os erros que aparecem já existiam: `global`/`Buffer` nos testes e `use-theme-color.ts`. Nenhum vem do código novo.

## Cuidado
`ENABLE_DEV_LOGIN=true` na API abre o dev-login para qualquer um. Usar só na rede local e desligar depois.
