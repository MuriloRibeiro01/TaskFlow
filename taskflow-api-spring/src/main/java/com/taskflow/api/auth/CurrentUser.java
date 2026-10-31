package com.taskflow.api.auth;

import org.springframework.security.oauth2.jwt.Jwt;

public final class CurrentUser {

  private CurrentUser() {}

  /** O id do usuário vem sempre do token assinado, nunca do corpo da requisição. */
  public static int id(Jwt jwt) {
    return Integer.parseInt(jwt.getSubject());
  }
}
