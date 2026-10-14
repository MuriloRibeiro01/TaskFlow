package com.taskflow.api.auth;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class AuthControllerTest {

  private final AuthService service = mock(AuthService.class);
  private final DevLoginRequest body = new DevLoginRequest("a@b.com", null);

  @ParameterizedTest
  @NullAndEmptySource
  @ValueSource(strings = {"false", "1", "TRUE ", "True"})
  void devLoginResponde404ComAFlagDiferenteDeTrue(String flag) {
    AuthController controller = new AuthController(service, flag);
    assertThatThrownBy(() -> controller.devLogin(body))
        .isInstanceOfSatisfying(
            ResponseStatusException.class, e -> org.assertj.core.api.Assertions.assertThat(e.getStatusCode().value()).isEqualTo(404));
    verify(service, never()).devLogin(any());
  }

  @Test
  void devLoginChamaOServiceComAFlagTrue() {
    new AuthController(service, "true").devLogin(body);
    verify(service).devLogin(body);
  }
}
