package com.taskflow.api.application.prioritization;

import com.taskflow.api.domain.task.Quadrant;

/** Notas de 0 a 100; o quadrante é sempre calculado aqui a partir delas, nunca vem do modelo. */
public record Suggestion(
    Integer taskId, int importance, int urgency, Quadrant quadrant, int confidence, String justification) {}
