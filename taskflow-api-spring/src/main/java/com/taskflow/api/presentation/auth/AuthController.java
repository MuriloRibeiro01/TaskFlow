package com.taskflow.api.presentation.auth;

import com.taskflow.api.application.auth.AuthService;
import com.taskflow.api.application.auth.DevLoginRequest;
import com.taskflow.api.application.auth.EmailAuthRequest;
import com.taskflow.api.application.auth.LoginResponse;

import jakarta.validation.Valid;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/auth")
class AuthController {

  private final AuthService auth;
  private final boolean devLoginEnabled;

  AuthController(AuthService auth, @Value("${taskflow.dev-login-enabled:false}") String devLoginFlag) {
    this.auth = auth;
    this.devLoginEnabled = "true".equals(devLoginFlag);
  }

  // Login sem prova de identidade: só existe com ENABLE_DEV_LOGIN=true (nunca em produção).
  @PostMapping("/dev-login")
  LoginResponse devLogin(@Valid @RequestBody DevLoginRequest request) {
    if (!devLoginEnabled) throw new ResponseStatusException(HttpStatus.NOT_FOUND);
    return auth.devLogin(request);
  }

  @PostMapping("/register")
  LoginResponse register(@Valid @RequestBody EmailAuthRequest request) {
    return auth.register(request);
  }

  @PostMapping("/login")
  LoginResponse emailLogin(@Valid @RequestBody EmailAuthRequest request) {
    return auth.emailLogin(request);
  }

  // JWT é stateless; o app descarta o token localmente — 204 confirma que o token era válido.
  @PostMapping("/logout")
  ResponseEntity<Void> logout() {
    return ResponseEntity.noContent().build();
  }
}
