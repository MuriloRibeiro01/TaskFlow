package com.taskflow.api.config;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import com.taskflow.api.user.UserRepository;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.function.Predicate;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtClaimValidator;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;

@Configuration
public class JwtConfig {

  public static final String ISSUER = "taskflow-api";
  public static final String AUDIENCE = "taskflow-app";
  private static final int MIN_SECRET_LENGTH = 32;

  @Bean
  SecretKey jwtSecretKey(@Value("${taskflow.jwt-secret:}") String secret) {
    return secretKey(secret);
  }

  @Bean
  JwtEncoder jwtEncoder(SecretKey key) {
    return new NimbusJwtEncoder(new ImmutableSecret<>(key));
  }

  @Bean
  JwtDecoder jwtDecoder(SecretKey key, UserRepository users) {
    NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(key).macAlgorithm(MacAlgorithm.HS256).build();
    decoder.setJwtValidator(validator(users::existsById));
    return decoder;
  }

  /** Além de assinatura e validade: emissor e destinatário desta API, e o dono do token ainda precisa existir (1 consulta por chave primária). */
  static OAuth2TokenValidator<Jwt> validator(Predicate<Integer> userExists) {
    OAuth2TokenValidator<Jwt> owner =
        jwt -> {
          try {
            if (userExists.test(Integer.parseInt(jwt.getSubject()))) return OAuth2TokenValidatorResult.success();
          } catch (NumberFormatException e) {
            // cai na falha abaixo
          }
          return OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token"));
        };
    return new DelegatingOAuth2TokenValidator<>(
        JwtValidators.createDefaultWithIssuer(ISSUER),
        new JwtClaimValidator<List<String>>("aud", aud -> aud != null && aud.contains(AUDIENCE)),
        owner);
  }

  /** Roda na inicialização: a API não sobe sem segredo, em vez de assinar tokens fracos. */
  static SecretKey secretKey(String secret) {
    if (secret == null || secret.length() < MIN_SECRET_LENGTH) {
      throw new IllegalStateException(
          "JWT_SECRET ausente ou com menos de " + MIN_SECRET_LENGTH + " caracteres");
    }
    return new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256");
  }
}
