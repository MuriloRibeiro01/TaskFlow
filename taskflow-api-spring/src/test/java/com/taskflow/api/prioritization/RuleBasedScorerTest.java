package com.taskflow.api.prioritization;

import static org.assertj.core.api.Assertions.assertThat;

import com.taskflow.api.task.Priority;
import com.taskflow.api.task.Quadrant;
import com.taskflow.api.task.Task;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class RuleBasedScorerTest {

  private static final Instant NOW = Instant.parse("2026-11-10T12:00:00Z");
  private final RuleBasedScorer scorer = new RuleBasedScorer();

  private static Task task(Priority priority, Instant dueDate) {
    Task t = new Task();
    t.setTitle("t");
    t.setPriority(priority);
    t.setDueDate(dueDate);
    return t;
  }

  @Test
  void quadranteSaiDasDuasNotasComCorteEm50() {
    assertThat(Quadrant.of(50, 50)).isEqualTo(Quadrant.fazer_agora);
    assertThat(Quadrant.of(50, 49)).isEqualTo(Quadrant.agendar);
    assertThat(Quadrant.of(49, 50)).isEqualTo(Quadrant.delegar);
    assertThat(Quadrant.of(0, 0)).isEqualTo(Quadrant.eliminar);
  }

  @Test
  void importanciaVemDaPrioridade() {
    assertThat(scorer.score(task(Priority.high, null), NOW).importance()).isEqualTo(80);
    assertThat(scorer.score(task(Priority.medium, null), NOW).importance()).isEqualTo(50);
    assertThat(scorer.score(task(Priority.low, null), NOW).importance()).isEqualTo(20);
  }

  @Test
  void urgenciaVemDoPrazo() {
    assertThat(scorer.score(task(Priority.low, NOW.minus(Duration.ofDays(3))), NOW).urgency()).isEqualTo(90); // vencida
    assertThat(scorer.score(task(Priority.low, NOW.plus(Duration.ofDays(2))), NOW).urgency()).isEqualTo(90);
    assertThat(scorer.score(task(Priority.low, NOW.plus(Duration.ofDays(7))), NOW).urgency()).isEqualTo(60);
    assertThat(scorer.score(task(Priority.low, NOW.plus(Duration.ofDays(30))), NOW).urgency()).isEqualTo(20);
    assertThat(scorer.score(task(Priority.low, null), NOW).urgency()).isEqualTo(30);
  }

  @Test
  void devolveQuadranteConfiancaBaixaEJustificativa() {
    Suggestion s = scorer.score(task(Priority.high, NOW.plus(Duration.ofDays(1))), NOW);

    assertThat(s.quadrant()).isEqualTo(Quadrant.fazer_agora);
    assertThat(s.confidence()).isEqualTo(40);
    assertThat(s.justification()).isNotBlank();
  }
}
