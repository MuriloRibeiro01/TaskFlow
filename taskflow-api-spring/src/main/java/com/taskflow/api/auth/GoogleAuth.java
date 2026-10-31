package com.taskflow.api.auth;

import java.time.Duration;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

/**
 * Login com Google direto na API: o app manda o ID token que o Google emitiu e aqui se confere a
 * assinatura (chaves públicas do Google), o emissor, o app de destino (client id) e a validade.
 */
@Component
public class GoogleAuth {

  public record Identity(String email, String displayName, String avatarUrl) {}

  static final String JWKS_URI = "https://www.googleapis.com/oauth2/v3/certs";
  private static final Set<String> ISSUERS = Set.of("https://accounts.google.com", "accounts.google.com");
  // Sem limite, um Google lento seguraria a requisição indefinidamente.
  private static final Duration TIMEOUT = Duration.ofSeconds(5);

  private final NimbusJwtDecoder decoder;
  private final boolean configured;

  @Autowired
  GoogleAuth(@Value("${taskflow.google.client-ids:}") String clientIds) {
    this(NimbusJwtDecoder.withJwkSetUri(JWKS_URI).restOperations(http()).build(), clientIds);
  }

  // O teste injeta um decoder ligado a uma chave local.
  GoogleAuth(NimbusJwtDecoder decoder, String clientIds) {
    List<String> audiences =
        Arrays.stream(clientIds == null ? new String[0] : clientIds.split(",")).map(String::trim).filter(s -> !s.isEmpty()).toList();
    this.configured = !audiences.isEmpty();
    this.decoder = decoder;
    decoder.setJwtValidator(
        new DelegatingOAuth2TokenValidator<>(
            new JwtTimestampValidator(),
            new JwtClaimValidator<String>("iss", ISSUERS::contains),
            new JwtClaimValidator<List<String>>("aud", aud -> aud != null && aud.stream().anyMatch(audiences::contains))));
  }

  private static RestTemplate http() {
    SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
    factory.setConnectTimeout(TIMEOUT);
    factory.setReadTimeout(TIMEOUT);
    return new RestTemplate(factory);
  }

  public Identity verify(String idToken) {
    if (!configured) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE);
    Jwt jwt;
    try {
      jwt = decoder.decode(idToken);
    } catch (JwtException e) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }
    // O login casa a conta pelo email: email sem verificação não prova nada.
    String email = jwt.getClaimAsString("email");
    if (email == null || email.isBlank() || !Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified"))) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }
    return new Identity(email, jwt.getClaimAsString("name"), jwt.getClaimAsString("picture"));
  }
}
