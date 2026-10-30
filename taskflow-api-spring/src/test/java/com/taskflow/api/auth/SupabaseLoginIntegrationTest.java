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
class SupabaseLoginIntegrationTest {

  @Autowired MockMvc mvc;
  @MockitoBean SupabaseAuth supabase;

  private String login(String body) throws Exception {
    return mvc.perform(post("/auth/supabase-login").contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isOk())
        .andReturn().getResponse().getContentAsString();
  }

  @Test
  void trocaOTokenDoSupabasePeloDoSpringSemDuplicarOUsuario() throws Exception {
    String email = "Sb-" + UUID.randomUUID() + "@Taskflow.test";
    when(supabase.verify("sb-token")).thenReturn(new SupabaseAuth.Identity(email, "Ana", "http://img"));

    String first = login("{\"accessToken\":\"sb-token\"}");
    String second = login("{\"accessToken\":\"sb-token\"}");

    // mesmo usuário nas duas vezes, email em minúsculas, perfil do Supabase gravado
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
    when(supabase.verify(any())).thenThrow(new ResponseStatusException(HttpStatus.UNAUTHORIZED));

    mvc.perform(post("/auth/supabase-login").contentType(MediaType.APPLICATION_JSON).content("{\"accessToken\":\"x\"}"))
        .andExpect(status().isUnauthorized());
  }

  @Test
  void corpoInvalidoDa400() throws Exception {
    mvc.perform(post("/auth/supabase-login").contentType(MediaType.APPLICATION_JSON).content("{}"))
        .andExpect(status().isBadRequest());
  }
}
