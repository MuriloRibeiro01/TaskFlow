package com.taskflow.api.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class TaskServiceTest {

  private static final int USER = 1;
  private TaskRepository repo;
  private TaskService service;
  private Task existing;

  @BeforeEach
  void setUp() {
    repo = mock(TaskRepository.class);
    service = new TaskService(repo);
    existing = new Task();
    existing.setUserId(USER);
    existing.setTitle("Estudar");
    when(repo.save(any(Task.class))).thenAnswer(inv -> inv.getArgument(0));
    when(repo.findByIdAndUserId(10, USER)).thenReturn(Optional.of(existing));
  }

  private static UpdateTaskRequest update(String title, TaskStatus status) {
    return new UpdateTaskRequest(title, null, null, null, status, null);
  }

  @Test
  void createGravaComOUserIdDoTokenEOsDefaults() {
    Task created = service.create(USER, new CreateTaskRequest("Estudar", null, null, 3));
    assertThat(created.getUserId()).isEqualTo(USER);
    assertThat(created.getTitle()).isEqualTo("Estudar");
    assertThat(created.getEstimatedPomodoros()).isEqualTo(3);
    assertThat(created.getPriority()).isEqualTo(Priority.medium);
  }

  @Test
  void findAllFiltraPeloUsuarioEOrdenaDaMaisNova() {
    service.findAll(USER, null);
    verify(repo).findByUserIdOrderByCreatedAtDesc(USER);
  }

  @Test
  void findAllAplicaOFiltroDeStatus() {
    when(repo.findByUserIdAndStatusOrderByCreatedAtDesc(USER, TaskStatus.done)).thenReturn(List.of());
    service.findAll(USER, TaskStatus.done);
    verify(repo).findByUserIdAndStatusOrderByCreatedAtDesc(USER, TaskStatus.done);
  }

  @Test
  void findOneBuscaPorIdEUsuario() {
    assertThat(service.findOne(USER, 10)).isSameAs(existing);
  }

  @Test
  void findOneResponde404ParaTarefaInexistenteOuDeOutroUsuario() {
    when(repo.findByIdAndUserId(10, USER)).thenReturn(Optional.empty());
    assertThatThrownBy(() -> service.findOne(USER, 10))
        .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode().value()).isEqualTo(404));
  }

  @Test
  void updateResponde404ENaoSalvaTarefaDeOutroUsuario() {
    when(repo.findByIdAndUserId(10, USER)).thenReturn(Optional.empty());
    assertThatThrownBy(() -> service.update(USER, 10, update("x", null))).isInstanceOf(ResponseStatusException.class);
    verify(repo, never()).save(any());
  }

  @Test
  void updatePreencheCompletedAtAoMudarParaDone() {
    Task updated = service.update(USER, 10, update(null, TaskStatus.done));
    assertThat(updated.getStatus()).isEqualTo(TaskStatus.done);
    assertThat(updated.getCompletedAt()).isNotNull();
  }

  @Test
  void updateMantemOCompletedAtOriginalQuandoJaEstavaDone() {
    Instant original = Instant.parse("2026-10-01T10:00:00Z");
    existing.setStatus(TaskStatus.done);
    existing.setCompletedAt(original);
    assertThat(service.update(USER, 10, update(null, TaskStatus.done)).getCompletedAt()).isEqualTo(original);
  }

  @Test
  void updateLimpaOCompletedAtAoSairDeDone() {
    existing.setStatus(TaskStatus.done);
    existing.setCompletedAt(Instant.now());
    assertThat(service.update(USER, 10, update(null, TaskStatus.pending)).getCompletedAt()).isNull();
  }

  @Test
  void updateSemStatusNaoMexeNoCompletedAtNemNosOutrosCampos() {
    existing.setDescription("antiga");
    Task updated = service.update(USER, 10, update("Novo", null));
    assertThat(updated.getTitle()).isEqualTo("Novo");
    assertThat(updated.getDescription()).isEqualTo("antiga");
    assertThat(updated.getCompletedAt()).isNull();
    assertThat(updated.getStatus()).isEqualTo(TaskStatus.pending);
  }

  @Test
  void removeApagaComOwnershipNumaQuery() {
    when(repo.deleteByIdAndUserId(10, USER)).thenReturn(1);
    service.remove(USER, 10);
    verify(repo).deleteByIdAndUserId(10, USER);
  }

  @Test
  void removeResponde404QuandoNadaFoiApagado() {
    when(repo.deleteByIdAndUserId(10, USER)).thenReturn(0);
    assertThatThrownBy(() -> service.remove(USER, 10)).isInstanceOf(ResponseStatusException.class);
  }
}
