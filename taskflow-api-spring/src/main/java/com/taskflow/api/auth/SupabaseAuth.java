package com.taskflow.api.auth;

import java.util.Map;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.server.ResponseStatusException;

/**
 * O Supabase só autentica (login com Google). Em vez de validar a assinatura do token aqui (que
 * depende do tipo de chave do projeto), pergunta ao próprio Supabase quem é o dono do token.
 */
@Component
public class SupabaseAuth {

  public record Identity(String email, String displayName, String avatarUrl) {}

  private final RestClient http;
  private final String url;
  private final String anonKey;

  @Autowired
  SupabaseAuth(
      @Value("${taskflow.supabase.url:}") String url, @Value("${taskflow.supabase.anon-key:}") String anonKey) {
    this(RestClient.builder(), url, anonKey);
  }

  // O teste injeta um builder ligado ao servidor falso.
  SupabaseAuth(RestClient.Builder http, String url, String anonKey) {
    this.http = http.build();
    this.url = url;
    this.anonKey = anonKey;
  }

  public Identity verify(String accessToken) {
    if (url.isBlank() || anonKey.isBlank()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE);
    Map<?, ?> user;
    try {
      user =
          http.get()
              .uri(url + "/auth/v1/user")
              .header("Authorization", "Bearer " + accessToken)
              .header("apikey", anonKey)
              .retrieve()
              .body(Map.class);
    } catch (RestClientException e) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }
    // Email não confirmado não prova nada: o login casa a conta pelo email.
    if (user == null
        || !(user.get("email") instanceof String email)
        || email.isBlank()
        || !(user.get("email_confirmed_at") instanceof String confirmed)
        || confirmed.isBlank()) {
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED);
    }
    Map<?, ?> meta = user.get("user_metadata") instanceof Map<?, ?> m ? m : Map.of();
    return new Identity(email, meta.get("full_name") instanceof String n ? n : null, meta.get("avatar_url") instanceof String a ? a : null);
  }
}
