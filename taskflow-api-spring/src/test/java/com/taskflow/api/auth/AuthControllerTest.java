package com.taskflow.api.auth;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.junit.jupiter.api.Test;
import org.springframework.web.server.ResponseStatusException;

class AuthControllerTest {

  private final AuthService service = mock(AuthService.class);
  private final GoogleAuth google = mock(GoogleAuth.class);
  private final DevLoginRequest body = new DevLoginRequest("a@b.com", null);

  @ParameterizedTest
  @NullAndEmptySource
  @ValueSource(strings = {"false", "1", "TRUE ", "True"})
  void devLoginResponde404ComAFlagDiferenteDeTrue(String flag) {
    AuthController controller = new AuthController(service, google, flag);
    assertThatThrownBy(() -> controller.devLogin(body))
        .isInstanceOfSatisfying(
            ResponseStatusException.class, e -> org.assertj.core.api.Assertions.assertThat(e.getStatusCode().value()).isEqualTo(404));
    verify(service, never()).devLogin(any());
  }

  @Test
  void devLoginChamaOServiceComAFlagTrue() {
    new AuthController(service, google, "true").devLogin(body);
    verify(service).devLogin(body);
  }

  @Test
  void googleLoginConfereOTokenAntesDeChamarOService() {
    // a chamada ao Google fica fora da transação do service: não segura conexão do banco
    var id = new GoogleAuth.Identity("a@b.com", "Ana", null);
    when(google.verify("tok")).thenReturn(id);

    new AuthController(service, google, "false").googleLogin(new GoogleLoginRequest("tok"));

    verify(service).login(id);
  }

  @Test
  void googleLoginComTokenRecusadoNaoChamaOService() {
    when(google.verify("ruim")).thenThrow(new ResponseStatusException(org.springframework.http.HttpStatus.UNAUTHORIZED));

    assertThatThrownBy(() -> new AuthController(service, google, "false").googleLogin(new GoogleLoginRequest("ruim")))
        .isInstanceOf(ResponseStatusException.class);
    verify(service, never()).login(any());
  }
}
