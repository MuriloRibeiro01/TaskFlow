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
  private final RuleBasedScorer comModelo =
      new RuleBasedScorer(PriorityModel.fromClasspath("/modelo-prioridade.json", tools.jackson.databind.json.JsonMapper.builder().build()));

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

  private static Task titled(String title, Priority priority, Instant dueDate) {
    Task t = task(priority, dueDate);
    t.setTitle(title);
    return t;
  }

  @Test
  void semModeloOuSemTermoConhecidoNaoUsaOModelo() {
    assertThat(scorer.knows(titled("Pagar boleto do plano de saúde", Priority.low, null))).isFalse();
    assertThat(comModelo.knows(titled("zzzqqq", Priority.low, null))).isFalse();
    assertThat(comModelo.score(titled("zzzqqq", Priority.high, null), NOW).importance()).isEqualTo(80);
  }

  @Test
  void modeloEntraNaImportanciaJuntoComAPrioridadeDaTarefa() {
    Task importante = titled("Pagar boleto do plano de saúde", Priority.medium, null);
    Task futil = titled("Comprar vela aromática", Priority.medium, null);

    assertThat(comModelo.knows(importante)).isTrue();
    // mesma prioridade escolhida pelo usuário: quem separa as duas é o texto
    assertThat(comModelo.score(importante, NOW).importance()).isGreaterThan(comModelo.score(futil, NOW).importance());
  }

  @Test
  void importanciaFicaEntreAPrioridadeDaTarefaEAdoModelo() {
    Task t = titled("Comprar vela aromática", Priority.high, null);
    int importance = comModelo.score(t, NOW).importance();
    assertThat(importance).isBetween(15, 80);
    assertThat(importance).isLessThan(80); // o texto puxa para baixo
  }

  @Test
  void confiancaEJustificativaVemDoModelo() {
    Suggestion s = comModelo.score(titled("Pagar boleto do plano de saúde", Priority.high, NOW.plus(Duration.ofDays(1))), NOW);
    assertThat(s.confidence()).isBetween(34, 100); // maior probabilidade de 3 classes é >= 1/3
    assertThat(s.confidence()).isNotEqualTo(40).isNotEqualTo(0);
    assertThat(s.justification()).contains("%").contains("prioridade");
    assertThat(s.urgency()).isEqualTo(90); // urgência continua vindo do prazo
  }
}
