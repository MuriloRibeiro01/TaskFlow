package com.taskflow.api.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
class OpenApiConfig {

  @Bean
  OpenAPI openAPI() {
    return new OpenAPI()
        .info(new Info().title("TaskFlow API").version("1.0").description("Spring Boot · JWT auth"))
        .addSecurityItem(new SecurityRequirement().addList("bearer"))
        .components(new Components().addSecuritySchemes("bearer",
            new SecurityScheme()
                .type(SecurityScheme.Type.HTTP)
                .scheme("bearer")
                .bearerFormat("JWT")));
  }
}
