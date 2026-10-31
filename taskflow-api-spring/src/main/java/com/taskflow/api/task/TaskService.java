package com.taskflow.api.task;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
public class TaskService {

  private final TaskRepository tasks;

  TaskService(TaskRepository tasks) {
    this.tasks = tasks;
  }

  public Task create(int userId, CreateTaskRequest request) {
    Task task = new Task();
    task.setUserId(userId);
    task.setTitle(request.title());
    task.setDescription(request.description());
    if (request.priority() != null) task.setPriority(request.priority());
    task.setEstimatedPomodoros(request.estimatedPomodoros());
    task.setDueDate(request.dueDate());
    task.setQuadrant(request.quadrant());
    return tasks.save(task);
  }

  public List<Task> findAll(int userId, TaskStatus status) {
    return status == null
        ? tasks.findByUserIdOrderByCreatedAtDesc(userId)
        : tasks.findByUserIdAndStatusOrderByCreatedAtDesc(userId, status);
  }

  /** 404 (e não 403) também para tarefa de outro usuário, para não revelar que o id existe. */
  public Task findOne(int userId, int id) {
    return tasks.findByIdAndUserId(id, userId).orElseThrow(TaskService::notFound);
  }

  @Transactional
  public Task update(int userId, int id, UpdateTaskRequest request) {
    Task task = findOne(userId, id);
    if (request.title() != null) task.setTitle(request.title());
    if (request.description() != null) task.setDescription(request.description());
    if (request.priority() != null) task.setPriority(request.priority());
    if (request.estimatedPomodoros() != null) task.setEstimatedPomodoros(request.estimatedPomodoros());
    if (request.completedPomodoros() != null) task.setCompletedPomodoros(request.completedPomodoros());
    if (request.dueDate() != null) task.setDueDate(request.dueDate());
    if (request.quadrant() != null) task.setQuadrant(request.quadrant());
    if (request.status() != null) {
      if (request.status() == TaskStatus.done && task.getStatus() != TaskStatus.done) {
        task.setCompletedAt(Task.now());
      } else if (request.status() != TaskStatus.done) {
        task.setCompletedAt(null);
      }
      task.setStatus(request.status());
    }
    return tasks.save(task);
  }

  public void remove(int userId, int id) {
    if (tasks.deleteByIdAndUserId(id, userId) == 0) throw notFound();
  }

  private static ResponseStatusException notFound() {
    return new ResponseStatusException(HttpStatus.NOT_FOUND);
  }
}
