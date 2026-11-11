package com.taskflow.api.prioritization;

import java.util.List;

/**
 * source: "ai" (LLM), "model" (modelo treinado no título, quando a IA externa falhou ou não está configurada)
 * ou "rules" (só prazo e prioridade).
 */
public record SuggestionsResponse(String source, List<Suggestion> suggestions) {}
