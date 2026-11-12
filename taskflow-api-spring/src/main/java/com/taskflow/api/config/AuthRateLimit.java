package com.taskflow.api.config;

import com.taskflow.api.common.ApiErrorHandler;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.Clock;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.json.JsonMapper;

/**
 * Limita as tentativas de login (POST /auth/*) por IP, numa janela de 1 minuto: segura quem testa tokens ou cria contas em massa.
 * shortcut: contador em memória (zera ao reiniciar, não vale entre instâncias) e usa o IP da conexão; atrás de proxy,
 * ligar server.forward-headers-strategy=native para enxergar o IP real, ou fazer o limite no proxy.
 */
@Component
class AuthRateLimit extends OncePerRequestFilter {

  private static final long WINDOW_MILLIS = 60_000;
  private static final int CLEANUP_ABOVE = 10_000;

  private record Window(long start, int count) {}

  private final Map<String, Window> windows = new ConcurrentHashMap<>();
  private final int max;
  private final JsonMapper json;
  private final Clock clock;

  @Autowired
  AuthRateLimit(@Value("${taskflow.auth-rate-limit.per-minute:20}") int max, JsonMapper json) {
    this(max, json, Clock.systemUTC());
  }

  AuthRateLimit(int max, JsonMapper json, Clock clock) {
    this.max = max;
    this.json = json;
    this.clock = clock;
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    return !("POST".equals(request.getMethod()) && request.getRequestURI().startsWith("/auth/"));
  }

  @Override
  protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws IOException, jakarta.servlet.ServletException {
    long now = clock.millis();
    if (windows.size() > CLEANUP_ABOVE) windows.values().removeIf(w -> now - w.start() >= WINDOW_MILLIS);
    boolean[] allowed = {true};
    windows.compute(
        request.getRemoteAddr(),
        (ip, w) -> {
          if (w == null || now - w.start() >= WINDOW_MILLIS) return new Window(now, 1);
          if (w.count() >= max) {
            allowed[0] = false;
            return w;
          }
          return new Window(w.start(), w.count() + 1);
        });
    if (allowed[0]) {
      chain.doFilter(request, response);
      return;
    }
    response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
    response.setHeader("Retry-After", "60");
    response.setContentType(MediaType.APPLICATION_JSON_VALUE);
    json.writeValue(response.getOutputStream(), ApiErrorHandler.of(HttpStatus.TOO_MANY_REQUESTS, "Too Many Requests"));
  }
}
