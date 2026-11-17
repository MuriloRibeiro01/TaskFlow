package com.taskflow.api.application.user;

import com.taskflow.api.infrastructure.jpa.SessionRepository;
import com.taskflow.api.infrastructure.jpa.TaskRepository;
import com.taskflow.api.infrastructure.jpa.UserRepository;
import com.taskflow.api.domain.session.SessionStatus;
import com.taskflow.api.domain.task.TaskStatus;
import com.taskflow.api.domain.user.User;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class UserService {

  private final UserRepository users;
  private final TaskRepository tasks;
  private final SessionRepository sessions;

  UserService(UserRepository users, TaskRepository tasks, SessionRepository sessions) {
    this.users = users;
    this.tasks = tasks;
    this.sessions = sessions;
  }

  /** O token pode continuar válido depois que o usuário foi apagado. */
  public User findMe(int id) {
    return users.findById(id).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
  }

  public User updateMe(int id, UpdateMeRequest request) {
    User user = findMe(id);
    if (request.routineText() != null) {
      user.setRoutineText(request.routineText().isBlank() ? null : request.routineText());
    }
    return users.save(user);
  }

  public MeStatsResponse stats(int userId) {
    LocalDate today = LocalDate.now(ZoneOffset.UTC);
    Instant todayStart = today.atStartOfDay(ZoneOffset.UTC).toInstant();
    Instant todayEnd = today.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant();
    Instant weekStart = today.minusDays(6).atStartOfDay(ZoneOffset.UTC).toInstant();

    int pomodorosToday = sessions.countByUserIdAndStatusAndStartedAtBetween(userId, SessionStatus.completed, todayStart, todayEnd);
    int tasksToday = tasks.countByUserIdAndStatusAndCompletedAtBetween(userId, TaskStatus.done, todayStart, todayEnd);
    int pomodorosWeek = sessions.countByUserIdAndStatusAndStartedAtBetween(userId, SessionStatus.completed, weekStart, todayEnd);

    return new MeStatsResponse(pomodorosToday, tasksToday, pomodorosWeek);
  }
}
