package com.taskflow.api.config;

import static org.assertj.core.api.Assertions.assertThat;

import com.taskflow.api.common.ApiError;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import tools.jackson.databind.json.JsonMapper;

class AuthRateLimitTest {

  private Instant now = Instant.parse("2026-11-12T10:00:00Z");
  private final Clock clock = new Clock() {
    @Override public java.time.ZoneId getZone() { return ZoneOffset.UTC; }
    @Override public Clock withZone(java.time.ZoneId zone) { return this; }
    @Override public Instant instant() { return now; }
  };
  private final JsonMapper json = JsonMapper.builder().build();

  private MockHttpServletResponse call(AuthRateLimit filter, String method, String path, String ip) throws Exception {
    MockHttpServletRequest req = new MockHttpServletRequest(method, path);
    req.setRemoteAddr(ip);
    MockHttpServletResponse res = new MockHttpServletResponse();
    FilterChain chain = new MockFilterChain();
    filter.doFilter(req, res, chain);
    return res;
  }

  @Test
  void deixaPassarAteOLimiteERecusaDepoisCom429EJson() throws Exception {
    AuthRateLimit filter = new AuthRateLimit(2, json, clock);
    assertThat(call(filter, "POST", "/auth/google", "1.1.1.1").getStatus()).isEqualTo(200);
    assertThat(call(filter, "POST", "/auth/dev-login", "1.1.1.1").getStatus()).isEqualTo(200);

    MockHttpServletResponse blocked = call(filter, "POST", "/auth/google", "1.1.1.1");
    assertThat(blocked.getStatus()).isEqualTo(429);
    assertThat(blocked.getHeader("Retry-After")).isNotNull();
    assertThat(json.readValue(blocked.getContentAsString(), ApiError.class).statusCode()).isEqualTo(429);
  }

  @Test
  void contaPorIpEZeraDepoisDeUmMinuto() throws Exception {
    AuthRateLimit filter = new AuthRateLimit(1, json, clock);
    call(filter, "POST", "/auth/google", "1.1.1.1");

    assertThat(call(filter, "POST", "/auth/google", "2.2.2.2").getStatus()).isEqualTo(200);
    assertThat(call(filter, "POST", "/auth/google", "1.1.1.1").getStatus()).isEqualTo(429);

    now = now.plusSeconds(61);
    assertThat(call(filter, "POST", "/auth/google", "1.1.1.1").getStatus()).isEqualTo(200);
  }

  @Test
  void soLimitaOsLoginsNaoAsDemaisRotas() throws Exception {
    AuthRateLimit filter = new AuthRateLimit(1, json, clock);
    for (int i = 0; i < 5; i++) {
      assertThat(call(filter, "GET", "/tasks", "1.1.1.1").getStatus()).isEqualTo(200);
    }
  }
}
