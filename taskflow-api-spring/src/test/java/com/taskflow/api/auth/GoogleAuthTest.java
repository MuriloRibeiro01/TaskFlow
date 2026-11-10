package com.taskflow.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.RSAPrivateKey;
import java.security.interfaces.RSAPublicKey;
import java.time.Instant;
import java.util.Map;
import java.util.function.Consumer;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.web.server.ResponseStatusException;

/** O "Google" aqui é uma chave RSA local: o decoder confere a assinatura com a pública dela. */
class GoogleAuthTest {

  private static final KeyPair KEYS = generate();
  private static final KeyPair OTHER_KEYS = generate();

  private static KeyPair generate() {
    try {
      KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA");
      gen.initialize(2048);
      return gen.generateKeyPair();
    } catch (Exception e) {
      throw new IllegalStateException(e);
    }
  }

  private static String sign(KeyPair keys, Consumer<JwtClaimsSet.Builder> customize) {
    RSAKey jwk =
        new RSAKey.Builder((RSAPublicKey) keys.getPublic()).privateKey((RSAPrivateKey) keys.getPrivate()).keyID("k").build();
    Instant now = Instant.now();
    JwtClaimsSet.Builder claims =
        JwtClaimsSet.builder()
            .issuer("https://accounts.google.com")
            .audience(java.util.List.of("web-client"))
            .subject("123")
            .issuedAt(now)
            .expiresAt(now.plusSeconds(3600))
            .claim("email", "Ana@Gmail.com")
            .claim("email_verified", true)
            .claim("name", "Ana")
            .claim("picture", "http://img");
    customize.accept(claims);
    return new NimbusJwtEncoder(new ImmutableJWKSet<>(new JWKSet(jwk)))
        .encode(JwtEncoderParameters.from(JwsHeader.with(SignatureAlgorithm.RS256).keyId("k").build(), claims.build()))
        .getTokenValue();
  }

  private static String sign(Consumer<JwtClaimsSet.Builder> customize) {
    return sign(KEYS, customize);
  }

  private static GoogleAuth auth(String clientIds) {
    return new GoogleAuth(NimbusJwtDecoder.withPublicKey((RSAPublicKey) KEYS.getPublic()).build(), clientIds);
  }

  private static void assertStatus(Runnable call, HttpStatus status) {
    assertThatThrownBy(call::run)
        .isInstanceOfSatisfying(ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(status));
  }

  @Test
  void devolveAIdentidadeDeUmTokenValido() {
    var id = auth("web-client").verify(sign(c -> {}));

    assertThat(id.email()).isEqualTo("Ana@Gmail.com");
    assertThat(id.displayName()).isEqualTo("Ana");
    assertThat(id.avatarUrl()).isEqualTo("http://img");
  }

  @Test
  void aceitaQualquerUmDosClientIdsConfigurados() {
    // o app manda tokens com o client id do Android ou do iOS, conforme o aparelho
    var id = auth("web-client, android-client").verify(sign(c -> c.audience(java.util.List.of("android-client"))));

    assertThat(id.email()).isEqualTo("Ana@Gmail.com");
  }

  @Test
  void aceitaOIssuerSemHttps() {
    var id = auth("web-client").verify(sign(c -> c.issuer("accounts.google.com")));

    assertThat(id.email()).isEqualTo("Ana@Gmail.com");
  }

  @Test
  void tokenDeOutroAppVira401() {
    // um token do Google emitido para outro app não pode abrir conta aqui
    assertStatus(() -> auth("web-client").verify(sign(c -> c.audience(java.util.List.of("outro-app")))), HttpStatus.UNAUTHORIZED);
  }

  @Test
  void outroIssuerVira401() {
    assertStatus(() -> auth("web-client").verify(sign(c -> c.issuer("https://evil.example"))), HttpStatus.UNAUTHORIZED);
  }

  @Test
  void tokenExpiradoVira401() {
    Instant past = Instant.now().minusSeconds(7200);
    assertStatus(
        () -> auth("web-client").verify(sign(c -> c.issuedAt(past).expiresAt(past.plusSeconds(60)))), HttpStatus.UNAUTHORIZED);
  }

  @Test
  void assinaturaDeOutraChaveVira401() {
    assertStatus(() -> auth("web-client").verify(sign(OTHER_KEYS, c -> {})), HttpStatus.UNAUTHORIZED);
  }

  @Test
  void lixoVira401() {
    assertStatus(() -> auth("web-client").verify("nao-e-um-jwt"), HttpStatus.UNAUTHORIZED);
  }

  @Test
  void emailNaoVerificadoVira401() {
    // o login casa a conta pelo email: email sem verificação não prova nada
    assertStatus(() -> auth("web-client").verify(sign(c -> c.claim("email_verified", false))), HttpStatus.UNAUTHORIZED);
  }

  @Test
  void semEmailVira401() {
    assertStatus(
        () -> auth("web-client").verify(sign(c -> c.claims(m -> m.keySet().removeAll(java.util.Set.of("email", "email_verified"))))),
        HttpStatus.UNAUTHORIZED);
  }

  @Test
  void semNomeNemFotoDevolveNull() {
    var id = auth("web-client").verify(sign(c -> c.claims((Map<String, Object> m) -> m.keySet().removeAll(java.util.Set.of("name", "picture")))));

    assertThat(id.displayName()).isNull();
    assertThat(id.avatarUrl()).isNull();
  }

  @Test
  void semClientIdConfiguradoVira503() {
    assertStatus(() -> auth(" ").verify(sign(c -> {})), HttpStatus.SERVICE_UNAVAILABLE);
  }
}
