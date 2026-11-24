package com.taskflow.api.config;

import org.springframework.boot.jackson.autoconfigure.JsonMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.MapperFeature;

@Configuration
class JacksonConfig {

  /** Equivalente ao whitelist/forbidNonWhitelisted do Nest: campo desconhecido ou tipo errado é 400. */
  @Bean
  JsonMapperBuilderCustomizer strictJson() {
    return builder ->
        builder
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .disable(DeserializationFeature.ACCEPT_FLOAT_AS_INT)
            .disable(MapperFeature.ALLOW_COERCION_OF_SCALARS);
  }
}
