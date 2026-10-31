package com.taskflow.api.auth;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/auth")
class AuthController {

  private final AuthService auth;
  private final GoogleAuth google;
  private final boolean devLoginEnabled;

  AuthController(
      AuthService auth, GoogleAuth google, @Value("${taskflow.dev-login-enabled:false}") String devLoginFlag) {
    this.auth = auth;
    this.google = google;
    this.devLoginEnabled = "true".equals(devLoginFlag);
  }

  // Login sem prova de identidade: só existe com ENABLE_DEV_LOGIN=true (nunca em produção).
  @PostMapping("/dev-login")
  LoginResponse devLogin(@Valid @RequestBody DevLoginRequest request) {
    if (!devLoginEnabled) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    return auth.devLogin(request);
  }

  // Troca o ID token do Google pelo JWT desta API. Confere o token antes de abrir a transação,
  // para a chamada ao Google não segurar uma conexão do banco.
  @PostMapping("/google")
  LoginResponse googleLogin(@Valid @RequestBody GoogleLoginRequest request) {
    return auth.login(google.verify(request.idToken()));
  }
}
