# 14/10/2026 — API: passo 3 (CRUD de tarefas)

- **Branch:** `develop` (alterações não commitadas)
- **Base:** [analises/analise-endpoints-crud-e-auth.md](../analises/analise-endpoints-crud-e-auth.md), seções 6.3 e 9 (passo 3)
- **Metodologia:** TDD. `parse-id.pipe.spec.ts`, `tasks.service.spec.ts` e `tasks.e2e-spec.ts` foram escritos antes e falharam (`Cannot find module`); depois veio a implementação até ficarem verdes.

## Resumo

CRUD completo em `/tasks`, protegido pelo JWT do passo 2. Cada usuário só vê, edita e apaga as próprias tarefas. Tentar acessar a tarefa de outra pessoa responde `404`, como se ela não existisse. O `userId` vem sempre do token: mandar `userId` no corpo dá `400`.

## Endpoints

Todos exigem `Authorization: Bearer <token>`.

| Método | Rota | Corpo / query | Respostas |
|---|---|---|---|
| POST | `/tasks` | `{ title, description?, priority?, estimatedPomodoros? }` | `201 task` · `400` |
| GET | `/tasks` | `?status=pending\|in_progress\|done` (opcional) | `200 task[]`, só as do usuário, da mais nova para a mais antiga |
| GET | `/tasks/:id` | — | `200 task` · `404` (inexistente ou de outro usuário) · `400` id inválido |
| PATCH | `/tasks/:id` | qualquer campo do POST + `status?`, `completedPomodoros?` | `200 task` · `404` · `400` |
| DELETE | `/tasks/:id` | — | `204` · `404` |

```bash
A="Authorization: Bearer $TOKEN"
curl -s -X POST localhost:3000/tasks -H "$A" -H 'Content-Type: application/json' \
  -d '{"title":"Estudar Prisma","priority":"high","estimatedPomodoros":4}'
curl -s localhost:3000/tasks?status=pending -H "$A"
curl -s -X PATCH localhost:3000/tasks/1 -H "$A" -H 'Content-Type: application/json' -d '{"status":"done"}'
curl -s -X DELETE localhost:3000/tasks/1 -H "$A" -i
```

## O que foi feito

| Item | O que foi feito | Arquivos |
|---|---|---|
| `ParseIdPipe` | Aceita só inteiros de 1 a 2.147.483.647 (limite do `INT` do Postgres). O `ParseIntPipe` padrão aceitaria `99999999999`, e o Prisma responderia `500`. Fica em `common/` para ser reaproveitado no passo 4 (sessions). | `src/common/parse-id.pipe.ts` |
| DTOs | `title` obrigatório (1–200 caracteres); `description` até 2000; `priority` e `status` validados contra os enums gerados pelo Prisma; `estimatedPomodoros` de 1 a 100; `completedPomodoros` de 0 a 1000. `userId`, `syncStatus`, `completedAt`, `createdAt` e `updatedAt` **não existem nos DTOs**, então o `ValidationPipe` rejeita esses campos. | `src/tasks/dto/*` |
| `TasksService` | **Ownership em toda query:** `findFirst({ id, userId })`, `findMany({ userId })` e `deleteMany({ id, userId })`. O `remove` confere e apaga numa query só. | `src/tasks/tasks.service.ts` |
| Regra do `completedAt` | O servidor controla o campo: status passou para `done` → `new Date()`; já estava `done` → mantém a data original; saiu de `done` → `null`; status não enviado → não mexe. | `src/tasks/tasks.service.ts` |
| `TasksController` | 5 rotas com `@UseGuards(AuthGuard)` no controller inteiro; `DELETE` responde `204`. | `src/tasks/tasks.controller.ts` |
| Módulo | `TasksModule` importa o `AuthModule` (guard + JWT) e é registrado no `AppModule`. | `src/tasks/tasks.module.ts`, `src/app.module.ts` |

## Testes criados

| Arquivo | Casos |
|---|---|
| `src/common/parse-id.pipe.spec.ts` | 10: aceita `1` e o máximo do `INT`; rejeita `0`, negativo, decimal, texto, vazio, `1e3`, máximo + 1 e `99999999999`. |
| `src/tasks/tasks.service.spec.ts` | 12: create grava o `userId` do token; findAll filtra por usuário, ordena e aplica o status; findOne busca por id **e** usuário e dá `404` quando não acha; update dá `404` **sem chamar o update** para tarefa alheia, cobre as 4 regras do `completedAt` e não injeta campos extras; remove usa `deleteMany` com ownership e dá `404` com `count = 0`. |
| `test/tasks.e2e-spec.ts` (banco real) | 4 cenários com dois usuários: as 5 rotas dão `401` sem token; CRUD completo (criar → listar → buscar → concluir com `completedAt` → filtrar por `done` → apagar → `404`); **B não vê, não edita e não apaga a tarefa de A**, a lista de B vem vazia e a tarefa continua intacta no banco; validação de corpo vazio, título vazio, prioridade inválida, pomodoros acima do limite, `userId` no corpo, status inválido na query, id `abc` e id acima do `INT`. Apaga as tarefas e os usuários no `afterAll`. |

## Validação

| Comando | Resultado |
|---|---|
| `npm test` | 10 suítes, **50 testes passando** |
| `npm run test:e2e` | 4 suítes, **11 testes passando**; `tasks` e `users` com 0 linhas depois (limpeza ok) |
| `npm run lint` / `npm run build` | sem erros |
| `docker compose up --build -d api` | logs mapeiam as 5 rotas de `/tasks` |
| curl no container | criar → `id=3`; `PATCH {status: done}` → `completedAt` preenchido; `DELETE` → `204`; `GET` depois → `404`. O usuário do teste foi apagado. |

## Riscos e possíveis soluções

| # | Risco | Impacto | Solução |
|---|---|---|---|
| 1 | **Apagar uma tarefa deixa as sessões pomodoro órfãs.** A FK `pomodoro_sessions.task_id` é `ON DELETE SET NULL`: as sessões continuam no banco com `task_id = null`, ainda ligadas ao usuário. | Histórico de pomodoros sem a tarefa de origem. Não é perda de dados, mas pode confundir as estatísticas. | Decidir a regra no passo 4: manter o histórico (comportamento atual, bom para as estatísticas) ou apagar as sessões junto, numa `$transaction`. |
| 2 | **Corrida no `update`.** O service lê a tarefa (para checar o dono e o status atual) e depois atualiza. Duas requisições simultâneas podem calcular o `completedAt` com o mesmo estado antigo. | No pior caso, o `completedAt` fica com a data da segunda requisição, alguns milissegundos depois. A checagem de dono não é afetada, porque o `userId` nunca muda. | Aceitável para o uso atual. Se precisar de precisão, mover a regra para um `updateMany` com `where: { id, userId, status: { not: 'done' } }`. |
| 3 | **`GET /tasks` sem paginação.** Devolve todas as tarefas do usuário. | Lento só com milhares de tarefas por usuário. | Adicionar `?take=&skip=` (ou cursor) quando o volume justificar. O índice em `tasks.user_id` já existe. |
| 4 | **`completedPomodoros` editável pelo cliente.** O PATCH aceita esse valor direto (0–1000). | O cliente pode informar qualquer contagem. | No passo 4, o incremento passa a vir das sessões concluídas. Aí dá para remover o campo do DTO e deixar só o servidor alterar. |
| 5 | **`syncStatus` sempre `pending` nas tarefas criadas pela API.** É o default do schema, e o campo só faz sentido para o SQLite do app. | Nenhum agora. Pode confundir quando o app passar a sincronizar com a API. | Rever no alinhamento do schema app ↔ API (seção 5.4 da primeira análise). |
| 6 | **Campos do app que a API ainda não tem:** `due_date` e `quadrant`. | O app não consegue enviar essas informações para a API. | Migration de alinhamento antes de ligar a sincronização. |
| 7 | **e2e grava no banco de desenvolvimento** (mesmo risco do passo 2). | Uma interrupção forçada pode deixar dados `e2e-...@taskflow.test`. | `delete from tasks where user_id in (select id from users where email like 'e2e-%@taskflow.test'); delete from users where email like 'e2e-%@taskflow.test';`. No futuro, um banco `taskflow_test` separado. |

## Próximo passo

Passo 4: `SessionsModule` (CRUD em `/sessions`). Uma sessão de foco concluída incrementa o `completedPomodoros` da tarefa na mesma transação, e não deve ser possível pendurar sessão na tarefa de outro usuário.
