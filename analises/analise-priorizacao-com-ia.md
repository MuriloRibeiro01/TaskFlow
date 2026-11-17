# Análise: priorização de tarefas com IA (swipe + comparação de listas)

Data: 2026-11-10 · Branch: `feature/backend-spring` · Nenhum código foi alterado nesta análise.

Base: o código atual do TaskFlow (app + API Spring) e o repositório `../Chatinho` (`chatbot/`). Não executei o Chatinho; li o código e os dados.

---

## 1. Resumo

1. **Já existe metade da feature no app.** A tela `app/priorizar.tsx` (1334 linhas) tem cards com swipe, a matriz de Eisenhower 2x2, desfazer, aviso de privacidade, tela de "sem conexão" e de "falha da IA". A "IA" é um **stub que sorteia o quadrante** (`database/services/stub-prioritizer.ts`). Trocar o stub por uma IA real é o ponto de encaixe natural.
2. **O fluxo atual não é o que você descreveu.** Hoje o card já mostra a sugestão da IA e o usuário só aceita ou troca. Você quer que o usuário monte a **própria lista primeiro**, a IA monte a dela, e **depois** as duas sejam comparadas. Isso muda a ordem da tela e acrescenta uma tela de comparação, que não existe.
3. **Do Chatinho dá para reaproveitar pouco, e não é o modelo Keras.** O `modelo.keras` classifica *intenções de chat* ("listar tarefas", "oi"), não prioridade. O que serve é a **ideia de embeddings + similaridade por cosseno** (`embeddings.py`, `semantic_search.py`), e só numa fase posterior, para personalizar. Recomendo **não** colocar Python/TensorFlow/PyTorch no projeto agora (seção 4).
4. **Recomendação para a IA:** um LLM chamado pelo backend Spring (que já guarda as tarefas), recebendo tarefas + rotina e devolvendo pontuação de importância e urgência com justificativa. Uma regra simples (prazo, estimativa) fica como plano B quando a chamada falhar.

---

## 2. O que já existe no projeto

| Peça | Onde | Situação |
|---|---|---|
| Cards com swipe (direita = aceita a IA, esquerda = escolher quadrante, cima = "fazer agora") | `app/priorizar.tsx` (`PanResponder` + Reanimated) | Funciona, mas a sugestão da IA aparece no card |
| Matriz 2x2 de resultado e botão de aplicar | `app/priorizar.tsx` (passos `result` e `applied`) | Mostra **uma** lista só |
| Estados da tela | `no_connection`, `privacy_notice`, `syncing`, `generating`, `card`, `quadrant_selector`, `result`, `applied`, `ai_failure` | Já prevê a IA remota (sincroniza antes de gerar, falha, offline) |
| Ponto de troca da IA | `suggestPrioritization(tasks): Promise<SuggestionResult[]>` em `stub-prioritizer.ts` | Stub com `Math.random()` |
| Tipos | `types/prioritization.types.ts`: `Quadrant`, `SuggestionResult { taskId, suggestedQuadrant, confidence, justification }` | Reaproveitáveis |
| Persistência local | tabelas SQLite `prioritization_sessions` e `prioritization_decisions` (`suggested_quadrant`, `chosen_quadrant`, `confidence`) | Guarda IA e escolha final, **não** a escolha cega do usuário |
| Aplicar o resultado | `applyPrioritization()` grava `quadrant` e `priority` na tarefa, marca `pending` e dispara o sync | Pronto; o sync já leva os dois campos |
| Campos no servidor | `tasks.quadrant`, `tasks.priority`, `due_date`, `estimated_pomodoros` (V2) | Pronto: **aplicar o resultado não exige migration** |
| Dados de rotina | `pomodoro_sessions` (horários, duração, status), `tasks.due_date`, `estimated_pomodoros` vs `completed_pomodoros`, `daily_summary` | Existem, ninguém os usa ainda |

Lacunas: não há endpoint de IA na API; não existe o conceito de **rotina** do usuário; o app não se comunica com nenhuma IA.

---

## 3. A feature, passo a passo

```
 [Aviso de privacidade] -> [Sync] -> usuário faz swipe SEM ver a IA ----+
                                  \                                      \
                                   -> API gera a lista da IA (paralelo) --> [Comparação] -> [Escolher] -> [Aplicar]
```

1. **Aviso de privacidade** (já existe). O texto precisa dizer que títulos, descrições e a rotina vão para um serviço externo de IA.
2. **Sync** (já existe). A API só conhece as tarefas depois de sincronizadas.
3. **Swipe cego.** O usuário classifica cada tarefa pendente sem ver a sugestão. Em paralelo o app pede a lista da IA à API; assim a espera da IA some atrás do tempo que o usuário leva nos swipes.
4. **Comparação** (tela nova). Duas matrizes lado a lado (ou uma lista com duas colunas), com as **divergências destacadas** e a justificativa da IA em cada uma.
5. **Escolha.** "Seguir a minha", "seguir a da IA", e, como opção extra barata, **resolver só as divergências** (as concordâncias já estão decididas). Você falou em escolher uma das duas listas; o modo por divergência é um acréscimo que vale confirmar.
6. **Aplicar** (já existe).

### Por que o swipe cego importa
Mostrar a sugestão antes (como hoje) induz o usuário a concordar (efeito âncora) e esvazia a comparação: as duas listas ficariam quase iguais. A taxa de concordância entre as listas também vira a **melhor métrica de qualidade da IA**, e só é honesta se o usuário decidiu sem ver a resposta.

### "Matriz comparando tarefas"
Comparar todas as tarefas par a par custa N² chamadas à IA, o que é inviável. Em vez disso, a IA devolve **duas notas por tarefa** (importância e urgência, 0 a 100). Essas notas são exatamente os eixos da matriz de Eisenhower, dão a ordem dentro de cada quadrante (o "grau de prioridade") e, se for preciso mostrar a comparação par a par, ela sai dessas notas sem custo.

### Modelo de swipe (decisão em aberto)
| Opção | Como funciona | Observação |
|---|---|---|
| A. Dois swipes binários por tarefa | 1º: importante? (direita sim, esquerda não). 2º: urgente? | Mais próximo do Tinder, casa 1 a 1 com as notas da IA. **Recomendada** |
| B. Um swipe de 4 direções (o atual) | Cada direção é um quadrante | Mais rápido, mas direções arbitrárias e difíceis de aprender |

---

## 4. O que reaproveitar do Chatinho

### Inventário (`chatbot/`)
| Arquivo | O que é | Serve aqui? |
|---|---|---|
| `treinar.py`, `modelo.keras`, `palavras.pkl`, `classes.pkl` | Rede densa (64-32-N) em bag-of-words com stemmer RSLP, treinada com `intencoes.json` (10 intenções: saudação, criar/listar/concluir/deletar tarefa...) | **Não.** Prevê a intenção da frase, não prioridade. Não há dado rotulado de prioridade para treinar outro |
| `chatbot.py`, `context.py`, `intencoes.json` | Loop de terminal, comandos e contexto da conversa | **Não** (é a interface do chat) |
| `tarefas.json` | 8 tarefas de exemplo com embedding, sem prioridade nem rótulo | Só como massa de teste |
| `embeddings.py` | `SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')`, vetor de 384 dimensões, funciona em português | **Sim, a ideia** |
| `semantic_search.py` | Similaridade por cosseno com limiar 0,55 e top-3 | **Sim, a ideia** |
| `ChatbotPh/` | Versão anterior do chatbot (stemmer inglês) | Não |

### Onde os embeddings ajudam de verdade
1. **Personalização (o melhor uso).** A tabela `prioritization_decisions` guarda, a cada sessão, a escolha final do usuário: são **rótulos reais**. Uma tarefa nova pode herdar a tendência das tarefas parecidas que o usuário já classificou (vizinhos mais próximos por cosseno). Isso entra como contexto no prompt da IA ("tarefas parecidas que você classificou como X") ou como desempate.
2. **Agrupar tarefas parecidas** (ex.: "estudar IA" e "revisar estudos sobre inteligência artificial" tiveram similaridade alta no próprio exemplo do Chatinho) para classificá-las juntas ou avisar de duplicata.
3. **Cold start:** nenhum. Com poucas decisões guardadas, o vizinho mais próximo não ajuda; o LLM carrega a feature no começo.

### Por que não trazer o Python para o projeto agora
- `requirements.txt` fixa TensorFlow, PyTorch, transformers e sentence-transformers. São vários GB de dependências, o modelo de embeddings sozinho tem centenas de MB, e é preciso um processo Python rodando ao lado do Spring.
- Esta máquina tem ~8 GB e **já teve sessão encerrada por falta de RAM** com Maven, Jest e Docker juntos.
- O benefício (personalização) só aparece depois de acumular decisões.

Caminhos para a fase de personalização, do mais leve ao mais pesado:
1. API de embeddings hospedada (nenhuma dependência local, custo por chamada).
2. O mesmo modelo exportado para ONNX e executado no Spring (sem Python; precisa validar tamanho e latência).
3. Microsserviço Python só com `sentence-transformers` (sem TensorFlow; o `modelo.keras` não é necessário).

Para a apresentação da faculdade, vale registrar que o Chatinho entra como **origem da técnica de embeddings** na fase 3, e que foi decidido conscientemente não carregar o classificador de intenções.

---

## 5. Opções para a IA

| Opção | Prós | Contras |
|---|---|---|
| **A. LLM via API, chamada pelo Spring** | Entende a rotina escrita em português, dá justificativa, não precisa de dados de treino | Custo por chamada, chave de API, latência de segundos, envia dados a terceiros |
| B. Modelo próprio treinado (estilo Chatinho) | Offline, sem custo por uso | Não há dados rotulados; só viável depois de acumular decisões |
| C. Regra determinística (prazo, estimativa, atraso) | Instantâneo, grátis, explicável | Não entende a rotina nem o conteúdo da tarefa |

**Recomendação: A com C de reserva.** C calcula uma urgência básica a partir do prazo e serve de plano B quando o LLM falhar ou estourar o tempo (a tela `ai_failure` já existe). B/embeddings entram na fase 3.

Modelo: para classificar até ~30 tarefas por chamada, um modelo pequeno e rápido basta (na minha lista de modelos, `claude-haiku-5-5`). Confirmar id, preço e limites na documentação antes de fixar. Manter o provedor atrás de uma interface, como já é feito com `GoogleAuth`, permite trocar de provedor ou usar um modelo gratuito/local nos testes.

---

## 6. Encaixe na arquitetura

### Backend (`taskflow-api-spring`)
Pacote novo `prioritization`, no mesmo estilo de `task` e `session`:

| Peça | Função |
|---|---|
| `POST /prioritization/suggestions` | Recebe `{ taskIds? }` (padrão: todas as pendentes do usuário). Responde uma sugestão por tarefa |
| `PrioritizationService` | Busca **só as tarefas do próprio usuário** (já existe `findByIdAndUserId`), monta o contexto (tarefas + rotina + estatísticas), chama a IA, **valida a saída** (quadrante dentro do enum, notas de 0 a 100, `taskId` pertencente ao usuário) |
| `AiClient` (interface) + implementação HTTP com `RestClient` | Mesmo padrão do `GoogleAuth`; **timeout obrigatório** |
| Config | `ANTHROPIC_API_KEY` no `.env` (sem ela o endpoint responde 503, como o login), nome do modelo em `application.yml` |
| Limites | Máximo de tarefas por pedido, limite de chamadas por usuário/dia (custo), sem registrar conteúdo nos logs |

Resposta (compatível com o tipo atual do app, com dois campos a mais):
```json
[{ "taskId": 12, "importance": 85, "urgency": 40, "quadrant": "agendar",
   "confidence": 78, "justification": "Prazo em 9 dias, mas conta para a nota da disciplina." }]
```

### Rotina (decisão em aberto, ver seção 8)
Duas fontes combinadas:
- **Texto livre** que o usuário escreve no perfil ("estudo de manhã, trabalho à tarde, sexta é dia livre"). Guardar no servidor exige uma coluna em `users` (migration **V3**, `routine_text`), para valer em qualquer aparelho.
- **Estatísticas derivadas** dos dados existentes, calculadas no servidor: pomodoros por dia da semana, horários em que o usuário mais foca, estimativa vs. realizado, tarefas atrasadas.

### App (`taskflow-app`)
| Mudança | Arquivo |
|---|---|
| Trocar o stub por chamada à API (com o plano B local quando falhar) | `stub-prioritizer.ts` → novo serviço usando `database/api/client.ts` |
| Ocultar a sugestão da IA durante o swipe e registrar a escolha do usuário | `app/priorizar.tsx` |
| Novo passo `compare` com as duas matrizes e as divergências | `app/priorizar.tsx` (ou componente próprio, pois o arquivo já tem 1334 linhas) |
| Função pura `compareLists(usuario, ia)` → concordâncias e divergências | novo arquivo testável com Jest |
| Guardar `user_quadrant`, `ai_quadrant`, `final_quadrant`, notas e justificativa | `ALTER TABLE` em `prioritization_decisions` (mesmo padrão dos `ALTER` já existentes em `schemas.ts`) |
| Campo de rotina no perfil | `app/(tabs)/perfil.tsx` |

Mapeamento de ids: a IA trabalha com os ids do **servidor** (`tasks.remote_id`), e a tela, com os ids locais. É preciso converter nos dois sentidos, e só tarefas já sincronizadas podem ir (o passo `syncing` garante isso, mas tarefas que falharem no sync precisam ficar de fora com aviso).

Aplicar o resultado não muda: `applyPrioritization()` já grava `quadrant`/`priority` e dispara o sync.

---

## 7. Riscos

| Risco | Mitigação |
|---|---|
| **Privacidade:** títulos, descrições e rotina vão a um terceiro | Aviso já existe; ajustar o texto; enviar só o necessário; não registrar conteúdo; consentimento explícito e opção de não usar a rotina |
| **Custo e abuso** | Limite por usuário, máximo de tarefas por chamada, modelo pequeno; chave só no servidor (nunca no app) |
| **Latência (segundos) e falha do provedor** | Chamada em paralelo ao swipe, timeout, plano B (regra C), tela `ai_failure` |
| **Saída inválida ou inventada** (id que não existe, quadrante fora do enum) | Validar tudo no servidor; descartar o que não casar; pedir JSON estruturado |
| **Tarefa com pouca informação** (só título) | Devolver `confidence` baixa e mostrar na comparação |
| **Injeção via texto da tarefa/rotina** | O texto só afeta a lista do próprio usuário; mesmo assim, separar dados de instruções no prompt e validar a saída |
| **Efeito âncora** (usuário vê a IA e concorda) | Swipe cego (seção 3) |
| **Memória da máquina** | Não subir Python/TensorFlow agora; testes com `AiClient` falso |
| **Qualidade sem como medir** | Guardar concordância usuário x IA por sessão; fixture de ~20 tarefas para conferir o prompt à mão |

---

## 8. Decisões que preciso de você

1. **O que é a "rotina"?** (a) texto livre escrito pelo usuário; (b) estatísticas calculadas do uso do app; (c) as duas. Recomendo (c), começando só pelo texto livre + prazos.
2. **Modelo de swipe:** dois binários por tarefa (recomendado) ou os 4 sentidos atuais?
3. **Provedor e orçamento da IA:** LLM pago (qual chave?), um gratuito, ou rodar um modelo local nos testes?
4. **Na comparação:** só "uma lista inteira ou a outra", ou também escolher divergência por divergência?
5. **As sessões de priorização devem ir para o servidor?** Sem isso, a fase de personalização só funciona no aparelho. Com isso, é preciso tabela nova e entra no sync.

---

## 9. Plano em fases (TDD em cada uma, como no restante do projeto)

| Fase | Entrega | Testes antes |
|---|---|---|
| **0** | Decisões da seção 8 | — |
| **1. Backend** | `POST /prioritization/suggestions` com `AiClient` falso nos testes; regra C de reserva; limites e validação da saída; V3 se a rotina for texto | Saída inválida descartada; tarefa de outro usuário recusada; 401 sem token; 503 sem chave; timeout cai na regra C |
| **2. App: swipe cego e comparação** | Esconder a IA no card, guardar escolha do usuário, `compareLists`, tela de comparação, aplicar a lista escolhida | `compareLists` (iguais, divergentes, vazias); persistência das duas listas; aplicar usuário/IA/misto |
| **3. Rotina** | Campo no perfil + estatísticas derivadas entrando no prompt | Estatísticas a partir de sessões de exemplo |
| **4. Personalização (Chatinho)** | Embeddings das tarefas, vizinhos mais próximos entre decisões passadas como contexto da IA | Vizinhança em fixture; não usa tarefa de outro usuário |

A fase 1 é a que destrava tudo e dá para validar com `curl`, sem emulador (um alívio, dado o limite de RAM). A fase 2 é a de maior esforço, por causa do tamanho de `priorizar.tsx`.

---

## 10. O que não verifiquei

- Não rodei o Chatinho nem confirmei se os pacotes do `requirements.txt` instalam nesta máquina.
- Não testei a tela `priorizar.tsx` em emulador; descrevi o que o código mostra.
- Preço, limites e id do modelo de IA precisam ser conferidos na documentação do provedor escolhido.
