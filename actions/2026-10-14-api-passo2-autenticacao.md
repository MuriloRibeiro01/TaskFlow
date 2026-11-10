# 14/10/2026 — API: passo 2 (autenticação com JWT, dev-login e `/users/me`)

- **Branch:** `develop` (alterações não commitadas)
- **Base:** [analises/analise-endpoints-crud-e-auth.md](../analises/analise-endpoints-crud-e-auth.md), seções 5 e 9 (passo 2)
- **Metodologia:** TDD. Os 5 arquivos de teste unitário e o e2e foram escritos antes e falharam (`Cannot find module`); depois veio a implementação até ficarem verdes.

## Resumo

A API agora emite e valida o próprio JWT:
- `POST /auth/dev-login` cria o usuário (ou reaproveita o existente) e devolve um token. Só funciona com `ENABLE_DEV_LOGIN=true`.
- `GET /users/me` só responde com `Authorization: Bearer <token>`.
- A API **não sobe** sem um `JWT_SECRET` de pelo menos 32 caracteres.

O login com Google (`POST /auth/google`) é o passo 5 do plano e não entrou aqui. Ele vai reaproveitar o mesmo upsert e a mesma emissão de token.

## Endpoints

| Método | Rota | Corpo | Respostas |
|---|---|---|---|
| POST | `/auth/dev-login` | `{ email, displayName? }` | `200 { accessToken, user }` · `400` email inválido ou campo extra · `404` flag desligada |
| GET | `/users/me` | — | `200 user` · `401` sem token / token inválido / expirado · `404` usuário apagado |

```bash
TOKEN=$(curl -s -X POST localhost:3000/auth/dev-login -H 'Content-Type: application/json' \
  -d '{"email":"teste1@taskflow.dev","displayName":"Teste 1"}' | jq -r .accessToken)
curl -s localhost:3000/users/me -H "Authorization: Bearer $TOKEN"
```

## O que foi feito

| Item | O que foi feito | Arquivos |
|---|---|---|
| Opções do JWT | `jwtOptionsFactory` lê `JWT_SECRET`, exige ≥ 32 caracteres e define expiração de `1d`. Usado no `JwtModule.registerAsync`, então a validação roda na inicialização da API, e não quando o arquivo é importado. | `src/auth/jwt-options.ts` |
| `AuthService.devLogin` | Normaliza o email (`trim` + minúsculas), faz `upsert` por email e assina `{ sub: user.id, email }`. Não apaga o `displayName` quando ele não é enviado. | `src/auth/auth.service.ts` |
| `DevLoginDto` | `@IsEmail` + `@MaxLength(254)`; `displayName` opcional até 100 caracteres. Qualquer outro campo é rejeitado pelo `ValidationPipe` do passo 1. | `src/auth/dto/dev-login.dto.ts` |
| `AuthController` | `POST /auth/dev-login` com `200`. Responde `404` se `ENABLE_DEV_LOGIN` não for exatamente `"true"`. A flag é lida a cada requisição. | `src/auth/auth.controller.ts` |
| `AuthGuard` | Exige `Bearer <token>`, verifica assinatura e expiração e coloca o payload em `req.user`. Qualquer falha vira `401`, sem detalhar o motivo. | `src/auth/auth.guard.ts` |
| `@CurrentUser()` | Decorator que devolve `req.user` (`{ sub, email }`) nos controllers protegidos. | `src/auth/current-user.decorator.ts` |
| `AuthModule` | Registra o JWT e exporta `AuthGuard` + `JwtModule` para os próximos módulos (tasks, sessions). | `src/auth/auth.module.ts` |
| `UsersModule` | `GET /users/me` com `@UseGuards(AuthGuard)`. `findMe` responde `404` se o usuário do token já foi apagado. | `src/users/*` |
| `AppModule` | Importa `AuthModule` e `UsersModule`. | `src/app.module.ts` |
| Docker | O `compose.yml` passa `JWT_SECRET` e `ENABLE_DEV_LOGIN` (padrão `false`) para a API. | `compose.yml` |
| `.env.example` | Comentário de como gerar o `JWT_SECRET`; `ENABLE_DEV_LOGIN=false` com aviso. | `.env.example` |
| `.env` local | O `JWT_SECRET` estava **vazio**: gerei um com `openssl rand -hex 32` (64 caracteres, não exibido). Adicionei `ENABLE_DEV_LOGIN=true` para os testes. | `.env` (fora do git) |
| Setup dos e2e | `test/setup-env.ts` carrega o `.env` e define um `JWT_SECRET` só de teste. Sem isso, o `app.e2e-spec.ts` original deixaria de subir o `AppModule`. | `test/setup-env.ts`, `test/jest-e2e.json` |

## Testes criados

| Arquivo | Casos |
|---|---|
| `src/auth/jwt-options.spec.ts` | 3: sem segredo → erro; segredo < 32 caracteres → erro; segredo válido + expiração definida. |
| `src/auth/auth.service.spec.ts` | 4: email normalizado no `where`; `displayName` ausente não sobrescreve; `displayName` enviado atualiza e cria; token com `sub` = id. |
| `src/auth/auth.guard.spec.ts` | 5: sem header; esquema `Basic`; token assinado com outro segredo (forjado); token expirado; token válido preenche `req.user`. |
| `src/auth/auth.controller.spec.ts` | 6: `404` com a flag `undefined`, `''`, `'false'`, `'1'` e `'TRUE '` (sem chamar o service); chama o service com `'true'`. |
| `src/users/users.service.spec.ts` | 2: devolve o usuário; `404` quando o usuário do token não existe. |
| `test/auth.e2e-spec.ts` (banco real) | 5: `404` com a flag desligada **e nada gravado**; `400` com email inválido e com campo extra; login → `/users/me`; login repetido em maiúsculas **não duplica** o usuário; `401` sem token e com token inválido. Usa um email único (`e2e-<timestamp>@taskflow.test`) e **apaga o próprio usuário no `afterAll`**. |

## Validação

| Comando | Resultado |
|---|---|
| `npm test` | 8 suítes, **28 testes passando** |
| `npm run test:e2e` | 3 suítes, **7 testes passando**; `users` com 0 linhas depois (limpeza ok) |
| `npm run lint` / `npm run build` | sem erros; `dist/main.js` gerado |
| `docker compose up --build -d` | logs mapeiam `POST /auth/dev-login` e `GET /users/me` |
| curl no container | dev-login → token; `/users/me` → usuário; sem token → `401`; `{"sub":1}` no corpo → `400 property sub should not exist`. O usuário criado pelo curl foi apagado. |

## Riscos e possíveis soluções

| # | Risco | Impacto | Solução |
|---|---|---|---|
| 1 | **`dev-login` ligado = login como qualquer email, sem senha.** A porta 3000 está aberta na rede (de propósito, para o celular), então quem estiver no mesmo Wi-Fi pode entrar como qualquer usuário enquanto a flag estiver `true`. | Acesso total às tarefas de qualquer conta de teste. | A flag só aceita exatamente `"true"` (testado), o padrão no compose é `false` e o `.env.example` vem com `false`. **Desligue no seu `.env` quando não estiver testando.** Antes de qualquer deploy, conferir que a variável não existe no ambiente. |
| 2 | **Token sem revogação.** O JWT vale por 1 dia e não existe logout no servidor nem lista de tokens revogados. | Um token vazado continua válido até expirar. Se o usuário for apagado, o token ainda passa no guard, mas o `/users/me` responde `404`. | Aceitável para a fase atual. Quando entrar o refresh token (`JWT_REFRESH_SECRET`), reduzir o access token para ~15 min. |
| 3 | **Trocar o `JWT_SECRET` desloga todo mundo.** | Todos os tokens emitidos passam a dar `401`. | É o comportamento esperado, e também a forma de invalidar tudo se o segredo vazar. Guardar o segredo só no `.env`, nunca no git. |
| 4 | **Emails com maiúsculas já gravados.** A normalização só vale daqui para frente. Se alguém tiver inserido `A@x.com` direto no banco, um login com `a@x.com` cria uma segunda conta. | Contas duplicadas. | O banco está vazio hoje, então não há o que migrar. Para garantir no banco, um índice único em `lower(email)` (migration) impede a duplicação mesmo fora da API. |
| 5 | **e2e grava no banco de desenvolvimento.** | Se um teste quebrar no meio, o `afterAll` ainda roda, mas uma interrupção forçada (Ctrl+C) pode deixar um usuário `e2e-...@taskflow.test`. | Os emails usam o domínio `.test`, reservado e fácil de achar: `delete from users where email like 'e2e-%@taskflow.test'`. No futuro, um banco separado só para testes (`taskflow_test`). |
| 6 | **Apple sem email.** O upsert é por email. | Login com Apple (email escondido) não vai funcionar com esse modelo. | Migration com `provider` + `provider_id` únicos quando a Apple entrar (seção 5.3 da análise). |
| 7 | **`expiresIn` fixo no código (`1d`).** | Mudar exige deploy. | Se precisar ajustar por ambiente, ler de uma variável. Não fiz agora porque ninguém pediu. |

## Próximo passo

Passo 3: `TasksModule` (CRUD em `/tasks`), com ownership pelo `sub` do token: tarefa de outro usuário responde `404`.
