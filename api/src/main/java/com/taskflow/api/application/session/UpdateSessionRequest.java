package com.taskflow.api.application.session;

import com.taskflow.api.domain.session.SessionStatus;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.Instant;

/** Campos ausentes (null) não são alterados. */
public record UpdateSessionRequest(
    Instant endedAt, @Min(0) @Max(SessionLimits.MAX_DURATION_SECONDS) Integer durationSeconds, SessionStatus status) {}
