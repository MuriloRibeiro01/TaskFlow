# Análise: migração do backend de NestJS para Spring Boot

Data: 2026-10-14 · Branch: `develop` (passos 1–3 da API Nest ainda não commitados) · Nenhum código foi alterado nesta análise.

Base: [plano de endpoints](analise-endpoints-crud-e-auth.md) e os logs em `actions/2026-10-14-*`, que servem de **especificação**: cada regra e cada teste do Nest tem que existir no Spring.

---

## 1. Resumo

A migração é viável e barata **agora**: a API Nest tem ~470 linhas de código e ~720 de testes, distribuídas em 3 módulos (auth, users, tasks), e o app ainda não chama a API. O banco **não muda**: mesmo Postgres, mesmas tabelas e mesmos dados. O Spring passa a gerenciar as migrations com o Flyway, partindo de um *baseline* do schema que o Prisma criou.

**Impacto no frontend: nenhum hoje.** O app não consome a API. O contrato HTTP (rotas, JSON, status) é mantido para que, quando o app passar a usar a API, tanto faz qual backend responde.

---

## 2. Ambiente encontrado

| Item | Situação |
|---|---|
| JDK local | Temurin **17.0.14** |
| Maven / Gradle | não instalados → usar o **Maven Wrapper** (`mvnw`, baixa o Maven sozinho) |
| Spring Boot | **4.1.1** (versão estável padrão do Spring Initializr hoje) |
| Docker | disponível; **Testcontainers** pode subir um Postgres descartável para os testes |
| RAM livre | ~1,2 GB de 7,6 GB → limitar o heap do Maven e dos testes (`-Xmx512m`) |

---

## 3. Decisões

| # | Decisão | Por quê |
|---|---|---|
| D1 | Projeto novo em **`taskflow-api-spring/`**. A pasta `taskflow-api/` (Nest) **não é apagada**. | O código Nest dos passos 1–3 ainda não foi commitado; apagar agora perderia esse trabalho. A remoção fica para quando o grupo aprovar a troca. |
| D2 | O serviço `api` do `compose.yml` passa a construir o Spring. | Só pode haver um backend na porta 3000. |
| D3 | **Flyway** com `baseline-on-migrate` na versão 1. O `migration.sql` do Prisma vira o `V1__init.sql`. | Banco já existente: o Flyway marca a V1 como aplicada e **não roda nada**. Banco novo: roda a V1 e cria tudo. Nenhum dado é tocado nos dois casos. |
| D4 | `spring.jpa.hibernate.ddl-auto=validate` | O Hibernate **nunca altera o schema**: só confere, na inicialização, se as entidades batem com as tabelas. Se não baterem, a API não sobe. Nada de `update`/`create`, que poderiam apagar ou alterar colunas. |
| D5 | Enums Java com os **mesmos nomes do Postgres** (`low`, `in_progress`...), mapeados como `NAMED_ENUM`. | O JSON continua igual ao do Nest sem conversores. Foge da convenção Java (maiúsculas), mas elimina uma camada de tradução e uma fonte de bug. |
| D6 | Datas como `Instant`, gravadas em `TIMESTAMP(3)` (sem fuso) em **UTC**, truncadas para milissegundos. | Mesma coluna e mesmo formato JSON do Nest (`2026-10-14T19:17:46.117Z`). |
| D7 | JWT **HS256** assinado e validado pelo Spring Security (`oauth2-resource-server` + Nimbus). | Componente padrão e testado do Spring, em vez de um filtro escrito à mão. |
| D8 | Testes de integração com **Testcontainers**. | Resolve o risco 5 do passo 2 e o risco 7 do passo 3: os testes deixam de gravar no banco de desenvolvimento. |
| D9 | Java **17** no código e na imagem Docker. | É o JDK instalado; mesma versão no build local e no container. |

---

## 4. Mapeamento Nest → Spring

| Nest (hoje) | Spring Boot |
|---|---|
| `prisma/schema.prisma` + `PrismaService` | Entidades JPA (`User`, `Task`, `PomodoroSession`) + `JpaRepository` |
| `prisma/migrations/.../migration.sql` | `src/main/resources/db/migration/V1__init.sql` (cópia literal) |
| `PrismaService` falha sem `DATABASE_URL` | o DataSource falha sem `DATABASE_URL`, via placeholder obrigatório no `application.yml` |
| `ValidationPipe({ whitelist, forbidNonWhitelisted, transform })` | Bean Validation (`@Valid`) + Jackson com `FAIL_ON_UNKNOWN_PROPERTIES` e sem coerção de tipos (`"4"` não vira `4`) |
| `enableCors()` | `CorsConfigurationSource` liberando qualquer origem (auth por header, sem cookies) |
| `jwtOptionsFactory` (≥ 32 caracteres, `1d`) | `JwtConfig`: valida o segredo na inicialização e cria `JwtEncoder`/`JwtDecoder` |
| `AuthGuard` + `@CurrentUser()` | `SecurityFilterChain` (tudo protegido, exceto `/` e `/auth/**`) + `@AuthenticationPrincipal Jwt` |
| `AuthService.devLogin` (upsert por email normalizado) | `AuthService.devLogin` (`findByEmail` → cria ou atualiza, numa `@Transactional`) |
| `ENABLE_DEV_LOGIN === 'true'` → senão 404 | mesma regra, lida por `@Value` |
| `UsersService.findMe` | `UserService.findMe` |
| `ParseIdPipe` (1 a 2.147.483.647) | `@PathVariable @Min(1) Integer id` (acima do `INT`, a conversão para `Integer` já falha → 400) |
| `TasksService` (ownership, regra do `completedAt`) | `TaskService` com `findByIdAndUserId` / `deleteByIdAndUserId` |
| Respostas de erro do Nest | `@RestControllerAdvice` + `AuthenticationEntryPoint` com o mesmo formato |
| Jest + supertest | JUnit 5 + MockMvc + AssertJ + Testcontainers |
| `Dockerfile` (Node 22) | `Dockerfile` multi-stage: Temurin 17 JDK (build) → Temurin 17 JRE (execução) |

---

## 5. Contrato HTTP a preservar

| Rota | Sucesso | Erros |
|---|---|---|
| `GET /` | `200 Hello World!` | — |
| `POST /auth/dev-login` | `200 { accessToken, user }` | `400` · `404` com a flag desligada |
| `GET /users/me` | `200 { id, email, displayName, avatarUrl }` | `401` · `404` |
| `POST /tasks` | `201 task` | `400` · `401` |
| `GET /tasks?status=` | `200 task[]` (mais nova primeiro) | `400` · `401` |
| `GET/PATCH /tasks/:id` | `200 task` | `400` · `401` · `404` |
| `DELETE /tasks/:id` | `204` | `400` · `401` · `404` |

JSON da tarefa (mesmos campos do Prisma): `id, userId, title, description, priority, estimatedPomodoros, completedPomodoros, status, completedAt, syncStatus, createdAt, updatedAt`. Campos nulos aparecem como `null`, como no Nest.

**Formato de erro:** `{ "statusCode": 400, "error": "Bad Request", "message": "..." | ["..."] }`, o mesmo do Nest. Os **textos** das mensagens de validação mudam (o Spring escreve `"title: must not be blank"`, o Nest escrevia `"title should not be empty"`). O app não deve depender desses textos.

### Diferenças aceitas

| Ponto | Nest | Spring | Impacto |
|---|---|---|---|
| `sub` do JWT | número (`7`) | string (`"7"`), como manda a RFC 7519 | Nenhum: o app não lê o conteúdo do token. Tokens emitidos pelo Nest deixam de valer; eles expiram em 1 dia de qualquer forma. |
| Query string desconhecida (`?foo=1`) | 400 | ignorada | Nenhum para o app. |
| Texto das mensagens de validação | inglês do class-validator | inglês do Bean Validation | O app só deve olhar o `statusCode`. |

---

## 6. Riscos da migração (principalmente no banco)

| # | Risco | Mitigação |
|---|---|---|
| R1 | O Flyway tentar recriar tabelas que já existem. | `baseline-on-migrate` na versão 1: em banco não vazio, a V1 é marcada como aplicada e não roda. Verificar antes e depois com `count(*)`. |
| R2 | O Hibernate alterar o schema. | `ddl-auto=validate` (D4). Nunca usar `update`. |
| R3 | **Dois donos do schema.** Se alguém subir a API Nest de novo, o `prisma migrate deploy` roda ao lado do Flyway. | O Prisma não tem migrations novas, então hoje não faria nada. Regra: a partir da troca, **migrations novas só no Flyway**. Remover a pasta Nest quando o grupo aprovar. |
| R4 | Mapeamento de enum do Postgres (`"Priority"` com aspas e maiúscula) incompatível com o Hibernate. | O teste de contexto com `validate` sobe contra o Postgres do Testcontainers com a V1 aplicada: se o mapeamento estiver errado, ele falha. |
| R5 | Fuso horário: `TIMESTAMP` sem fuso + JVM em `America/Sao_Paulo` gravaria a hora local. | `hibernate.jdbc.time_zone=UTC` e o `Instant` gravado como `TIMESTAMP` (D6). Teste comparando o valor lido com o gravado. |
| R6 | `updated_at` é `NOT NULL` **sem default** (o Prisma preenchia no client). | `@PrePersist`/`@PreUpdate` na entidade preenchem as datas. Teste de criação garante. |
| R7 | RAM da máquina (Spring ~250 MB em execução, Maven no build). | Heap limitado no build, nos testes e no container (`-XX:MaxRAMPercentage`). |
| R8 | Testcontainers não achar o Docker. | Verificado no primeiro teste; o fallback seria apontar os testes para um banco `taskflow_test` separado. |

---

## 7. Ordem de implementação (TDD em cada passo)

| # | Passo | Testes antes |
|---|---|---|
| 1 | Projeto pelo Initializr (web, data-jpa, flyway, postgresql, validation, security, oauth2-resource-server, testcontainers) + `V1__init.sql` + entidades + `application.yml` | contexto sobe com `validate` contra o Postgres do Testcontainers; `GET /` → `Hello World!`; datas gravadas e lidas em UTC |
| 2 | Erros + validação + CORS | campo desconhecido → 400; tipo errado → 400; formato `{statusCode, error, message}`; preflight de CORS |
| 3 | JWT + `SecurityFilterChain` + dev-login + `/users/me` | segredo ausente ou curto → falha; flag ≠ `"true"` → 404; email normalizado sem duplicar; token forjado/expirado → 401 |
| 4 | Tasks CRUD | os 12 casos do service e os 4 cenários e2e do passo 3, incluindo o isolamento entre dois usuários |
| 5 | `Dockerfile` + `compose.yml` | build da imagem; subida contra o **banco existente** (baseline sem perda de dados); smoke test com curl |

---

## 8. Fora do escopo

- Passo 4 (sessions) e passo 5 (Google): continuam no plano, agora no Spring.
- Apagar `taskflow-api/` (Nest): depende da aprovação do grupo (D1).
- Atualizar o README (stack NestJS → Spring): fazer junto com a remoção do Nest.
