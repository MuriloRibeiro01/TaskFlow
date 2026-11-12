package com.taskflow.api.auth;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class DevLoginStartupCheckTest {

  @ParameterizedTest
  @CsvSource({"true,prod", "true,'dev,prod'", "true,' prod '"})
  void naoSobeComDevLoginLigadoEmProducao(String flag, String profiles) {
    assertThatThrownBy(() -> new DevLoginStartupCheck(flag, profiles))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("ENABLE_DEV_LOGIN");
  }

  @ParameterizedTest
  @CsvSource({"true,", "true,dev", "false,prod", ",prod", "false,"})
  void sobeNosDemaisCasos(String flag, String profiles) {
    assertThatCode(() -> new DevLoginStartupCheck(flag, profiles)).doesNotThrowAnyException();
  }
}
