package com.taskflow.api.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import org.springframework.web.server.ResponseStatusException;

class SupabaseAuthTest {

  private final RestClient.Builder builder = RestClient.builder();
  private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();

  @Test
  void devolveAIdentidadeQuandoOSupabaseAceitaOToken() {
    server
        .expect(requestTo("http://sb/auth/v1/user"))
        .andExpect(header("Authorization", "Bearer tok"))
        .andExpect(header("apikey", "anon"))
        .andRespond(
            withSuccess(
                "{\"email\":\"A@x.com\",\"email_confirmed_at\":\"2026-10-01T10:00:00Z\",\"user_metadata\":{\"full_name\":\"Ana\",\"avatar_url\":\"http://img\"}}",
                MediaType.APPLICATION_JSON));

    var id = new SupabaseAuth(builder, "http://sb", "anon").verify("tok");

    assertThat(id.email()).isEqualTo("A@x.com");
    assertThat(id.displayName()).isEqualTo("Ana");
    assertThat(id.avatarUrl()).isEqualTo("http://img");
  }

  @Test
  void tokenRecusadoVira401() {
    server.expect(requestTo("http://sb/auth/v1/user")).andRespond(withStatus(HttpStatus.UNAUTHORIZED));

    assertThatThrownBy(() -> new SupabaseAuth(builder, "http://sb", "anon").verify("ruim"))
        .isInstanceOfSatisfying(
            ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED));
  }

  @Test
  void semEmailVira401() {
    server.expect(requestTo("http://sb/auth/v1/user")).andRespond(withSuccess("{}", MediaType.APPLICATION_JSON));

    assertThatThrownBy(() -> new SupabaseAuth(builder, "http://sb", "anon").verify("tok"))
        .isInstanceOfSatisfying(
            ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED));
  }

  @Test
  void emailNaoConfirmadoVira401() {
    // sem isso, quem se cadastra no Supabase com o email de outra pessoa entraria na conta dela
    server
        .expect(requestTo("http://sb/auth/v1/user"))
        .andRespond(withSuccess("{\"email\":\"a@x.com\"}", MediaType.APPLICATION_JSON));

    assertThatThrownBy(() -> new SupabaseAuth(builder, "http://sb", "anon").verify("tok"))
        .isInstanceOfSatisfying(
            ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED));
  }

  @Test
  void semConfiguracaoVira503() {
    assertThatThrownBy(() -> new SupabaseAuth(builder, "", "").verify("tok"))
        .isInstanceOfSatisfying(
            ResponseStatusException.class, e -> assertThat(e.getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
  }
}
