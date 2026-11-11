package com.taskflow.api.prioritization;

import java.util.List;

/** source: "ai" ou "rules" (regra por prazo e prioridade, quando a IA falhou ou não está configurada). */
public record SuggestionsResponse(String source, List<Suggestion> suggestions) {}
