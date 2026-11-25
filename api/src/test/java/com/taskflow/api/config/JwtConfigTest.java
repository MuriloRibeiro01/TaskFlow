package com.taskflow.api.config;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class JwtConfigTest {

  @Test
  void falhaSemSegredo() {
    assertThatThrownBy(() -> JwtConfig.secretKey("")).hasMessageContaining("JWT_SECRET");
    assertThatThrownBy(() -> JwtConfig.secretKey(null)).hasMessageContaining("JWT_SECRET");
  }

  @Test
  void falhaComSegredoCurto() {
    assertThatThrownBy(() -> JwtConfig.secretKey("curta")).hasMessageContaining("JWT_SECRET");
  }

  @Test
  void aceitaSegredoCom32Caracteres() {
    assertThat(JwtConfig.secretKey("x".repeat(32)).getAlgorithm()).isEqualTo("HmacSHA256");
  }
}
