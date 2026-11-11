package com.taskflow.api.prioritization;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

/**
 * Cada pedido pode custar uma chamada paga à IA, então há um teto por usuário por dia (UTC).
 * shortcut: contador em memória zera ao reiniciar e não vale entre instâncias; mover para o banco se houver mais de uma API.
 */
@Component
public class DailyLimit {

  private record Count(LocalDate day, int used) {}

  private final Map<Integer, Count> counts = new ConcurrentHashMap<>();
  private final int max;
  private final Clock clock;

  @Autowired
  DailyLimit(@Value("${taskflow.ai.daily-limit:20}") int max) {
    this(max, Clock.systemUTC());
  }

  DailyLimit(int max, Clock clock) {
    this.max = max;
    this.clock = clock;
  }

  void check(int userId) {
    LocalDate today = LocalDate.now(clock);
    boolean[] allowed = {true};
    counts.compute(
        userId,
        (id, c) -> {
          int used = c == null || !c.day().equals(today) ? 0 : c.used();
          if (used >= max) {
            allowed[0] = false;
            return c;
          }
          return new Count(today, used + 1);
        });
    if (!allowed[0]) throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS);
  }
}
