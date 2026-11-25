package com.taskflow.api.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import java.util.function.Predicate;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

class JwtValidatorTest {

  private static Jwt.Builder token() {
    Instant now = Instant.now();
    return Jwt.withTokenValue("t")
        .header("alg", "HS256")
        .subject("7")
        .issuer(JwtConfig.ISSUER)
        .audience(List.of(JwtConfig.AUDIENCE))
        .issuedAt(now.minusSeconds(10))
        .expiresAt(now.plusSeconds(600));
  }

  private static boolean valid(Jwt jwt, Predicate<Integer> userExists) {
    return !JwtConfig.validator(userExists).validate(jwt).hasErrors();
  }

  @Test
  void aceitaTokenDaPropriaApiDeUsuarioExistente() {
    assertThat(valid(token().build(), id -> id == 7)).isTrue();
  }

  @Test
  void recusaEmissorOuDestinatarioErrado() {
    assertThat(valid(token().issuer("outra-api").build(), id -> true)).isFalse();
    assertThat(valid(token().audience(List.of("outro-app")).build(), id -> true)).isFalse();
  }

  @Test
  void recusaTokenAntigoSemEmissorNemDestinatario() {
    Jwt old = Jwt.withTokenValue("t").header("alg", "HS256").subject("7").expiresAt(Instant.now().plusSeconds(600)).build();
    assertThat(valid(old, id -> true)).isFalse();
  }

  @Test
  void recusaUsuarioApagado() {
    assertThat(valid(token().build(), id -> false)).isFalse();
  }

  @Test
  void recusaSubjectQueNaoEhNumero() {
    assertThat(valid(token().subject("abc").build(), id -> true)).isFalse();
  }
}
