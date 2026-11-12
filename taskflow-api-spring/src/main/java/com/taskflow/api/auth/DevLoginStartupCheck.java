package com.taskflow.api.auth;

import java.util.Arrays;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/** O dev-login aceita qualquer e-mail sem prova: com o perfil "prod" ativo a API se recusa a subir com ele ligado. */
@Component
class DevLoginStartupCheck {

  private static final Logger log = LoggerFactory.getLogger(DevLoginStartupCheck.class);

  DevLoginStartupCheck(
      @Value("${taskflow.dev-login-enabled:false}") String flag,
      @Value("${spring.profiles.active:}") String profiles) {
    if (!"true".equals(flag)) return;
    if (profiles == null) profiles = "";
    if (Arrays.stream(profiles.split(",")).anyMatch(p -> p.trim().equals("prod"))) {
      throw new IllegalStateException("ENABLE_DEV_LOGIN=true não é permitido com o perfil prod");
    }
    log.warn("ENABLE_DEV_LOGIN=true: qualquer e-mail entra sem prova de identidade. Só para demo local.");
  }
}
