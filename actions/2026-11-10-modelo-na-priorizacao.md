# 2026-11-10 — Modelo treinado com a planilha ligado à priorização

## O que mudou
- `taskflow-ml/` (novo): `treinar.py` lê `tarefas_treino.xlsx`, treina TF-IDF (palavras e pares) + regressão logística pelo **título** e exporta os pesos em `taskflow-api-spring/src/main/resources/modelo-prioridade.json`. Gera também `src/test/resources/modelo-paridade.json` (probabilidades de referência) e `relatorio.txt`. 7 testes em `test_treinar.py` (escritos antes).
- `PriorityModel` (Spring): repete em Java a conta do scikit-learn. Sem Python em produção, sem chave, sem custo.
- `RuleBasedScorer`: quando o modelo reconhece o título, importância = média entre a prioridade escolhida pelo usuário e a esperada pelo modelo; confiança = maior probabilidade; justificativa cita a classe e o %. Urgência continua só pelo prazo. Título sem nenhum termo conhecido: comportamento anterior.
- API: `source` agora pode ser `"ai"`, `"model"` ou `"rules"`. App: tipo e aviso da tela de comparação para `model`.

## Resultado do treino (1.056 tarefas únicas)
- Chute "sempre medium": 44,4%. Modelo, validação cruzada: 63,1%. Separando títulos parecidos (grupos pela 1ª palavra): 49,9%.
- A planilha ensina importância, não urgência (o prazo quase não varia entre as classes).

## Testes
- Python 7 verdes; Spring 106 verdes (inclui paridade Java x Python, tolerância 1e-4); Jest 104 verdes.
- Conferido com `curl` na API do Docker: `source: "model"`, importâncias diferentes para a mesma prioridade conforme o título.

## Limitações (dizer na apresentação)
- Dados sintéticos gerados por IA: o acerto não vale para tarefas reais. Sem validação com usuários.
- `low` é a classe mais fraca (confundida com `medium`).
- Ao mudar a planilha: `python taskflow-ml/treinar.py` e commitar os dois JSONs.
- Se `ANTHROPIC_API_KEY` for definida, a IA externa continua tendo prioridade; o modelo entra quando ela falha ou não existe.
