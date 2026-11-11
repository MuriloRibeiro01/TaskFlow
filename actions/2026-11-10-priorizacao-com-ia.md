# Priorização de tarefas com IA (Etapas 1 a 3)

Data: 2026-11-10 · Plano: `analises/plano-de-acao-priorizacao-com-ia.md`

## O que mudou

**Backend (`taskflow-api-spring`)** — Etapas 1 e 2
- `POST /prioritization/suggestions`: IA atrás de `AiClient` (`AnthropicAiClient`), regra de reserva (`RuleBasedScorer`), validação da saída, quadrante calculado no servidor, limite diário em memória.
- `V3__user_routine.sql`, `PATCH`/`GET /users/me` com `routineText` (até 2000 caracteres).
- `ANTHROPIC_API_KEY` e `AI_MODEL` em `application.yml`, `.env.example` e `compose.yml`.

**App (`taskflow-app`)** — Etapa 3 e campo da Etapa 2
- `prioritization.compare.ts`: `quadrantFromAnswers` e `compareLists`.
- `ai-prioritizer.ts` (chama a API) no lugar de `stub-prioritizer.ts`, que foi removido.
- `prioritization.service.ts`: `startSession`, `decideTask` (grava swipe do usuário + sugestão da IA), `chooseFinal`, `chooseAll`. `applyPrioritization` não mudou.
- `schemas.ts`: colunas `user_quadrant`, `ai_importance`, `ai_urgency`, `ai_justification`.
- `app/priorizar.tsx`: swipe cego (duas perguntas por tarefa, botões Sim/Não com `accessibilityLabel`), pedido à IA disparado ao sair do aviso de privacidade, passo `compare` novo.
- `components/prioritization/CompareLists.tsx`: concordância, divergências lado a lado, atalhos "minha lista" / "a da IA".
- `app/(tabs)/perfil.tsx`: campo "Minha rotina", salvo ao sair do campo.

## Testes
- `./mvnw test` (backend): todas as classes verdes, incluindo as de priorização e rotina.
- `npx jest --runInBand` (app): 97 testes verdes. `auth.test.ts` falha por falta do módulo `@react-native-google-signin/google-signin` na máquina (já falhava antes).
- `tsc --noEmit`: nenhum erro novo; os que aparecem em `perfil.tsx` e `index.tsx` já existiam.

## Decisões e limitações
- As respostas do swipe ficam em memória e só são gravadas no SQLite quando a IA responde; fechar o app no meio perde a sessão.
- Desfazer volta uma pergunta, não grava nada.
- Tarefa sem `remote_id` (ainda não sincronizada) fica fora do pedido à IA e entra sem sugestão.
- Não verificado: o roteiro manual no emulador (seção 3.6 do plano) e a chamada real à Anthropic.
- Falta: Etapa 4 (estatísticas/embeddings, depende de dados) e o PR.
