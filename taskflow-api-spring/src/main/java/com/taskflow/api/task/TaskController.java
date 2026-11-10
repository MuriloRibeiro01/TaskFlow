package com.taskflow.api.task;

import com.taskflow.api.auth.CurrentUser;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

// Ids acima do INT do Postgres já falham na conversão para Integer (400), como o ParseIdPipe do Nest.
@RestController
@RequestMapping("/tasks")
class TaskController {

  private final TaskService tasks;

  TaskController(TaskService tasks) {
    this.tasks = tasks;
  }

  @PostMapping
  @ResponseStatus(HttpStatus.CREATED)
  Task create(@AuthenticationPrincipal Jwt jwt, @Valid @RequestBody CreateTaskRequest request) {
    return tasks.create(CurrentUser.id(jwt), request);
  }

  @GetMapping
  List<Task> findAll(@AuthenticationPrincipal Jwt jwt, @RequestParam(required = false) TaskStatus status) {
    return tasks.findAll(CurrentUser.id(jwt), status);
  }

  @GetMapping("/{id}")
  Task findOne(@AuthenticationPrincipal Jwt jwt, @PathVariable @Min(1) Integer id) {
    return tasks.findOne(CurrentUser.id(jwt), id);
  }

  @PatchMapping("/{id}")
  Task update(
      @AuthenticationPrincipal Jwt jwt,
      @PathVariable @Min(1) Integer id,
      @Valid @RequestBody UpdateTaskRequest request) {
    return tasks.update(CurrentUser.id(jwt), id, request);
  }

  @DeleteMapping("/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  void remove(@AuthenticationPrincipal Jwt jwt, @PathVariable @Min(1) Integer id) {
    tasks.remove(CurrentUser.id(jwt), id);
  }
}
