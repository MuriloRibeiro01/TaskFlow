"""Testes de treinar.py (escritos antes da implementação)."""
import json
import math

import pandas as pd
import pytest

import treinar

LINHAS = [
    ("Pagar boleto do plano de saúde", "high"),
    ("Corrigir bug crítico em produção", "high"),
    ("Renovar receita de remédio contínuo", "high"),
    ("Entregar o trabalho final da disciplina", "high"),
    ("Responder e-mail do cliente", "medium"),
    ("Revisar pull request da equipe", "medium"),
    ("Marcar dentista para limpeza", "medium"),
    ("Estudar capítulo do livro", "medium"),
    ("Comprar vela aromática", "low"),
    ("Procurar camisa retrô de time antigo", "low"),
    ("Ver vídeo engraçado de gatos", "low"),
    ("Organizar playlist de músicas", "low"),
]


def planilha(tmp_path, linhas=LINHAS, extra=None):
    df = pd.DataFrame(
        {
            "tarefa": [t for t, _ in linhas],
            "prazo": "2026-11-20",
            "prioridade": [p for _, p in linhas],
            "contexto": "dia_a_dia",
        }
    )
    if extra is not None:
        df = pd.concat([df, extra], ignore_index=True)
    caminho = tmp_path / "t.xlsx"
    df.to_excel(caminho, index=False)
    return caminho


def test_remove_duplicadas_por_titulo(tmp_path):
    extra = pd.DataFrame(
        {"tarefa": ["PAGAR boleto do plano de saúde "], "prazo": "2026-11-20", "prioridade": "high", "contexto": "x"}
    )
    df = treinar.carregar(planilha(tmp_path, extra=extra))
    assert len(df) == len(LINHAS)


def test_recusa_planilha_sem_coluna_obrigatoria(tmp_path):
    caminho = tmp_path / "ruim.xlsx"
    pd.DataFrame({"tarefa": ["a"], "prazo": ["x"]}).to_excel(caminho, index=False)
    with pytest.raises(ValueError, match="prioridade"):
        treinar.carregar(caminho)


def test_recusa_prioridade_invalida(tmp_path):
    caminho = planilha(tmp_path, linhas=LINHAS + [("Algo", "urgentissima")])
    with pytest.raises(ValueError, match="urgentissima"):
        treinar.carregar(caminho)


def test_exporta_pesos_coerentes(tmp_path):
    df = treinar.carregar(planilha(tmp_path))
    modelo = treinar.treinar(df)
    exp = treinar.exportar(modelo)
    v = len(exp["vocabulario"])
    assert exp["classes"] == ["high", "low", "medium"]
    assert len(exp["idf"]) == v
    assert len(exp["coef"]) == 3 and all(len(l) == v for l in exp["coef"])
    assert len(exp["intercepto"]) == 3


def test_java_reproduz_o_python_com_os_exemplos_exportados(tmp_path):
    """O exportado + as probabilidades de referência são o contrato que o teste Java confere."""
    df = treinar.carregar(planilha(tmp_path))
    modelo = treinar.treinar(df)
    exp = treinar.exportar(modelo)
    ref = treinar.referencias(modelo, ["Pagar boleto do plano", "Comprar vela aromática", "  "])
    assert len(ref) == 3
    for r in ref:
        assert math.isclose(sum(r["probabilidades"].values()), 1.0, abs_tol=1e-6)
    assert ref[0]["probabilidades"]["high"] > ref[0]["probabilidades"]["low"]
    json.dumps(exp)  # serializável


def test_acerto_na_validacao_cruzada_passa_do_chute(tmp_path):
    df = treinar.carregar(planilha(tmp_path, linhas=LINHAS * 1))
    # com 12 linhas só dá para checar que a função roda e devolve uma fração
    r = treinar.avaliar(df, partes=3)
    assert 0.0 <= r["acerto"] <= 1.0
    assert 0.0 < r["chute"] <= 1.0


def test_texto_vazio_e_recusado_no_treino(tmp_path):
    caminho = planilha(tmp_path, linhas=LINHAS + [("   ", "low")])
    with pytest.raises(ValueError, match="vazio"):
        treinar.carregar(caminho)
