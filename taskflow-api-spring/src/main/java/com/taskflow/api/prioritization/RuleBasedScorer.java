package com.taskflow.api.prioritization;

import com.taskflow.api.task.Quadrant;
import com.taskflow.api.task.Task;
import java.time.Duration;
import java.time.Instant;

/** Plano B sem IA: importância pela prioridade da tarefa e urgência pelo prazo. */
class RuleBasedScorer {

  Suggestion score(Task task, Instant now) {
    int importance =
        switch (task.getPriority()) {
          case high -> 80;
          case medium -> 50;
          case low -> 20;
        };
    int urgency = urgency(task.getDueDate(), now);
    return new Suggestion(
        task.getId(),
        importance,
        urgency,
        Quadrant.of(importance, urgency),
        40,
        "Estimativa automática pela prioridade e pelo prazo.");
  }

  private static int urgency(Instant due, Instant now) {
    if (due == null) return 30;
    if (!due.isAfter(now.plus(Duration.ofDays(2)))) return 90; // inclui vencidas
    if (!due.isAfter(now.plus(Duration.ofDays(7)))) return 60;
    return 20;
  }
}
