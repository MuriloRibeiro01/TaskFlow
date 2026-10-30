package com.taskflow.api.task;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Enumerated;
import jakarta.persistence.EnumType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "tasks")
public class Task {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Integer id;

  private Integer userId;

  @Column(nullable = false)
  private String title;

  private String description;

  @Enumerated(EnumType.STRING)
  @JdbcTypeCode(SqlTypes.NAMED_ENUM)
  @Column(nullable = false)
  private Priority priority = Priority.medium;

  private Integer estimatedPomodoros;

  @Column(nullable = false)
  private Integer completedPomodoros = 0;

  @Enumerated(EnumType.STRING)
  @JdbcTypeCode(SqlTypes.NAMED_ENUM)
  @Column(nullable = false)
  private TaskStatus status = TaskStatus.pending;

  private Instant completedAt;

  private Instant dueDate;

  @Enumerated(EnumType.STRING)
  private Quadrant quadrant;

  @Enumerated(EnumType.STRING)
  @JdbcTypeCode(SqlTypes.NAMED_ENUM)
  @Column(nullable = false)
  private SyncStatus syncStatus = SyncStatus.pending;

  @Column(nullable = false, updatable = false)
  private Instant createdAt;

  // NOT NULL sem default no banco: o Prisma preenchia no client, agora é o @PrePersist.
  @Column(nullable = false)
  private Instant updatedAt;

  @PrePersist
  void onCreate() {
    createdAt = now();
    updatedAt = createdAt;
  }

  @PreUpdate
  void onUpdate() {
    updatedAt = now();
  }

  /** A coluna guarda milissegundos; truncar evita devolver no JSON um valor diferente do gravado. */
  static Instant now() {
    return Instant.now().truncatedTo(ChronoUnit.MILLIS);
  }

  public Integer getId() { return id; }
  public Integer getUserId() { return userId; }
  public void setUserId(Integer userId) { this.userId = userId; }
  public String getTitle() { return title; }
  public void setTitle(String title) { this.title = title; }
  public String getDescription() { return description; }
  public void setDescription(String description) { this.description = description; }
  public Priority getPriority() { return priority; }
  public void setPriority(Priority priority) { this.priority = priority; }
  public Integer getEstimatedPomodoros() { return estimatedPomodoros; }
  public void setEstimatedPomodoros(Integer estimatedPomodoros) { this.estimatedPomodoros = estimatedPomodoros; }
  public Integer getCompletedPomodoros() { return completedPomodoros; }
  public void setCompletedPomodoros(Integer completedPomodoros) { this.completedPomodoros = completedPomodoros; }
  public TaskStatus getStatus() { return status; }
  public void setStatus(TaskStatus status) { this.status = status; }
  public Instant getCompletedAt() { return completedAt; }
  public void setCompletedAt(Instant completedAt) { this.completedAt = completedAt; }
  public Instant getDueDate() { return dueDate; }
  public void setDueDate(Instant dueDate) { this.dueDate = dueDate; }
  public Quadrant getQuadrant() { return quadrant; }
  public void setQuadrant(Quadrant quadrant) { this.quadrant = quadrant; }
  public SyncStatus getSyncStatus() { return syncStatus; }
  public Instant getCreatedAt() { return createdAt; }
  public Instant getUpdatedAt() { return updatedAt; }
}
