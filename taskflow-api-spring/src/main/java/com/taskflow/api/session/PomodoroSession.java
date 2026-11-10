package com.taskflow.api.session;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "pomodoro_sessions")
public class PomodoroSession {

  @Id
  @GeneratedValue(strategy = GenerationType.IDENTITY)
  private Integer id;

  private Integer taskId;
  private Integer userId;
  private Instant startedAt;
  private Instant endedAt;
  private Integer durationSeconds;

  @Enumerated(EnumType.STRING)
  @JdbcTypeCode(SqlTypes.NAMED_ENUM)
  private SessionType type;

  @Enumerated(EnumType.STRING)
  @JdbcTypeCode(SqlTypes.NAMED_ENUM)
  private SessionStatus status;

  public Integer getId() { return id; }
  public Integer getTaskId() { return taskId; }
  public void setTaskId(Integer taskId) { this.taskId = taskId; }
  public Integer getUserId() { return userId; }
  public void setUserId(Integer userId) { this.userId = userId; }
  public Instant getStartedAt() { return startedAt; }
  public void setStartedAt(Instant startedAt) { this.startedAt = startedAt; }
  public Instant getEndedAt() { return endedAt; }
  public void setEndedAt(Instant endedAt) { this.endedAt = endedAt; }
  public Integer getDurationSeconds() { return durationSeconds; }
  public void setDurationSeconds(Integer durationSeconds) { this.durationSeconds = durationSeconds; }
  public SessionType getType() { return type; }
  public void setType(SessionType type) { this.type = type; }
  public SessionStatus getStatus() { return status; }
  public void setStatus(SessionStatus status) { this.status = status; }
}
