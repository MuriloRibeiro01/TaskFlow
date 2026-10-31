package com.taskflow.api.session;

import com.taskflow.api.task.TaskRepository;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SessionService {

  private final SessionRepository sessions;
  private final TaskRepository tasks;

  SessionService(SessionRepository sessions, TaskRepository tasks) {
    this.sessions = sessions;
    this.tasks = tasks;
  }

  public PomodoroSession create(int userId, CreateSessionRequest request) {
    // 404 também para tarefa de outro usuário: não revela que o id existe.
    if (request.taskId() != null && tasks.findByIdAndUserId(request.taskId(), userId).isEmpty()) {
      throw notFound();
    }
    PomodoroSession s = new PomodoroSession();
    s.setUserId(userId);
    s.setTaskId(request.taskId());
    s.setStartedAt(request.startedAt());
    s.setEndedAt(request.endedAt());
    s.setDurationSeconds(request.durationSeconds());
    s.setType(request.type());
    s.setStatus(request.status());
    return sessions.save(s);
  }

  public List<PomodoroSession> findAll(int userId) {
    return sessions.findByUserIdOrderByStartedAtDesc(userId);
  }

  @Transactional
  public PomodoroSession update(int userId, int id, UpdateSessionRequest request) {
    PomodoroSession s = sessions.findByIdAndUserId(id, userId).orElseThrow(SessionService::notFound);
    if (request.endedAt() != null) s.setEndedAt(request.endedAt());
    if (request.durationSeconds() != null) s.setDurationSeconds(request.durationSeconds());
    if (request.status() != null) s.setStatus(request.status());
    return sessions.save(s);
  }

  public void remove(int userId, int id) {
    if (sessions.deleteByIdAndUserId(id, userId) == 0) throw notFound();
  }

  private static ResponseStatusException notFound() {
    return new ResponseStatusException(HttpStatus.NOT_FOUND);
  }
}
