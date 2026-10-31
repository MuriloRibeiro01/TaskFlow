package com.taskflow.api.config;

import com.taskflow.api.common.ApiErrorHandler;
import java.util.List;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import tools.jackson.databind.json.JsonMapper;

@Configuration
class SecurityConfig {

  @Bean
  SecurityFilterChain securityFilterChain(HttpSecurity http, AuthenticationEntryPoint unauthorized)
      throws Exception {
    return http
        // API sem sessão nem cookies (token no header), então CSRF não se aplica.
        .csrf(csrf -> csrf.disable())
        .cors(Customizer.withDefaults())
        .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .authorizeHttpRequests(
            auth ->
                auth.requestMatchers(HttpMethod.GET, "/").permitAll()
                    .requestMatchers(HttpMethod.POST, "/auth/dev-login", "/auth/google").permitAll()
                    .requestMatchers("/error").permitAll()
                    .anyRequest().authenticated())
        .oauth2ResourceServer(
            oauth -> oauth.jwt(Customizer.withDefaults()).authenticationEntryPoint(unauthorized))
        .exceptionHandling(e -> e.authenticationEntryPoint(unauthorized))
        .build();
  }

  /** 401 no mesmo formato JSON dos outros erros, sem detalhar o motivo (token ausente, forjado ou expirado). */
  @Bean
  AuthenticationEntryPoint unauthorized(JsonMapper json) {
    return (request, response, ex) -> {
      response.setStatus(HttpStatus.UNAUTHORIZED.value());
      response.setContentType(MediaType.APPLICATION_JSON_VALUE);
      json.writeValue(
          response.getOutputStream(), ApiErrorHandler.of(HttpStatus.UNAUTHORIZED, "Unauthorized"));
    };
  }

  /** Qualquer origem: a auth é por header Authorization, que o navegador não envia sozinho como cookie. */
  @Bean
  CorsConfigurationSource corsConfigurationSource() {
    CorsConfiguration cors = new CorsConfiguration();
    cors.setAllowedOrigins(List.of("*"));
    cors.setAllowedMethods(List.of("GET", "POST", "PATCH", "DELETE", "OPTIONS"));
    cors.setAllowedHeaders(List.of("Authorization", "Content-Type"));
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/**", cors);
    return source;
  }
}
