package com.taskflow.api.prioritization;

/** Resposta crua do modelo: tudo pode vir nulo ou fora da faixa, quem usa valida. */
public record AiScore(Integer taskId, Integer importance, Integer urgency, Integer confidence, String justification) {}
