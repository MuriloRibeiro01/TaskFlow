# 2026-11-10 — Modelo de IA treinado com a planilha

## O que mudou
- Nova pasta `taskflow-ml/` (fora do Spring e do app): `treinar.py`, `test_treinar.py`, `requirements.txt`.
- `treinar.py` lê `tarefas_treino.xlsx`, remove duplicadas, treina TF-IDF + regressão logística só com o texto da tarefa e gera `modelo.joblib` e `relatorio.txt`.

## Resultado (validação cruzada, 5 partes, 1.056 tarefas únicas)
- Chute "sempre medium": 44,4%. Só texto: 67,0%. Texto + contexto: 65,9%. Texto + contexto + prazo: 66,7%.
- `low` tem recall baixo (42%): o modelo confunde com `medium`.

## Testes (escritos antes da implementação)
5 testes em `test_treinar.py`: duplicadas removidas, coluna ausente recusada, acerto > chute + 15 pontos, classe válida, texto vazio recusado. Todos verdes.

## Decisões e limitações
- Contexto e prazo ficaram de fora porque não melhoraram o acerto.
- A planilha é sintética: o acerto não vale para tarefas reais.
- Rótulo é high/medium/low, não importância/urgência; o modelo não preenche a matriz 2x2.
- Ainda não ligado ao Spring nem ao app.
