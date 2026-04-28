# TaskFlow — Branch Backend

> Documentação técnica da camada de dados e funções de banco de dados do TaskFlow.

---

## Sobre esta branch

Esta branch concentra toda a lógica de persistência local do TaskFlow: schemas do banco de dados SQLite, funções de CRUD e testes unitários com Jest. O app utiliza `expo-sqlite` para armazenamento local no dispositivo, sem dependência de servidor externo nesta fase do projeto.

---

## Configuração do ambiente

### Instalação

```bash
# Entre na pasta do app
cd taskflow-app

# Instale as dependências
npm install
```

### Rodando o projeto

```bash
# Inicie o servidor Expo apontando para uma plataforma móvel
npx expo start --android
# ou
npx expo start --ios
```

> ⚠️ Não use `npx expo start` sem especificar a plataforma — o `expo-sqlite` não tem suporte para web e o bundler vai quebrar.

### Rodando os testes

```bash
npx jest
```

---

## Fluxo de trabalho com Git

### Sincronizando com a branch principal

Antes de começar qualquer trabalho, sincronize sua branch com a `Backend` para garantir que está trabalhando com o código mais atualizado:

```bash
git pull origin Backend
```

### Criando uma branch para nova funcionalidade

Cada nova funcionalidade deve ter sua própria branch, criada a partir da `Backend`. Isso mantém o histórico organizado e facilita revisões de código:

```bash
# Crie e mude para a nova branch
git checkout -b feature/nome-da-funcionalidade

# Exemplos:
git checkout -b feature/crud-pomodoro
git checkout -b feature/daily-summary
git checkout -b feature/sync-supabase
```

Ao concluir, abra um Pull Request da sua branch para a `Backend`.

---

## Estrutura da pasta `database/`

```
database/
├── __tests__/
│   ├── tasks.test.ts
│   ├── pomodoro.test.ts
│   └── daily_summary.test.ts
├── schemas.ts         # Inicialização e criação das tabelas
├── tasks.ts           # CRUD de tarefas
├── pomodoro.ts        # CRUD de sessões Pomodoro
└── daily_summary.ts   # CRUD de resumos diários
```

Os tipos TypeScript ficam em:

```
types/
└── task.types.ts
```

Os mocks do Jest ficam em:

```
__mocks__/
└── expo-sqlite.ts
```

---

## Funcionalidades implementadas

### Banco de dados (`schemas.ts`)

Inicialização do banco SQLite local com as seguintes tabelas:

| Tabela | Descrição |
|---|---|
| `users` | Dados básicos do usuário (preparado para Fase 3) |
| `tasks` | Tarefas com prioridade, status e contagem de Pomodoros |
| `pomodoro_sessions` | Sessões de foco vinculadas a tarefas |

A função `initDatabase()` é chamada automaticamente na inicialização do app via `_layout.tsx` e usa `CREATE TABLE IF NOT EXISTS` para garantir que as tabelas não sejam recriadas em execuções subsequentes.

### CRUD de tarefas (`tasks.ts`)

**`createTask(input)`**

Cria uma nova tarefa no banco e retorna o objeto completo com o `id` gerado.

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `input.title` | `string` | Título da tarefa |
| `input.description` | `string` | Descrição da tarefa |
| `input.priority` | `string` | Prioridade: `low`, `medium` ou `high` |

Retorno: objeto `Task` com todos os campos, incluindo o `id` e o `status` inicial `pending`.

---

**`deleteTask(id)`**

Deleta uma tarefa com base no ID.

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `id` | `number` | ID da tarefa a ser deletada |

Retorno: `void`.

---

**`editTask(id, input)`**

Atualiza título, descrição e prioridade de uma tarefa existente.

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `id` | `number` | ID da tarefa a ser editada |
| `input.title` | `string` | Novo título |
| `input.description` | `string` | Nova descrição |
| `input.priority` | `string` | Nova prioridade |

Retorno: `void`.

---

**`completeTask(id)`**

Marca uma tarefa como concluída, atualizando o `status` para `done` e registrando o `completed_at` com a data/hora atual.

| Parâmetro | Tipo | Descrição |
|---|---|---|
| `id` | `number` | ID da tarefa a ser concluída |

Retorno: `void`.

---

## Testes

Os testes seguem o fluxo TDD (Test-Driven Development) com o ciclo Red → Green → Refactor. O Jest utiliza um mock do `expo-sqlite` (`__mocks__/expo-sqlite.ts`) para simular o banco de dados em ambiente Node, sem dependência do dispositivo móvel.

Para cada função, os testes verificam:

- Se a query SQL correta foi executada
- Se os parâmetros foram passados na ordem certa
- Se o retorno está de acordo com o tipo esperado

---

## Créditos

| Nome | Papel |
|---|---|
| Murilo Ribeiro da Silveira | Desenvolvimento Backend |
| Pedro Henrique Borges Carvalho Braga | Desenvolvimento Backend |