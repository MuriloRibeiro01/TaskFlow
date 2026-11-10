package com.taskflow.api.session;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.taskflow.api.IntegrationTest;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@IntegrationTest
class SessionIntegrationTest {

  static final String BODY =
      "{\"taskId\":%s,\"startedAt\":\"2026-10-01T10:00:00.000Z\",\"endedAt\":\"2026-10-01T10:25:00.000Z\","
          + "\"durationSeconds\":1500,\"type\":\"focus\",\"status\":\"completed\"}";

  @Autowired MockMvc mvc;

  private String tokenA;
  private String tokenB;

  @BeforeEach
  void login() throws Exception {
    tokenA = token("it-" + UUID.randomUUID() + "-a@taskflow.test");
    tokenB = token("it-" + UUID.randomUUID() + "-b@taskflow.test");
  }

  private String token(String email) throws Exception {
    String json =
        mvc.perform(post("/auth/dev-login").contentType(MediaType.APPLICATION_JSON).content("{\"email\":\"" + email + "\"}"))
            .andReturn().getResponse().getContentAsString();
    return JsonPath.read(json, "$.accessToken");
  }

  private ResultActions call(MockHttpServletRequestBuilder req, String token, String body) throws Exception {
    if (token != null) req.header("Authorization", "Bearer " + token);
    if (body != null) req.contentType(MediaType.APPLICATION_JSON).content(body);
    return mvc.perform(req);
  }

  private int id(ResultActions r) throws Exception {
    return JsonPath.read(r.andReturn().getResponse().getContentAsString(), "$.id");
  }

  @Test
  void exigeToken() throws Exception {
    call(get("/sessions"), null, null).andExpect(status().isUnauthorized());
    call(post("/sessions"), null, BODY.formatted("null")).andExpect(status().isUnauthorized());
    call(patch("/sessions/1"), null, "{}").andExpect(status().isUnauthorized());
    call(delete("/sessions/1"), null, null).andExpect(status().isUnauthorized());
  }

  @Test
  void crudComVinculoComATarefa() throws Exception {
    int taskId = id(call(post("/tasks"), tokenA, "{\"title\":\"t\"}").andExpect(status().isCreated()));

    int id =
        id(call(post("/sessions"), tokenA, BODY.formatted(taskId))
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.taskId").value(taskId))
            .andExpect(jsonPath("$.durationSeconds").value(1500))
            .andExpect(jsonPath("$.type").value("focus"))
            .andExpect(jsonPath("$.startedAt").value("2026-10-01T10:00:00Z")));

    call(get("/sessions"), tokenA, null).andExpect(status().isOk()).andExpect(jsonPath("$[?(@.id==" + id + ")]").exists());

    call(patch("/sessions/" + id), tokenA, "{\"status\":\"interrupted\",\"durationSeconds\":600}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.status").value("interrupted"))
        .andExpect(jsonPath("$.durationSeconds").value(600));

    call(delete("/sessions/" + id), tokenA, null).andExpect(status().isNoContent());
    call(delete("/sessions/" + id), tokenA, null).andExpect(status().isNotFound());
  }

  @Test
  void sessaoSemTarefaEPermitida() throws Exception {
    call(post("/sessions"), tokenA, BODY.formatted("null")).andExpect(status().isCreated());
  }

  @Test
  void isolaUsuarios() throws Exception {
    int taskA = id(call(post("/tasks"), tokenA, "{\"title\":\"t\"}"));
    int sessionA = id(call(post("/sessions"), tokenA, BODY.formatted(taskA)));

    // B não vê, não edita, não apaga e não pode ligar sessão à tarefa de A.
    call(get("/sessions"), tokenB, null).andExpect(jsonPath("$[?(@.id==" + sessionA + ")]").doesNotExist());
    call(patch("/sessions/" + sessionA), tokenB, "{\"status\":\"cancelled\"}").andExpect(status().isNotFound());
    call(delete("/sessions/" + sessionA), tokenB, null).andExpect(status().isNotFound());
    call(post("/sessions"), tokenB, BODY.formatted(taskA)).andExpect(status().isNotFound());
    call(get("/sessions"), tokenA, null).andExpect(jsonPath("$[?(@.id==" + sessionA + ")].status").value("completed"));
  }

  @Test
  void valida() throws Exception {
    call(post("/sessions"), tokenA, "{}").andExpect(status().isBadRequest());
    call(post("/sessions"), tokenA, BODY.formatted("null").replace("focus", "nap")).andExpect(status().isBadRequest());
    call(post("/sessions"), tokenA, BODY.formatted("null").replace("1500", "-1")).andExpect(status().isBadRequest());
    call(post("/sessions"), tokenA, BODY.formatted("null").replace("}", ",\"userId\":1}")).andExpect(status().isBadRequest());
    call(patch("/sessions/abc"), tokenA, "{}").andExpect(status().isBadRequest());
  }
}
