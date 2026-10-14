# 14/10/2026 — Migração do backend de NestJS para Spring Boot

- **Branch:** `develop` (alterações não commitadas)
- **Base:** [analises/analise-migracao-spring.md](../analises/analise-migracao-spring.md) (decisões D1–D9, riscos R1–R8, ordem da seção 7)
- **Metodologia:** TDD em cada passo. Os testes de cada etapa foram escritos antes e falharam na compilação (`cannot find symbol` / `package ... does not exist`); depois veio a implementação até ficarem verdes.

## Resumo

O backend agora roda em **Spring Boot 4.1.1 (Java 17)**, em `taskflow-api-spring/`, com as mesmas funcionalidades e o mesmo contrato HTTP da versão Nest (passos 1–3): `GET /`, `POST /auth/dev-login`, `GET /users/me` e o CRUD de `/tasks`.
- **Banco:** é o mesmo Postgres, com os mesmos dados. O Flyway assumiu as migrations com um *baseline*, sem executar nada no banco existente. O schema foi comparado com um backup e está idêntico.
- **`compose.yml`:** agora sobe o Spring.
- **Código Nest:** continua intacto em `taskflow-api/`, fora do compose (decisão D1).

**Impacto no frontend: nenhum.** O app ainda não chama a API, e quando chamar, as rotas, o JSON, os status e o formato de erro são os mesmos.

## Estrutura

```
taskflow-api-spring/
├── Dockerfile / .dockerignore
├── pom.xml                         (Boot 4.1.1, Java 17, surefire com -Xmx512m)
└── src/main/
    ├── resources/
    │   ├── application.yml         (ddl-auto=validate, UTC, Flyway baseline, flags)
    │   └── db/migration/V1__init.sql  (cópia literal do migration.sql do Prisma)
    └── java/com/taskflow/api/
        ├── HelloController         GET /
        ├── config/  JacksonConfig (JSON estrito), JwtConfig (HS256, segredo ≥ 32), SecurityConfig (rotas, 401, CORS)
        ├── common/  ApiError + ApiErrorHandler ({ statusCode, error, message }, como no Nest)
        ├── auth/    AuthController (dev-login com flag), AuthService, CurrentUser, DevLoginRequest, LoginResponse
        ├── user/    User, UserRepository, UserService, UserController (/users/me)
        └── task/    Task, enums, TaskRepository, TaskService, TaskController, Create/UpdateTaskRequest
```

## O que foi feito (por passo da análise)

| Passo | O que foi feito |
|---|---|
| 1. Projeto + banco | Projeto gerado pelo Spring Initializr. O `pom.xml` veio com `4.1.1.RELEASE`, que não existe no Maven Central, e foi corrigido para `4.1.1`. Entidades `User` e `Task` mapeadas com `ddl-auto=validate`. Enums mapeados como `NAMED_ENUM` para os tipos do Postgres. `Instant` gravado como `TIMESTAMP` em UTC e truncado para milissegundos. `createdAt`/`updatedAt` preenchidos por `@PrePersist`/`@PreUpdate` (o `updated_at` não tem default no banco). |
| 2. Erros + validação + CORS | O `ApiErrorHandler` estende o `ResponseEntityExceptionHandler`, então **todas** as exceções do MVC saem no formato do Nest. Jackson estrito: campo desconhecido gera `"property X should not exist"` (mesmo texto do Nest), sem coerção (`"4"` não vira `4`) e sem aceitar decimal como inteiro. CORS liberado (auth por header). |
| 3. Auth + users | O `JwtConfig` falha na inicialização sem segredo ou com segredo < 32 caracteres. O Spring Security (`oauth2-resource-server`) valida assinatura e expiração. O 401 sai em JSON, sem detalhar o motivo. O dev-login só funciona com a flag exatamente `"true"`, normaliza o email para minúsculas e não apaga o `displayName`. |
| 4. Tasks | Toda consulta por id também filtra pelo dono (`findByIdAndUserId`). Apagar é uma query só (`delete ... where id and userId`). Regra do `completedAt` igual à do Nest. Ids `0`, `abc` ou acima do `INT` dão 400. |
| 5. Docker | Dockerfile multi-stage (JDK 17 → JRE 17), processo como usuário sem privilégios, heap de 256 MB. No compose: variáveis `SPRING_DATASOURCE_*`, **healthcheck** `pg_isready` no banco, `depends_on: service_healthy` (resolve a corrida banco × API, pendente desde a primeira análise), `container_name: taskflow-api` e remoção do `version: '3.8'` obsoleto. |

## Testes criados (35)

Os testes de integração usam **Testcontainers**: um Postgres 15 descartável por execução. Eles **não tocam mais no banco de desenvolvimento** (riscos 5 do passo 2 e 7 do passo 3, resolvidos).

| Classe | Casos |
|---|---|
| `config/JwtConfigTest` | 3: sem segredo (vazio e `null`), segredo curto, segredo válido → `HmacSHA256`. |
| `InfraIntegrationTest` | 4: `GET /` sem token; Flyway aplicou a V1; data gravada em UTC (texto cru do banco = `2026-10-01 10:00:00`), `createdAt`/`updatedAt` preenchidos e defaults `medium`/`pending`; preflight de CORS. |
| `auth/AuthControllerTest` | 7: `404` com a flag `null`, `""`, `"false"`, `"1"`, `"TRUE "` e `"True"`, sem chamar o service; chama o service com `"true"`. |
| `auth/AuthIntegrationTest` | 5: login → token → `/users/me`; login repetido em maiúsculas não duplica e não apaga o `displayName`; validação no formato do Nest (email inválido, `id` extra, corpo vazio, JSON quebrado); `401` sem token, com lixo, com `Basic`, com token **forjado** (outro segredo) e com token **expirado**; `404` quando o usuário do token foi apagado. |
| `task/TaskServiceTest` | 12: os mesmos 12 casos do service Nest (ownership, 404 sem salvar, as 4 regras do `completedAt`, delete numa query). |
| `task/TaskIntegrationTest` | 4: `401` nas 5 rotas sem token; CRUD completo, com o **formato de data igual ao do Nest** (ISO UTC com `Z`); **isolamento entre dois usuários** (B recebe 404 em ver, editar e apagar a tarefa de A, e a tarefa continua intacta); 11 validações (incluindo `userId` e `completedAt` no corpo, `"4"` como string, ids `abc`/`0`/`99999999999`). |

## Validação

| Verificação | Resultado |
|---|---|
| `./mvnw test` | **35 testes, 0 falhas** (6 classes) |
| `docker compose build api` | imagem `taskflow-api` construída (548 MB) |
| **Backup antes do Flyway** | `pg_dump` completo (4 tabelas, 0 linhas de dados) salvo no scratchpad da sessão |
| `docker compose up -d` contra o banco existente | `Successfully baselined schema with version: 1` → `No migration necessary`. O Hibernate validou as entidades contra o schema real do Prisma. A API subiu em 7 s. |
| Schema depois × backup | **idêntico** (`diff` sem diferenças; a única tabela nova é a `flyway_schema_history`) |
| curl no container | `Hello World!`; `{"sub":1}` → `400 property sub should not exist`; dev-login → `/users/me`; sem token → `401` JSON; criar → concluir (`completedAt` igual no JSON e no banco, em UTC) → filtrar `done` → apagar `204` → `404`; id gigante → `400` |
| Limpeza | `users` e `tasks` com 0 linhas no final |
| Memória em execução | API **~290 MB** (o Nest usava ~60 MB); Postgres ~40 MB |

## Diferenças em relação ao Nest

| Ponto | Nest | Spring | Impacto |
|---|---|---|---|
| `sub` do JWT | número | string (RFC 7519) | Nenhum; tokens antigos do Nest deixam de valer (expiravam em 1 dia). |
| Query desconhecida (`?foo=1`) | 400 | ignorada | Nenhum. |
| `description: null` no PATCH | apagava a descrição | ignorado (null = "não enviado") | Para limpar a descrição, enviar `""`. |
| Rota inexistente sem token | 404 | 401 (a segurança responde antes) | Nenhum para o app. |
| Texto das mensagens de validação | class-validator | Bean Validation (`"title: must not be blank"`) | O app deve olhar só o `statusCode`. |
| Título só com espaços | aceito | rejeitado (`@NotBlank`) | Mais restritivo; nenhum impacto negativo. |

## Riscos e possíveis soluções

| # | Risco | Impacto | Solução |
|---|---|---|---|
| 1 | **Dois donos do schema.** Se alguém subir a API Nest (`taskflow-api/`), o `prisma migrate deploy` roda no mesmo banco que o Flyway controla. | Hoje nenhum, porque o Prisma não tem migrations novas. No futuro, schema divergente e a API Spring sem subir (o `validate` falha). | Regra do grupo: **migrations novas só em `taskflow-api-spring/src/main/resources/db/migration/V2__...sql`**. Remover `taskflow-api/` quando o grupo aprovar a troca. |
| 2 | **`_prisma_migrations` continua no banco.** | Nenhum: o Hibernate ignora tabelas não mapeadas. | Pode ser removida numa V2 quando o Nest for apagado. |
| 3 | **RAM.** A API usa ~290 MB, e os testes sobem um Postgres extra. Durante esta demanda, uma rodada de testes ficou parada ~12 min esperando o Testcontainers, e só seguiu quando os containers do TaskFlow foram parados (**não fui eu que parei**: eles aparecem como `stop` com código 0 nos eventos do Docker). | Testes lentos ou travados com o emulador ou o VS Code abertos. | Parar a API (`docker compose stop api`) antes de rodar `./mvnw test`; heap já limitado (`-Xmx512m` nos testes, `-Xmx256m` no container). |
| 4 | **Backup só no scratchpad da sessão.** | Ele some com a sessão. Hoje o banco não tinha dados, então não há perda possível. | Antes de qualquer migration futura com dados reais: `docker exec taskflow-postgres pg_dump -U postgres -d taskflow > backup-AAAA-MM-DD.sql` (fora do git). |
| 5 | **Corrida no primeiro login** (mesmo email, duas requisições ao mesmo tempo). | Uma das duas recebe `500` (violação do índice único). O Nest tinha o mesmo comportamento. | Tratar `DataIntegrityViolationException` buscando de novo pelo email, se aparecer na prática. |
| 6 | **`dev-login` continua o ponto fraco** (porta 3000 aberta na rede, para o celular). | Login como qualquer email enquanto a flag estiver `true`. | Igual ao passo 2: flag só no `.env` local, padrão `false` no compose. |
| 7 | **Imagem de 548 MB** (JRE Ubuntu). | Só espaço em disco. | Trocar por `eclipse-temurin:17-jre-alpine` ou usar `jlink` se pesar. |
| 8 | **Spring Boot 4 + Jackson 3** são versões recentes. | Exemplos da internet (Boot 3 / Jackson 2) usam pacotes diferentes (`com.fasterxml` → `tools.jackson`, starters separados). | Seguir os pacotes usados aqui; os testes pegam incompatibilidades. |

## Pendências

- **README:** ainda diz NestJS. Atualizar junto com a remoção do Nest (seção 8 da análise).
- **Passo 4 (sessions) e passo 5 (Google):** seguem o plano original, agora no Spring.
- **Commit:** nada foi commitado. A pasta `taskflow-api-spring/` é nova e inteira não rastreada.
