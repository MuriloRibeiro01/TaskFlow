# 30/10/2026 — Login com Google direto na API (Supabase removido)

- **Branch:** `feature/backend-spring` (alterações não commitadas)
- **Decisão do usuário:** o Supabase sai **por completo**. O backend é só o Spring, inclusive no login. Isso substitui a decisão de 27/10 (Supabase só para login) e retoma o passo 5 do plano original (Google direto na API).
- **Metodologia:** testes escritos antes (falharam por classe/método inexistente) e depois a implementação.

## Fluxo novo

Google nativo no app (`@react-native-google-signin/google-signin`) → `idToken` → `POST /auth/google` → a API confere o token com as chaves públicas do Google → JWT da API (30 dias), salvo no SecureStore.

## Backend (`taskflow-api-spring/`)

| Item | O que foi feito |
|---|---|
| `auth/GoogleAuth.java` (novo) | Confere o ID token: assinatura pelas chaves públicas do Google (JWKS, timeout de 5 s), emissor (`accounts.google.com`), `aud` em um dos `GOOGLE_CLIENT_IDS`, validade e `email_verified`. Sem client ids responde 503. |
| `POST /auth/google` | Recebe `{idToken}`, acha ou cria o usuário pelo email (minúsculo) e devolve o JWT. O token é conferido **no controller, antes da transação**: a chamada ao Google não segura conexão do banco (pendência antiga do `supabase-login`). |
| Removidos | `SupabaseAuth`, `POST /auth/supabase-login`, variáveis `SUPABASE_*` (compose, `application.yml`, `.env.example`). |
| `AuthService.TOKEN_TTL` | 1 dia → 30 dias. Sem o Supabase não há como renovar sozinho; ao expirar, o app pede o login de novo. |
| Configuração | `GOOGLE_CLIENT_IDS` (vírgula) no `.env` da raiz e no `compose.yml`. |

Testes: 59 (eram 49). Saíram `SupabaseAuthTest` (5) e `SupabaseLoginIntegrationTest` (3). Entraram `GoogleAuthTest` (12, com tokens assinados por uma chave RSA local, sem rede), `GoogleLoginIntegrationTest` (4) e 2 casos em `AuthControllerTest`.

## App (`taskflow-app/`)

| Item | O que foi feito |
|---|---|
| `database/services/auth.ts` | Reescrito: `GoogleSignin.signIn()` → `idToken` → `loginWithGoogle`. Cancelar devolve `null`. Erro claro sem `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` ou sem `idToken`. |
| `database/api/client.ts` | Guarda a sessão da API (`{accessToken, user}`) no SecureStore e a lê na abertura (funciona offline). No 401 apaga a sessão e avisa o contexto (`onSessionExpired`). `user.id` vira texto: é o que as tarefas locais guardam em `user_id`. |
| `database/context/auth_context.tsx` | Usa a sessão da API em vez do `onAuthStateChange` do Supabase. Volta para o login quando a sessão expira. |
| `database/services/session.ts` | `logout` sai do Google e apaga a sessão. `saveLocalUser` recebe o usuário da API. |
| `database/sync/sync.service.ts` | Dono dos dados locais = usuário da sessão da API. |
| `app/(tabs)/perfil.tsx` | Nome e foto vêm de `displayName`/`avatarUrl`. |
| `app.json` | Plugin do Google Sign-In; removido o intent filter do callback OAuth. |
| Removidos | `database/supabase/` (cliente e polyfills; o `secure_storage.ts` foi para `database/api/`), código morto que chamava o Supabase (`tasks.service.ts`, `pomodoro.service.ts`, `sync.strategy.ts`, `realtime.service.ts`), rotas `app/test-auth.tsx` e `app/auth/callback.tsx`. Pacotes `@supabase/supabase-js`, `react-native-url-polyfill`, `expo-auth-session`, `expo-crypto`. |

Testes do app: 72 passando (`api_client` e `auth` reescritos; `sync` e `secure_storage` ajustados). `tsc --noEmit`: nos arquivos alterados só os erros antigos de rotas tipadas (`/priorizar`, `/historico`, `/estatisticas`).

## Ambiente nesta máquina

- `.env` da raiz criado; `docker compose up -d` com banco novo (Flyway aplicou V1 e V2).
- `EXPO_PUBLIC_API_URL=http://192.168.0.179:3000` no `.env` do app.
- API reconstruída: `POST /auth/google` responde 503 (falta `GOOGLE_CLIENT_IDS`), `dev-login`, tarefas e sessões conferidos com curl pelo IP da rede. Dados de teste removidos (0 usuários, 0 tarefas).

## Limitações conhecidas

- Sem refresh token: o JWT vale 30 dias e depois o usuário entra com Google de novo.
- Tarefas locais criadas com o usuário do Supabase (UUID em `user_id`) não aparecem para o usuário novo da API (id numérico).
- O Google Sign-In nativo não roda no Expo Go: precisa de dev build.
- Não testado: login real com Google (faltam os Client IDs) e o app em aparelho.
