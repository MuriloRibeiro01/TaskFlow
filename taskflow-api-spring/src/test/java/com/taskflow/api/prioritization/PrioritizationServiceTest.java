package com.taskflow.api.prioritization;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.taskflow.api.task.Priority;
import com.taskflow.api.task.Quadrant;
import com.taskflow.api.task.Task;
import com.taskflow.api.task.TaskRepository;
import com.taskflow.api.task.TaskStatus;
import com.taskflow.api.user.User;
import com.taskflow.api.user.UserRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;

class PrioritizationServiceTest {

  private static final int USER = 1;
  private TaskRepository repo;
  private AiClient ai;
  private DailyLimit limit;
  private UserRepository users;
  private PrioritizationService service;

  @BeforeEach
  void setUp() {
    repo = mock(TaskRepository.class);
    ai = mock(AiClient.class);
    limit = mock(DailyLimit.class);
    users = mock(UserRepository.class);
    service = new PrioritizationService(repo, users, ai, limit);
  }

  private static Task task(int id, Priority priority) {
    Task t = new Task();
    ReflectionTestUtils.setField(t, "id", id);
    t.setUserId(USER);
    t.setTitle("Tarefa " + id);
    t.setPriority(priority);
    return t;
  }

  private void pending(Task... tasks) {
    when(repo.findByUserIdAndStatusNotOrderByCreatedAtDesc(USER, TaskStatus.done)).thenReturn(List.of(tasks));
  }

  private static AiScore score(Integer id, Integer imp, Integer urg) {
    return new AiScore(id, imp, urg, 80, "porque sim");
  }

  @Test
  void usaAsNotasDaIaECalculaOQuadranteNoServidor() {
    pending(task(1, Priority.low), task(2, Priority.low));
    when(ai.score(any(), any())).thenReturn(List.of(score(1, 90, 90), score(2, 10, 10)));

    SuggestionsResponse r = service.suggest(USER, null);

    assertThat(r.source()).isEqualTo("ai");
    assertThat(r.suggestions()).extracting(Suggestion::taskId).containsExactly(1, 2);
    assertThat(r.suggestions()).extracting(Suggestion::quadrant).containsExactly(Quadrant.fazer_agora, Quadrant.eliminar);
    assertThat(r.suggestions().get(0).justification()).isEqualTo("porque sim");
  }

  @Test
  void descartaIdInventadoNotaIncompletaEDuplicada() {
    pending(task(1, Priority.low));
    when(ai.score(any(), any()))
        .thenReturn(List.of(score(99, 90, 90), score(null, 90, 90), score(1, null, 50), score(1, 70, 70), score(1, 10, 10)));

    SuggestionsResponse r = service.suggest(USER, null);

    assertThat(r.suggestions()).hasSize(1);
    assertThat(r.suggestions().get(0).importance()).isEqualTo(70); // primeira nota válida
  }

  @Test
  void recortaNotasEJustificativa() {
    pending(task(1, Priority.low));
    when(ai.score(any(), any())).thenReturn(List.of(new AiScore(1, 150, -5, 120, "x".repeat(300))));

    Suggestion s = service.suggest(USER, null).suggestions().get(0);

    assertThat(s.importance()).isEqualTo(100);
    assertThat(s.urgency()).isEqualTo(0);
    assertThat(s.confidence()).isEqualTo(100);
    assertThat(s.justification()).hasSize(200);
  }

  @Test
  void tarefaQueAIaNaoDevolveuVemDaRegra() {
    pending(task(1, Priority.low), task(2, Priority.high));
    when(ai.score(any(), any())).thenReturn(List.of(score(1, 10, 10)));

    SuggestionsResponse r = service.suggest(USER, null);

    assertThat(r.source()).isEqualTo("ai");
    assertThat(r.suggestions()).extracting(Suggestion::taskId).containsExactly(1, 2);
    assertThat(r.suggestions().get(1).importance()).isEqualTo(80); // regra: prioridade alta
    assertThat(r.suggestions().get(1).confidence()).isEqualTo(40);
  }

  @Test
  void falhaDaIaCaiNaRegra() {
    pending(task(1, Priority.high));
    when(ai.score(any(), any())).thenThrow(new IllegalStateException("fora do ar"));

    SuggestionsResponse r = service.suggest(USER, null);

    assertThat(r.source()).isEqualTo("rules");
    assertThat(r.suggestions()).hasSize(1);
  }

  @Test
  void iaSemNenhumaNotaValidaTambemViraRegra() {
    pending(task(1, Priority.high));
    when(ai.score(any(), any())).thenReturn(List.of(score(99, 50, 50)));

    assertThat(service.suggest(USER, null).source()).isEqualTo("rules");
  }

  @Test
  void semTarefasNaoChamaAIa() {
    pending();

    SuggestionsResponse r = service.suggest(USER, null);

    assertThat(r.suggestions()).isEmpty();
    verify(ai, never()).score(any(), any());
  }

  @Test
  void taskIdsExplicitosSaoConferidosPeloDono() {
    when(repo.findByIdAndUserId(5, USER)).thenReturn(Optional.of(task(5, Priority.low)));
    when(repo.findByIdAndUserId(6, USER)).thenReturn(Optional.empty());
    when(ai.score(any(), any())).thenReturn(List.of());

    assertThat(service.suggest(USER, List.of(5)).suggestions()).extracting(Suggestion::taskId).containsExactly(5);
    assertThatThrownBy(() -> service.suggest(USER, List.of(5, 6)))
        .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND));
  }

  @Test
  void semTaskIdsLimitaA30MaisRecentes() {
    List<Task> many = new ArrayList<>();
    for (int i = 1; i <= 31; i++) many.add(task(i, Priority.low));
    when(repo.findByUserIdAndStatusNotOrderByCreatedAtDesc(USER, TaskStatus.done)).thenReturn(many);
    when(ai.score(any(), any())).thenReturn(List.of());

    SuggestionsResponse r = service.suggest(USER, null);

    assertThat(r.suggestions()).hasSize(30);
    assertThat(r.suggestions().get(0).taskId()).isEqualTo(1);
  }

  @Test
  void passaAIaSoOQueEla_precisaDaTarefa() {
    Task t = task(1, Priority.high);
    t.setDescription("detalhe");
    pending(t);
    when(ai.score(any(), any())).thenReturn(List.of());

    service.suggest(USER, null);

    verify(ai).score(null, List.of(new AiTask(1, "Tarefa 1", "detalhe", "high", null, null)));
  }

  @Test
  void enviaARotinaDoUsuarioParaAIa() {
    User user = new User("a@x.com");
    user.setRoutineText("Estudo de manhã");
    when(users.findById(USER)).thenReturn(Optional.of(user));
    pending(task(1, Priority.low));
    when(ai.score(any(), any())).thenReturn(List.of());

    service.suggest(USER, null);

    verify(ai).score(org.mockito.ArgumentMatchers.eq("Estudo de manhã"), any());
  }

  @Test
  void limiteDiarioRecusadoNaoChamaAIa() {
    org.mockito.Mockito.doThrow(new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS)).when(limit).check(USER);
    pending(task(1, Priority.low));

    assertThatThrownBy(() -> service.suggest(USER, null)).isInstanceOf(ResponseStatusException.class);
    verify(ai, never()).score(any(), any());
  }
}
