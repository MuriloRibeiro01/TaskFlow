package com.taskflow.api.session;

import jakarta.validation.constraints.Min;
import java.time.Instant;

/** Campos ausentes (null) não são alterados. */
public record UpdateSessionRequest(
    Instant endedAt, @Min(0) Integer durationSeconds, SessionStatus status) {}
