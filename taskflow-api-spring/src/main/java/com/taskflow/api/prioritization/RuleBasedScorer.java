package com.taskflow.api.prioritization;

import com.taskflow.api.task.Quadrant;
import com.taskflow.api.task.Task;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;

/**
 * Plano B sem IA externa: urgência pelo prazo; importância pela prioridade da tarefa e, quando há modelo treinado
 * que reconhece o título, pela média entre as duas.
 */
class RuleBasedScorer {

  private final PriorityModel model;

  RuleBasedScorer() {
    this(null);
  }

  RuleBasedScorer(PriorityModel model) {
    this.model = model;
  }

  /** Se o modelo treinado tem algo a dizer sobre o título desta tarefa. */
  boolean knows(Task task) {
    return model != null && model.predict(task.getTitle()).isPresent();
  }

  Suggestion score(Task task, Instant now) {
    int importance =
        switch (task.getPriority()) {
          case high -> 80;
          case medium -> 50;
          case low -> 20;
        };
    int urgency = urgency(task.getDueDate(), now);
    int confidence = 40;
    String justification = "Estimativa automática pela prioridade e pelo prazo.";

    Map<String, Double> p = model == null ? null : model.predict(task.getTitle()).orElse(null);
    if (p != null) {
      double fromText = 85 * p.get("high") + 50 * p.get("medium") + 15 * p.get("low");
      importance = (int) Math.round((importance + fromText) / 2);
      String best = p.entrySet().stream().max(Map.Entry.comparingByValue()).orElseThrow().getKey();
      confidence = (int) Math.round(p.get(best) * 100);
      justification = "O título lembra tarefas de prioridade " + label(best) + " (" + confidence + "%); urgência pelo prazo.";
    }
    return new Suggestion(task.getId(), importance, urgency, Quadrant.of(importance, urgency), confidence, justification);
  }

  private static String label(String cls) {
    return switch (cls) {
      case "high" -> "alta";
      case "medium" -> "média";
      default -> "baixa";
    };
  }

  private static int urgency(Instant due, Instant now) {
    if (due == null) return 30;
    if (!due.isAfter(now.plus(Duration.ofDays(2)))) return 90; // inclui vencidas
    if (!due.isAfter(now.plus(Duration.ofDays(7)))) return 60;
    return 20;
  }
}
