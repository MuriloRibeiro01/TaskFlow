package com.taskflow.api.prioritization;

import com.taskflow.api.task.Quadrant;
import com.taskflow.api.task.Task;
import com.taskflow.api.task.TaskRepository;
import com.taskflow.api.task.TaskStatus;
import com.taskflow.api.user.User;
import com.taskflow.api.user.UserRepository;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class PrioritizationService {

  static final int MAX_TASKS = 30;
  private static final int MAX_JUSTIFICATION = 200;
  private static final Logger log = LoggerFactory.getLogger(PrioritizationService.class);

  private final TaskRepository tasks;
  private final UserRepository users;
  private final AiClient ai;
  private final DailyLimit limit;
  private final RuleBasedScorer rules;

  PrioritizationService(TaskRepository tasks, UserRepository users, AiClient ai, DailyLimit limit) {
    this(tasks, users, ai, limit, null);
  }

  @Autowired
  PrioritizationService(TaskRepository tasks, UserRepository users, AiClient ai, DailyLimit limit, PriorityModel model) {
    this.tasks = tasks;
    this.users = users;
    this.ai = ai;
    this.limit = limit;
    this.rules = new RuleBasedScorer(model);
  }

  public SuggestionsResponse suggest(int userId, List<Integer> taskIds) {
    limit.check(userId);
    List<Task> selected = select(userId, taskIds);
    if (selected.isEmpty()) return new SuggestionsResponse("rules", List.of());

    Map<Integer, Suggestion> fromAi = askAi(routine(userId), selected);
    Instant now = Instant.now();
    List<Suggestion> result =
        selected.stream().map(t -> fromAi.containsKey(t.getId()) ? fromAi.get(t.getId()) : rules.score(t, now)).toList();
    String source = !fromAi.isEmpty() ? "ai" : selected.stream().anyMatch(rules::knows) ? "model" : "rules";
    return new SuggestionsResponse(source, result);
  }

  /** Explícitas: todas têm que ser do usuário (404 se não). Sem lista: as 30 não concluídas mais recentes. */
  private List<Task> select(int userId, List<Integer> taskIds) {
    if (taskIds == null) {
      return tasks.findByUserIdAndStatusNotOrderByCreatedAtDesc(userId, TaskStatus.done).stream().limit(MAX_TASKS).toList();
    }
    return new LinkedHashSet<>(taskIds).stream()
        .map(id -> tasks.findByIdAndUserId(id, userId).orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND)))
        .toList();
  }

  /** Só a nota válida de uma tarefa pedida entra; o resto (id inventado, nota ausente, repetida) é descartado. */
  private Map<Integer, Suggestion> askAi(String routine, List<Task> selected) {
    Map<Integer, Suggestion> valid = new LinkedHashMap<>();
    Map<Integer, Task> byId = selected.stream().collect(Collectors.toMap(Task::getId, Function.identity()));
    try {
      List<AiTask> input = selected.stream().map(PrioritizationService::toAiTask).toList();
      for (AiScore s : ai.score(routine, input)) {
        if (s.taskId() == null || !byId.containsKey(s.taskId()) || s.importance() == null || s.urgency() == null) continue;
        int importance = clamp(s.importance());
        int urgency = clamp(s.urgency());
        valid.putIfAbsent(
            s.taskId(),
            new Suggestion(
                s.taskId(),
                importance,
                urgency,
                Quadrant.of(importance, urgency),
                s.confidence() == null ? 50 : clamp(s.confidence()),
                cut(s.justification())));
      }
    } catch (RuntimeException e) {
      // Só a classe: a mensagem pode trazer pedaço do que foi enviado.
      log.warn("IA indisponível, usando a regra de reserva: {}", e.getClass().getSimpleName());
    }
    return valid;
  }

  private String routine(int userId) {
    return users.findById(userId).map(User::getRoutineText).orElse(null);
  }

  private static AiTask toAiTask(Task t) {
    return new AiTask(t.getId(), t.getTitle(), t.getDescription(), t.getPriority().name(), t.getDueDate(), t.getEstimatedPomodoros());
  }

  private static int clamp(int v) {
    return Math.max(0, Math.min(100, v));
  }

  private static String cut(String s) {
    if (s == null) return "";
    return s.length() <= MAX_JUSTIFICATION ? s : s.substring(0, MAX_JUSTIFICATION);
  }
}
