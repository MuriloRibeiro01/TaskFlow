package com.taskflow.api.session;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

public record CreateSessionRequest(
    Integer taskId,
    @NotNull Instant startedAt,
    Instant endedAt,
    @Min(0) @Max(SessionLimits.MAX_DURATION_SECONDS) Integer durationSeconds,
    @NotNull SessionType type,
    @NotNull SessionStatus status) {

  @JsonIgnore
  @AssertTrue(message = "endedAt não pode ser antes de startedAt")
  public boolean isEndedAtAfterStartedAt() {
    return endedAt == null || startedAt == null || !endedAt.isBefore(startedAt);
  }
}
