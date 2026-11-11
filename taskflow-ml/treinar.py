"""Treina o classificador de prioridade (high/medium/low) a partir do título da tarefa.

TF-IDF (palavras e pares de palavras) + regressão logística. Os pesos são exportados em JSON
e aplicados em Java pelo Spring (sem Python em produção).

Uso: python treinar.py
"""
import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold, StratifiedKFold, cross_val_score
from sklearn.pipeline import make_pipeline

RAIZ = Path(__file__).resolve().parent
PLANILHA = RAIZ / "tarefas_treino.xlsx"
SAIDA_MODELO = RAIZ.parent / "taskflow-api-spring/src/main/resources/modelo-prioridade.json"
SAIDA_REFERENCIAS = RAIZ.parent / "taskflow-api-spring/src/test/resources/modelo-paridade.json"
RELATORIO = RAIZ / "relatorio.txt"

COLUNAS = ["tarefa", "prazo", "prioridade", "contexto"]
CLASSES = {"high", "medium", "low"}
# Frases usadas pelo teste Java para conferir que ele calcula o mesmo que o Python.
FRASES_REFERENCIA = [
    "Pagar boleto do plano de saúde",
    "Corrigir bug crítico em produção",
    "Comprar vela aromática",
    "Estudar para a prova de cálculo",
    "Marcar dentista",
    "Reunião de alinhamento semanal",
    "Churrasco com a turma",
    "ok",
    "Entregar o TCC à orientadora até sexta-feira",
]


def carregar(caminho) -> pd.DataFrame:
    df = pd.read_excel(caminho)
    faltando = [c for c in COLUNAS if c not in df.columns]
    if faltando:
        raise ValueError(f"Colunas ausentes na planilha: {', '.join(faltando)}")
    df = df.dropna(subset=["tarefa", "prioridade"]).copy()
    df["tarefa"] = df["tarefa"].astype(str).str.strip()
    if (df["tarefa"] == "").any():
        raise ValueError("Há tarefa com título vazio na planilha")
    invalidas = set(df["prioridade"]) - CLASSES
    if invalidas:
        raise ValueError(f"Prioridade inválida: {', '.join(sorted(map(str, invalidas)))}")
    df = df.assign(_chave=df["tarefa"].str.lower()).drop_duplicates("_chave").drop(columns="_chave")
    return df.reset_index(drop=True)


def _pipeline():
    vetor = TfidfVectorizer(strip_accents="unicode", lowercase=True, ngram_range=(1, 2), sublinear_tf=True)
    return make_pipeline(vetor, LogisticRegression(max_iter=2000))


def treinar(df: pd.DataFrame):
    modelo = _pipeline()
    modelo.fit(df["tarefa"], df["prioridade"])
    return modelo


def avaliar(df: pd.DataFrame, partes: int = 5) -> dict:
    """Acerto em validação cruzada, comparado ao chute 'sempre a classe mais comum'.

    Também mede com grupos pela 1ª palavra do título, o que separa títulos parecidos entre treino e
    teste e é o número mais honesto para tarefas que o modelo nunca viu.
    """
    chute = float(df["prioridade"].value_counts(normalize=True).max())
    n_min = int(df["prioridade"].value_counts().min())
    k = max(2, min(partes, n_min))
    acerto = cross_val_score(
        _pipeline(), df["tarefa"], df["prioridade"], cv=StratifiedKFold(k, shuffle=True, random_state=0)
    ).mean()
    grupos = df["tarefa"].str.split().str[0].str.lower()
    k_grupos = max(2, min(partes, grupos.nunique()))
    agrupado = cross_val_score(
        _pipeline(), df["tarefa"], df["prioridade"], cv=GroupKFold(k_grupos), groups=grupos
    ).mean()
    return {"acerto": float(acerto), "acerto_agrupado": float(agrupado), "chute": chute}


def exportar(modelo) -> dict:
    vetor = modelo.named_steps["tfidfvectorizer"]
    reg = modelo.named_steps["logisticregression"]
    vocab = sorted(vetor.vocabulary_.items(), key=lambda kv: kv[1])
    return {
        "classes": [str(c) for c in reg.classes_],
        "vocabulario": {termo: int(i) for termo, i in vocab},
        "idf": [round(float(x), 6) for x in vetor.idf_],
        "coef": [[round(float(x), 6) for x in linha] for linha in reg.coef_],
        "intercepto": [round(float(x), 6) for x in reg.intercept_],
    }


def referencias(modelo, frases) -> list:
    probs = modelo.predict_proba(list(frases))
    classes = [str(c) for c in modelo.classes_]
    return [
        {"texto": f, "probabilidades": {c: float(p) for c, p in zip(classes, linha)}}
        for f, linha in zip(frases, probs)
    ]


def main():
    df = carregar(PLANILHA)
    r = avaliar(df)
    modelo = treinar(df)
    exp = exportar(modelo)

    SAIDA_MODELO.write_text(json.dumps(exp, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    SAIDA_REFERENCIAS.parent.mkdir(parents=True, exist_ok=True)
    SAIDA_REFERENCIAS.write_text(
        json.dumps(referencias(modelo, FRASES_REFERENCIA), ensure_ascii=False, indent=1), encoding="utf-8"
    )
    texto = (
        f"Tarefas únicas: {len(df)}\n"
        f"Distribuição: {df['prioridade'].value_counts().to_dict()}\n"
        f"Chute (sempre a classe mais comum): {r['chute']:.1%}\n"
        f"Acerto, validação cruzada: {r['acerto']:.1%}\n"
        f"Acerto, validação com títulos parecidos separados: {r['acerto_agrupado']:.1%}\n"
        f"Termos no vocabulário: {len(exp['vocabulario'])}\n"
        "Observação: a planilha é sintética (gerada por IA); o acerto não vale para tarefas reais.\n"
    )
    RELATORIO.write_text(texto, encoding="utf-8")
    print(texto)


if __name__ == "__main__":
    sys.exit(main())
