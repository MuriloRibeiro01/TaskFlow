# Análise — Fluxo de autenticação OAuth (Google + Supabase)

- **Data:** 29/09/2026
- **Branch analisada:** `Backend` (commit `6c91ceb`)
- **Escopo:** login com Google via Supabase OAuth (PKCE) no app Expo/React Native.
- **Como foi feita:** o app não foi executado no emulador. Li o código, rodei `tsc --noEmit`, `jest` e o parse do `app.json`, e conferi o comportamento do `@supabase/auth-js` 2.101.1 direto em `node_modules`.

---

## 1. Veredito

**O login com Google não funciona no estado atual.** São dois tipos de problema:

1. **O projeto não compila nem faz prebuild.** O `app.json` é um JSON inválido e o `app/_layout.tsx` tem erros de TypeScript e de módulo. O app não abriria no emulador.
2. **Mesmo corrigindo isso, o fluxo OAuth quebra no final.** O Supabase está configurado com `flowType: 'pkce'`, mas o código nunca chama `exchangeCodeForSession`. O navegador volta com um `?code=...` que ninguém troca por uma sessão. Com isso, o `getUser()` retorna `AuthSessionMissingError`, o `signIn` lança erro e a tela de login manda o usuário para a `not-found-page`.

A estrutura geral está no caminho certo: `AuthProvider` com contexto, sessão guardada no `SecureStore`, `skipBrowserRedirect` + `openAuthSessionAsync`, redirect com scheme próprio e upsert do perfil. Os problemas estão em pontos específicos e são corrigíveis.

---

## 2. Fluxo atual (como o código está)

```
LoginScreen.handleLogin
  └─ AuthContext.signIn()            → setLoading(true)  (desmonta a Stack, ver 4.3)
       └─ userAuthentication()       (database/services/auth.ts)
            1. makeRedirectUri → taskflow://auth/callback
            2. getSession()          → se já existir, retorna o usuário
            3. signInWithOAuth({ provider: 'google', skipBrowserRedirect: true })
                 → gera o code_verifier (PKCE) e salva no SecureStore
            4. WebBrowser.openAuthSessionAsync(url, redirectUri)
                 → usuário loga no Google → Supabase → taskflow://auth/callback?code=XYZ
            5. result.type === 'success'
            6. ❌ supabase.auth.getUser()  ← não existe sessão, o code não foi trocado
                 → AuthSessionMissingError → throw
  └─ catch em LoginScreen → router.replace('/not-found-page')

Em paralelo (Android): o deep link também abre a rota app/auth/callback.tsx
  └─ getSession() → null → router.replace('/login')
```

---

## 3. Problemas bloqueantes (impedem build ou login)

### 3.1 `app.json` inválido: falta uma vírgula
[taskflow-app/app.json:61-62](../taskflow-app/app.json#L61-L62)

```json
"expo-font"
"expo-web-browser"
```

Validado com `JSON.parse`: `SyntaxError: Expected ',' or ']' after array element (line 62)`. Nem `expo start` nem `expo prebuild` / `run:android` passam desse ponto.

**Correção:** `"expo-font",`

### 3.2 `app/_layout.tsx` não compila
Saída do `npx tsc --noEmit`:

```
app/_layout.tsx(18,10): error TS2300: Duplicate identifier 'initDatabase'.
app/_layout.tsx(21,10): error TS2300: Duplicate identifier 'initDatabase'.
app/_layout.tsx(73,8): error TS2552: Cannot find name 'StatusBar'.
```

- [_layout.tsx:18](../taskflow-app/app/_layout.tsx#L18) e [_layout.tsx:21](../taskflow-app/app/_layout.tsx#L21): `initDatabase` é importado duas vezes. No Babel/Metro isso também dá erro de sintaxe ("Identifier has already been declared"), não é só aviso de tipo.
- [_layout.tsx:73](../taskflow-app/app/_layout.tsx#L73): `<StatusBar>` é usado sem `import { StatusBar } from 'expo-status-bar'`. Daria crash em runtime.
- De quebra, `initDatabase()` é chamado duas vezes: no escopo do módulo (linha 24) e no `useEffect` (linha 63). Não quebra por causa do `IF NOT EXISTS`, mas é redundante.

### 3.3 Falta trocar o `code` PKCE por sessão (causa raiz do login falhar)
[taskflow-app/database/services/auth.ts:48-55](../taskflow-app/database/services/auth.ts#L48-L55)

Com `flowType: 'pkce'` ([supabase.ts:33](../taskflow-app/database/supabase/supabase.ts#L33)), o Supabase redireciona para `taskflow://auth/callback?code=...`. O próprio comentário no `supabase.ts` diz que isso é "necessário para exchangeCodeForSession funcionar", mas a função nunca é chamada. Conferi no `auth-js` instalado:

- `getUser()` sem sessão salva retorna `{ user: null, error: AuthSessionMissingError }` (`GoTrueClient.js:2474`);
- o `code_verifier` fica no storage esperando o `_exchangeCodeForSession` (`GoTrueClient.js:1445`).

**Correção sugerida** (logo após o `openAuthSessionAsync`):

```ts
if (result.type !== 'success') return null;

const { queryParams } = Linking.parse(result.url);   // expo-linking
const errorDescription = queryParams?.error_description;
if (errorDescription) throw new Error(String(errorDescription));

const code = queryParams?.code;
if (typeof code !== 'string') throw new Error('Código OAuth ausente no retorno.');

const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);
if (error) throw error;
const user = session.user;
```

A partir daí o `onAuthStateChange` dispara `SIGNED_IN` e o contexto atualiza sozinho.

### 3.4 A rota `auth/callback` concorre com o fluxo principal
[taskflow-app/app/auth/callback.tsx](../taskflow-app/app/auth/callback.tsx)

No Android, o deep link `taskflow://auth/callback?code=...` também é entregue ao expo-router, que monta essa tela. Ela chama `getSession()` na hora (ainda sem sessão) e faz `router.replace('/login')`. Isso acontece em paralelo com o `userAuthentication()`. O resultado é navegação imprevisível e, se a troca do código for colocada aqui também, o mesmo `code` seria usado duas vezes (o segundo uso falha).

**Recomendação:** trocar o código em **um lugar só**. O mais simples é fazer isso em `userAuthentication()` e deixar a tela de callback só com o spinner, redirecionando quando `user` aparecer no contexto:

```tsx
const { user, isLoading } = useAuth();
useEffect(() => { if (!isLoading) router.replace(user ? '/(tabs)' : '/login'); }, [user, isLoading]);
```

### 3.5 Configuração externa (não dá para validar pelo código, conferir manualmente)
- **Supabase Dashboard → Authentication → URL Configuration → Redirect URLs:** precisa conter `taskflow://auth/callback` (ou `taskflow://**`). Se não estiver lá, o Supabase ignora o `redirectTo` e manda para a *Site URL*. O `openAuthSessionAsync` nunca recebe o retorno e o resultado fica `dismiss`/`cancel`, ou seja, login "silenciosamente" sem efeito.
- **Supabase → Providers → Google:** habilitado, com Client ID/Secret de um cliente OAuth do tipo **Web application**.
- **Google Cloud Console → Authorized redirect URIs:** `https://<projeto>.supabase.co/auth/v1/callback`.
- **Build:** usar dev build (`expo-dev-client`, que já está instalado). No Expo Go o `makeRedirectUri` gera `exp://...`, que teria que estar na allowlist também.
- **`.env`:** `EXPO_PUBLIC_SUPABASE_REDIRECT_URL` e `EXPO_PUBLIC_GOOGLE_CLIENT_ID` estão definidos mas não são usados no código. O `.env.example` na raiz não os lista, e o `.env` real fica em `taskflow-app/`. Vale alinhar os dois.

---

## 4. Problemas importantes (não bloqueiam, mas vão causar bugs)

### 4.1 Falha no upsert do perfil derruba o login inteiro
[auth.ts:70-81](../taskflow-app/database/services/auth.ts#L70-L81)

Se a tabela `public.users` não existir no Supabase, ou se a RLS não permitir `insert`/`update` com `auth.uid() = id`, o `throw profileError` faz o `signIn` falhar **mesmo com a sessão já criada**. O `onAuthStateChange` coloca o `user` no contexto, mas o `LoginScreen` cai no `catch` e navega para `not-found-page`. O estado fica inconsistente.

- Não há migrations/SQL no repositório para conferir a tabela e as policies. **Verificar no dashboard.**
- Recomendo tratar o erro do upsert como não fatal (logar e seguir) ou mover isso para um trigger `on auth.users insert` no próprio Supabase, que é o padrão recomendado.
- O `saveLocalUser(user)` é chamado duas vezes ([linha 66](../taskflow-app/database/services/auth.ts#L66) e [linha 69](../taskflow-app/database/services/auth.ts#L69), sendo a segunda sem `await`). O `if (user)` da linha 68 também é redundante, porque a linha 62 já garante isso.

### 4.2 Erro de login leva para a tela "This screen doesn't exist"
[login.tsx:36-39](../taskflow-app/app/login.tsx#L36-L39)

Qualquer erro (usuário cancelou, rede caiu, RLS) manda para `/not-found-page`. O commit `5fa68da` descreve isso como debug, mas para o usuário final é confuso. Melhor mostrar um `Alert` ou o `Toast` que já existe em `components/notifications/Toast.tsx` e continuar na tela de login.

Também tem um import que sobrou: `import { isLoading } from 'expo-font'` ([login.tsx:12](../taskflow-app/app/login.tsx#L12)). Ele é sombreado pela desestruturação do `useAuth`, então não quebra, mas o comentário em `auth_context.tsx:86` mostra que isso já causou bug antes. Vale remover, junto com `Router` e `NotFoundScreen`, que também não são usados.

### 4.3 `isLoading` global desmonta a navegação durante o login
[auth_context.tsx:60](../taskflow-app/database/context/auth_context.tsx#L60) + [_layout.tsx:33-39](../taskflow-app/app/_layout.tsx#L33-L39)

O `signIn` faz `setLoading(true)`. O `RootLayoutNav` vê `isLoading` e troca a `<Stack>` inteira por um spinner, o que **desmonta a tela de login** (e o `isLoggingIn` local vira inútil). Quando o login termina, a Stack é recriada do zero. O mesmo acontece no `signOut`.

**Recomendação:** `isLoading` do contexto deve representar só a *restauração inicial da sessão*. O estado "logando…" deve ficar local na tela (o `isLoggingIn` já existe para isso).

### 4.4 Proteção de rotas: usar `Stack.Protected`
[_layout.tsx:42-49](../taskflow-app/app/_layout.tsx#L42-L49)

Renderizar `<Stack.Screen>` condicionalmente **não bloqueia rotas** no expo-router. Todas as rotas de arquivo continuam acessíveis (`/nova-tarefa`, `/test-auth`, `/(tabs)/timer`...). Hoje a proteção depende do `useEffect` em `(tabs)/index.tsx` e em `login.tsx`, o que gera "flash" de tela e redirecionamentos duplicados (logout chama `router.replace('/login')` e o effect também).

O projeto usa expo-router 6, que já tem `Stack.Protected`:

```tsx
<Stack screenOptions={{ headerShown: false }}>
  <Stack.Protected guard={!!user}>
    <Stack.Screen name="(tabs)" />
    <Stack.Screen name="nova-tarefa" />
  </Stack.Protected>
  <Stack.Protected guard={!user}>
    <Stack.Screen name="login" />
  </Stack.Protected>
  <Stack.Screen name="auth/callback" />
</Stack>
```

Com isso dá para remover os `useEffect` de redirecionamento das telas.

### 4.5 Restauração da sessão e modo offline
[session.ts:29-41](../taskflow-app/database/services/session.ts#L29-L41) + [auth_context.tsx:25-41](../taskflow-app/database/context/auth_context.tsx#L25-L41)

- `restoreLocalUser()` usa `getUser()`, que **faz requisição de rede**. Offline, ele retorna `null` e o código cai no `getSession()` (local). Funciona, mas por acaso. O nome sugere que o usuário é lido do SQLite, o que não acontece: o SQLite só é escrito, nunca lido para autenticação.
- `checkUser()` e o evento `INITIAL_SESSION` do `onAuthStateChange` fazem o mesmo trabalho e disputam o `setUser`/`setLoading`. Dá para simplificar e confiar só no `onAuthStateChange` (ele emite `INITIAL_SESSION` ao registrar) e usar o `getUser()` apenas para validar em segundo plano.
- Falta ligar o auto-refresh ao ciclo de vida do app, como recomenda a doc do Supabase para React Native:
  ```ts
  AppState.addEventListener('change', (s) =>
    s === 'active' ? supabase.auth.startAutoRefresh() : supabase.auth.stopAutoRefresh());
  ```

### 4.6 `SecureStore` tem limite de ~2048 bytes por valor
[supabase.ts:13-25](../taskflow-app/database/supabase/supabase.ts#L13-L25)

A sessão do Supabase serializada (access token + refresh token + objeto `user` com `user_metadata` e `identities` do Google) costuma passar de 2 KB. O `expo-secure-store` avisa e, dependendo da versão/dispositivo, pode falhar ao gravar. Aí a sessão não persiste e o usuário precisa logar toda vez que abre o app.

**Recomendação:** o padrão da doc do Supabase é guardar a sessão criptografada com AES no AsyncStorage/SQLite e deixar só a chave no SecureStore. Uma alternativa mais simples é quebrar o valor em pedaços (chunking).

### 4.7 Logs sensíveis
- [auth.ts:19](../taskflow-app/database/services/auth.ts#L19): `console.log("Sessão encontrada:", session)` imprime **access_token e refresh_token** no log. Remover.
- [supabase.ts:9-10](../taskflow-app/database/supabase/supabase.ts#L9-L10): imprime URL e anon key a cada import. A anon key é pública, mas é ruído. Remover.

### 4.8 Logout não limpa dados locais / tarefas não estão ligadas ao usuário
- [session.ts:11-13](../taskflow-app/database/services/session.ts#L11-L13): o `logout()` só chama `signOut()`. As tabelas `users`, `tasks` e `pomodoro_sessions` do SQLite continuam lá, então outro usuário que logar no mesmo aparelho vê os dados do anterior.
- `createTask` ([database/tasks.ts:9](../taskflow-app/database/tasks.ts#L9)) não recebe `user_id`, e `getAllTasks()` não filtra por usuário. Como o `sync.service.ts` só sincroniza linhas com `user_id IS NOT NULL`, **nenhuma tarefa criada pela UI vai sincronizar com o Supabase**. Não é bug da autenticação em si, mas é o próximo ponto de integração depois que o login funcionar: passar `user.id` do `useAuth()` para o `createTask`.

---

## 5. Pontos menores

| Local | Observação |
|---|---|
| [app.json:26-39](../taskflow-app/app.json#L26-L39) | `intentFilters` com `autoVerify: true` só faz sentido para App Links `https`. Para scheme customizado, o `"scheme": "taskflow"` já registra o deep link, então esse bloco é desnecessário. |
| [auth.ts:6](../taskflow-app/database/services/auth.ts#L6) e [test-auth.tsx:10](../taskflow-app/app/test-auth.tsx#L10) | `maybeCompleteAuthSession()` só tem efeito na web. Não atrapalha, mas está duplicado. |
| [polyfills.ts](../taskflow-app/database/supabase/polyfills.ts) | Só faz polyfill de `getRandomValues`. Sem `crypto.subtle`, o auth-js usa o método PKCE `plain` em vez de `S256` e avisa "WebCrypto API is not supported" no console. Funciona, mas é menos seguro. |
| [_layout.tsx:11,16](../taskflow-app/app/_layout.tsx#L11) | `react-native-url-polyfill/auto` é importado duas vezes (direto e via `polyfills.ts`). O ideal é importar `polyfills` como **primeira** linha do layout. |
| [app/test-auth.tsx](../taskflow-app/app/test-auth.tsx) | Rota de teste acessível em produção. Remover ou proteger antes da entrega. |
| [components/test_backend/icon-session.tsx](../taskflow-app/components/test_backend/icon-session.tsx) | Arquivo vazio. |
| `taskflow-app/dk install java 17.0.14-te` | Arquivo com nome de comando versionado por engano. |
| [(tabs)/_layout.tsx:9](../taskflow-app/app/(tabs)/_layout.tsx#L9) | `strokeWidth` não é prop do `Ionicons` (é do lucide). |
| `jest` | 1 teste falhando em `database/__tests__/tasks.test.ts:61` (`completeTask`). Não tem relação com auth, mas o CI vai ficar vermelho. |

---

## 6. Ordem sugerida de correção

1. Vírgula no `app.json` (3.1).
2. Imports do `_layout.tsx`: remover o `initDatabase` duplicado, importar `StatusBar` e colocar `polyfills` no topo (3.2).
3. `exchangeCodeForSession` no `userAuthentication` (3.3) e simplificar o `auth/callback.tsx` (3.4).
4. Conferir Redirect URLs / Google provider no dashboard (3.5).
5. Upsert do perfil não fatal + conferir tabela/RLS `public.users` (4.1).
6. Tratamento de erro na tela de login (4.2) e `isLoading` só para a restauração inicial (4.3).
7. `Stack.Protected` (4.4).
8. Limite do SecureStore (4.6) e remoção dos logs sensíveis (4.7).
9. `user_id` nas tarefas e limpeza no logout (4.8).

Com os passos 1–4 o login deve completar. Os passos 5–7 deixam o fluxo robusto.

---

## 7. Como testar sem emulador (sugestões para a falta de RAM)

- **Celular físico via USB/Wi-Fi com dev build:** o `npx expo run:android --device` compila no PC mas roda no aparelho, e economiza a RAM do emulador. Outra opção é gerar o APK de dev na nuvem com `eas build --profile development --platform android` e instalar no celular. Aí só roda o Metro no PC (`npx expo start --dev-client`).
- **Teste unitário do fluxo:** dá para mockar `expo-web-browser` (retornando `{ type: 'success', url: 'taskflow://auth/callback?code=abc' }`) e o `supabase.auth`, e verificar com Jest que o `exchangeCodeForSession('abc')` é chamado e que o erro do upsert não derruba o login. O projeto já usa `jest-expo`.
- **Validação estática antes de cada commit:** `npx tsc --noEmit` teria pego os erros do 3.2. Vale colocar no CI junto com o `npm test`.
