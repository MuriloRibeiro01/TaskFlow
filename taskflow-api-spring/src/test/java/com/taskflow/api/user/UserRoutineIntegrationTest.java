package com.taskflow.api.user;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.taskflow.api.IntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@IntegrationTest
class UserRoutineIntegrationTest {

  @Autowired MockMvc mvc;

  private String token() throws Exception {
    String json =
        mvc.perform(
                post("/auth/dev-login")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("{\"email\":\"it-" + UUID.randomUUID() + "@taskflow.test\"}"))
            .andReturn().getResponse().getContentAsString();
    return JsonPath.read(json, "$.accessToken");
  }

  private ResultActions patchMe(String token, String body) throws Exception {
    var req = patch("/users/me").contentType(MediaType.APPLICATION_JSON).content(body);
    if (token != null) req.header("Authorization", "Bearer " + token);
    return mvc.perform(req);
  }

  private ResultActions getMe(String token) throws Exception {
    return mvc.perform(get("/users/me").header("Authorization", "Bearer " + token));
  }

  @Test
  void exigeToken() throws Exception {
    patchMe(null, "{\"routineText\":\"x\"}").andExpect(status().isUnauthorized());
  }

  @Test
  void gravaELeARotina() throws Exception {
    String token = token();

    getMe(token).andExpect(jsonPath("$.routineText").isEmpty());
    patchMe(token, "{\"routineText\":\"Aulas de manhã, trabalho à tarde.\"}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.routineText").value("Aulas de manhã, trabalho à tarde."));
    getMe(token).andExpect(jsonPath("$.routineText").value("Aulas de manhã, trabalho à tarde."));
  }

  @Test
  void textoVazioApagaARotina() throws Exception {
    String token = token();
    patchMe(token, "{\"routineText\":\"algo\"}").andExpect(status().isOk());

    patchMe(token, "{\"routineText\":\"  \"}").andExpect(status().isOk()).andExpect(jsonPath("$.routineText").isEmpty());
  }

  @Test
  void cadaUsuarioTemASua() throws Exception {
    String a = token();
    String b = token();
    patchMe(a, "{\"routineText\":\"só do A\"}").andExpect(status().isOk());

    getMe(b).andExpect(jsonPath("$.routineText").isEmpty());
  }

  @Test
  void valida() throws Exception {
    String token = token();

    patchMe(token, "{\"routineText\":\"" + "x".repeat(2001) + "\"}").andExpect(status().isBadRequest());
    patchMe(token, "{\"email\":\"outro@x.com\"}").andExpect(status().isBadRequest()); // só a rotina é editável
  }
}
