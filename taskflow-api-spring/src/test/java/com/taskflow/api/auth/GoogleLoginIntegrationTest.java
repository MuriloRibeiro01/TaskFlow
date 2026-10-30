package com.taskflow.api.auth;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.taskflow.api.IntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.server.ResponseStatusException;

@IntegrationTest
class GoogleLoginIntegrationTest {

  @Autowired MockMvc mvc;
  @MockitoBean GoogleAuth google;

  private String login(String body) throws Exception {
    return mvc.perform(post("/auth/google").contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString();
  }

  @Test
  void trocaOIdTokenDoGooglePeloJwtDaApiSemDuplicarOUsuario() throws Exception {
    String email = "Gg-" + UUID.randomUUID() + "@Taskflow.test";
    when(google.verify("g-token")).thenReturn(new GoogleAuth.Identity(email, "Ana", "http://img"));

    String first = login("{\"idToken\":\"g-token\"}");
    String second = login("{\"idToken\":\"g-token\"}");

    // mesmo usuário nas duas vezes, email em minúsculas, perfil do Google gravado
    org.assertj.core.api.Assertions.assertThat((Integer) JsonPath.read(second, "$.user.id"))
        .isEqualTo(JsonPath.<Integer>read(first, "$.user.id"));
    org.assertj.core.api.Assertions.assertThat((String) JsonPath.read(first, "$.user.email")).isEqualTo(email.toLowerCase());

    mvc.perform(get("/users/me").header("Authorization", "Bearer " + JsonPath.read(first, "$.accessToken")))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.displayName").value("Ana"))
        .andExpect(jsonPath("$.avatarUrl").value("http://img"));
  }

  @Test
  void tokenRecusadoDa401() throws Exception {
    when(google.verify(any())).thenThrow(new ResponseStatusException(HttpStatus.UNAUTHORIZED));

    mvc.perform(post("/auth/google").contentType(MediaType.APPLICATION_JSON).content("{\"idToken\":\"x\"}"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void corpoInvalidoDa400() throws Exception {
    mvc.perform(post("/auth/google").contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void supabaseLoginNaoExisteMais() throws Exception {
    mvc.perform(post("/auth/supabase-login").contentType(MediaType.APPLICATION_JSON).content("{\"accessToken\":\"x\"}"))
        .andExpect(status().is4xxClientError());
  }
}
