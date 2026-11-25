# TaskFlow — API

API REST do TaskFlow: contas, tarefas, sessões Pomodoro e sugestões de prioridade. É a única API do projeto e a consumida pelo app.

## Instalação e execução

### Pré-requisitos

- Docker Desktop (inclui Docker Compose). É o caminho recomendado: não precisa de Java nem de PostgreSQL instalados.
- Para rodar fora do Docker ou rodar os testes: JDK 17. O Maven vem junto (`./mvnw`).

### Variáveis de ambiente

Ficam no `.env` da **raiz do projeto** (o `compose.yml` lê de lá):

```bash
cp .env.example .env
openssl rand -hex 32    # gera o JWT_SECRET
```

| Variável | Obrigatória | Exemplo / padrão | Para que serve |
|---|---|---|---|
| `POSTGRES_USER` | sim | `taskflow` | Usuário do banco |
| `POSTGRES_PASSWORD` | sim | `taskflow` | Senha do banco |
| `POSTGRES_DB` | sim | `taskflow` | Nome do banco |
| `JWT_SECRET` | sim | saída do `openssl rand -hex 32` | Assina os tokens (mínimo 32 caracteres; sem ele a API não sobe) |
| `ENABLE_DEV_LOGIN` | não | `false` | `true` libera `POST /auth/dev-login` (entra só com o e-mail). Só para teste local |
| `ANTHROPIC_API_KEY` | não | vazio | Liga a priorização com IA. Sem ela, a API usa o modelo local e as regras |
| `AI_MODEL` | não | `claude-haiku-5-5` | Modelo usado na priorização com IA |
| `AI_DAILY_LIMIT` | não | `20` | Chamadas de IA por usuário por dia |

### Rodar com Docker (recomendado)

Da raiz do projeto:

```bash
docker compose up --build    # primeira vez: compila o JAR e sobe banco + API
docker compose up            # nas próximas vezes
docker compose down          # para tudo (os dados ficam no volume taskflow-pgdata)
```

- API: `http://localhost:3000`
- Documentação interativa (Swagger): `http://localhost:3000/swagger-ui/index.html`
- O Flyway aplica as migrations ao subir. O PostgreSQL fica em `localhost:5435`, acessível só pela própria máquina.

### Rodar sem Docker

Com um PostgreSQL rodando (por exemplo, só o banco do compose: `docker compose up -d db`):

```bash
cd api
export SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5435/taskflow
export SPRING_DATASOURCE_USERNAME=taskflow
export SPRING_DATASOURCE_PASSWORD=taskflow
export JWT_SECRET=$(openssl rand -hex 32)
./mvnw spring-boot:run
```

### Testes

```bash
cd api
./mvnw test
```

Os testes de integração sobem um PostgreSQL descartável pelo Testcontainers, então o Docker precisa estar aberto.

## Endpoints

Todas as rotas, exceto as de `/auth`, exigem `Authorization: Bearer <token>`. Cada usuário só vê e altera os próprios dados.

| Método | Rota | Descrição |
|---|---|---|
| POST | `/auth/register` | Cria conta com e-mail e senha (8 a 72 caracteres) e devolve o token |
| POST | `/auth/login` | Entra com e-mail e senha e devolve o token (válido por 7 dias) |
| POST | `/auth/dev-login` | Entra só com o e-mail; responde apenas com `ENABLE_DEV_LOGIN=true` |
| GET / PATCH | `/users/me` | Lê e altera o perfil e a rotina do usuário |
| GET / POST | `/tasks` | Lista e cria tarefas |
| GET / PATCH / DELETE | `/tasks/{id}` | Lê, altera e apaga uma tarefa |
| GET / POST | `/sessions` | Lista e registra sessões Pomodoro |
| PATCH / DELETE | `/sessions/{id}` | Altera e apaga uma sessão |
| POST | `/prioritization/suggestions` | Sugere o quadrante de Eisenhower para as tarefas informadas |

Detalhes de corpo e resposta de cada rota estão no Swagger.

**Segurança:** senhas com BCrypt, JWT com emissor e destinatário conferidos, limite de tentativas de login por IP e a API se recusa a subir com `ENABLE_DEV_LOGIN=true` no perfil `prod`.

## Estrutura (Clean Architecture)

```
src/main/java/com/taskflow/api/
├── domain/           entidades e enums: Task, User, PomodoroSession, Priority, Quadrant…
├── application/      casos de uso e DTOs: auth, task, session, user, prioritization
├── infrastructure/   jpa/ (repositórios) e external/ (cliente da API da Anthropic)
├── presentation/     controllers REST
├── config/           segurança, JWT, rate limit, OpenAPI, Jackson
└── common/           formato padrão de erro
src/main/resources/
├── application.yml
├── db/migration/     migrations Flyway (V1, V2, V3, V5)
└── modelo-prioridade.json   pesos do modelo gerado por ml/treinar.py
```

**Priorização:** `PrioritizationService` tenta a IA (`AnthropicAiClient`), cai para o modelo local (`PriorityModel`, TF-IDF + regressão logística treinado em [`ml/`](../ml/README.md)) e por fim para regras de prazo e prioridade (`RuleBasedScorer`).
