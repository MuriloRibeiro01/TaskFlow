# TaskFlow — Modelo de priorização (ML)

Treina o classificador que estima a prioridade de uma tarefa (`high`, `medium` ou `low`) a partir do título. Os pesos são exportados em JSON e aplicados em Java pela [API](../api/README.md): não há Python em produção.

## Instalação e execução

### Pré-requisitos

- Python 3.11+

### Dependências

```bash
cd ml
python3 -m venv .venv
source .venv/bin/activate          # Windows: .venv\Scripts\activate
pip install -r requirements.txt    # pandas, openpyxl, scikit-learn, pytest
```

Não há variáveis de ambiente.

### Treinar

```bash
python treinar.py
```

Gera:

| Arquivo | Conteúdo |
|---|---|
| `../api/src/main/resources/modelo-prioridade.json` | Vocabulário, pesos e classes usados pela API |
| `../api/src/test/resources/modelo-paridade.json` | Frases de referência e as probabilidades do Python, para o teste Java conferir que calcula o mesmo |
| `relatorio.txt` | Acurácia na validação cruzada |

Depois de treinar, reconstrua a API para o novo modelo entrar no JAR (na raiz): `docker compose up --build`.

### Testes

```bash
pytest
```

## Como funciona

- **Dados:** `tarefas_treino.xlsx`, com as colunas `tarefa`, `prazo`, `prioridade` e `contexto`. Títulos duplicados são removidos; planilha sem coluna obrigatória ou com prioridade inválida é recusada.
- **Modelo:** TF-IDF de palavras e pares de palavras + regressão logística (scikit-learn).
- **Na API:** `PriorityModel` lê o JSON e é a segunda opção da priorização: entra quando a IA da Anthropic não está configurada ou falha. Se o modelo também não responder, a API usa regras por prazo e prioridade.
