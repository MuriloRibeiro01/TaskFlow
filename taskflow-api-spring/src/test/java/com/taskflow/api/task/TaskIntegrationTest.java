package com.taskflow.api.task;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import com.taskflow.api.IntegrationTest;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@IntegrationTest
class TaskIntegrationTest {

  @Autowired MockMvc mvc;
  @Autowired TaskRepository tasks;

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
            .andExpect(status().isOk())
            .andReturn().getResponse().getContentAsString();
    return JsonPath.read(json, "$.accessToken");
  }

  private ResultActions call(MockHttpServletRequestBuilder req, String token, String body) throws Exception {
    if (token != null) req.header("Authorization", "Bearer " + token);
    if (body != null) req.contentType(MediaType.APPLICATION_JSON).content(body);
    return mvc.perform(req);
  }

  private int create(String token, String body) throws Exception {
    String json = call(post("/tasks"), token, body).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
    return JsonPath.read(json, "$.id");
  }

  @Test
  void exigeTokenEmTodasAsRotas() throws Exception {
    call(get("/tasks"), null, null).andExpect(status().isUnauthorized());
    call(post("/tasks"), null, "{\"title\":\"x\"}").andExpect(status().isUnauthorized());
    call(get("/tasks/1"), null, null).andExpect(status().isUnauthorized());
    call(patch("/tasks/1"), null, "{}").andExpect(status().isUnauthorized());
    call(delete("/tasks/1"), null, null).andExpect(status().isUnauthorized());
  }

  @Test
  void crudCompletoDoProprioUsuario() throws Exception {
    String json =
        call(post("/tasks"), tokenA, "{\"title\":\"Estudar Spring\",\"priority\":\"high\",\"estimatedPomodoros\":4}")
            .andExpect(status().isCreated())
            .andExpect(jsonPath("$.title").value("Estudar Spring"))
            .andExpect(jsonPath("$.priority").value("high"))
            .andExpect(jsonPath("$.status").value("pending"))
            .andExpect(jsonPath("$.completedPomodoros").value(0))
            .andExpect(jsonPath("$.syncStatus").value("pending"))
            .andExpect(jsonPath("$.completedAt").isEmpty())
            .andExpect(jsonPath("$.createdAt").isString())
            .andReturn().getResponse().getContentAsString();
    int id = JsonPath.read(json, "$.id");
    // Mesmo formato de data do Nest: ISO 8601 em UTC com milissegundos.
    assertThat((String) JsonPath.read(json, "$.createdAt")).matches("\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}(\\.\\d{1,3})?Z");

    String list = call(get("/tasks"), tokenA, null).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    assertThat(JsonPath.<List<Integer>>read(list, "$[*].id")).contains(id);

    call(get("/tasks/" + id), tokenA, null).andExpect(status().isOk());

    call(patch("/tasks/" + id), tokenA, "{\"status\":\"done\"}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.completedAt").isString());

    String done = call(get("/tasks?status=done"), tokenA, null).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    assertThat(JsonPath.<List<String>>read(done, "$[*].status")).isNotEmpty().allMatch("done"::equals);

    call(delete("/tasks/" + id), tokenA, null).andExpect(status().isNoContent());
    call(get("/tasks/" + id), tokenA, null).andExpect(status().isNotFound());
  }

  @Test
  void umUsuarioNaoVeNaoEditaENaoApagaTarefaDeOutro() throws Exception {
    int id = create(tokenA, "{\"title\":\"Privada\"}");

    call(get("/tasks/" + id), tokenB, null).andExpect(status().isNotFound());
    call(patch("/tasks/" + id), tokenB, "{\"title\":\"invadida\"}").andExpect(status().isNotFound());
    call(delete("/tasks/" + id), tokenB, null).andExpect(status().isNotFound());
    call(get("/tasks"), tokenB, null).andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());

    assertThat(tasks.findById(id)).get().extracting(Task::getTitle).isEqualTo("Privada");
  }

  @Test
  void validaCorpoQueryEId() throws Exception {
    call(post("/tasks"), tokenA, "{}").andExpect(status().isBadRequest());
    call(post("/tasks"), tokenA, "{\"title\":\"\"}").andExpect(status().isBadRequest());
    call(post("/tasks"), tokenA, "{\"title\":\"x\",\"priority\":\"urgente\"}").andExpect(status().isBadRequest());
    call(post("/tasks"), tokenA, "{\"title\":\"x\",\"estimatedPomodoros\":5000}").andExpect(status().isBadRequest());
    call(post("/tasks"), tokenA, "{\"title\":\"x\",\"estimatedPomodoros\":\"4\"}").andExpect(status().isBadRequest());
    // userId no corpo seria a forma de criar tarefa em nome de outra pessoa
    call(post("/tasks"), tokenA, "{\"title\":\"x\",\"userId\":999}")
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.message[0]").value("property userId should not exist"));
    call(patch("/tasks/1"), tokenA, "{\"completedAt\":\"2026-01-01T00:00:00Z\"}").andExpect(status().isBadRequest());
    call(get("/tasks?status=feito"), tokenA, null).andExpect(status().isBadRequest()).andExpect(jsonPath("$.statusCode").value(400));
    call(get("/tasks/abc"), tokenA, null).andExpect(status().isBadRequest());
    call(get("/tasks/0"), tokenA, null).andExpect(status().isBadRequest());
    call(get("/tasks/99999999999"), tokenA, null).andExpect(status().isBadRequest());
  }
}
