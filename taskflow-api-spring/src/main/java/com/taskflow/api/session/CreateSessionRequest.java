package com.taskflow.api.session;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.time.Instant;

public record CreateSessionRequest(
    Integer taskId,
    @NotNull Instant startedAt,
    Instant endedAt,
    @Min(0) Integer durationSeconds,
    @NotNull SessionType type,
    @NotNull SessionStatus status) {}
