package com.taskflow.api.prioritization;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

class DailyLimitTest {

  private Instant now = Instant.parse("2026-11-10T10:00:00Z");
  private final Clock clock = new Clock() {
    @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
    @Override public Clock withZone(java.time.ZoneId zone) { return this; }
    @Override public Instant instant() { return now; }
  };

  @Test
  void deixaPassarAteOLimiteERecusaDepoisCom429() {
    DailyLimit limit = new DailyLimit(2, clock);
    limit.check(1);
    limit.check(1);

    assertThatThrownBy(() -> limit.check(1))
        .isInstanceOfSatisfying(ResponseStatusException.class, e -> org.assertj.core.api.Assertions.assertThat(e.getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS));
  }

  @Test
  void contaPorUsuarioEZeraNoDiaSeguinte() {
    DailyLimit limit = new DailyLimit(1, clock);
    limit.check(1);

    assertThatCode(() -> limit.check(2)).doesNotThrowAnyException();

    now = now.plusSeconds(24 * 3600);
    assertThatCode(() -> limit.check(1)).doesNotThrowAnyException();
  }
}
