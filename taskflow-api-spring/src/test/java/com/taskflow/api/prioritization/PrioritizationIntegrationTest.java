package com.taskflow.api.prioritization;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

@IntegrationTest
class PrioritizationIntegrationTest {

  @Autowired MockMvc mvc;
  @MockitoBean AiClient ai;

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

  private int createTask(String token, String body) throws Exception {
    String json = call(post("/tasks"), token, body).andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
    return JsonPath.read(json, "$.id");
  }

  private ResultActions suggest(String token, String body) throws Exception {
    return call(post("/prioritization/suggestions"), token, body);
  }

  @Test
  void exigeToken() throws Exception {
    suggest(null, "{}").andExpect(status().isUnauthorized());
  }

  @Test
  void devolveAsNotasDaIaComOQuadranteCalculado() throws Exception {
    int id = createTask(tokenA, "{\"title\":\"Estudar\"}");
    when(ai.score(any(), any())).thenReturn(List.of(new AiScore(id, 90, 20, 75, "Importante, sem pressa")));

    suggest(tokenA, "{}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.source").value("ai"))
        .andExpect(jsonPath("$.suggestions[0].taskId").value(id))
        .andExpect(jsonPath("$.suggestions[0].quadrant").value("agendar"))
        .andExpect(jsonPath("$.suggestions[0].justification").value("Importante, sem pressa"));
  }

  @Test
  void quandoAIaFalhaUsaARegraEResponde200() throws Exception {
    int id = createTask(tokenA, "{\"title\":\"Estudar\",\"priority\":\"high\"}");
    when(ai.score(any(), any())).thenThrow(new IllegalStateException("fora do ar"));

    suggest(tokenA, "{}")
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.source").value("model")) // "Estudar" é termo conhecido do modelo treinado
        .andExpect(jsonPath("$.suggestions[0].taskId").value(id));
  }

  @Test
  void naoIncluiConcluidasNemTarefasDeOutroUsuario() throws Exception {
    int done = createTask(tokenA, "{\"title\":\"Feita\"}");
    call(patch("/tasks/" + done), tokenA, "{\"status\":\"done\"}").andExpect(status().isOk());
    int open = createTask(tokenA, "{\"title\":\"Aberta\"}");
    createTask(tokenB, "{\"title\":\"De outro\"}");
    when(ai.score(any(), any())).thenThrow(new IllegalStateException());

    suggest(tokenA, "{}")
        .andExpect(jsonPath("$.suggestions.length()").value(1))
        .andExpect(jsonPath("$.suggestions[0].taskId").value(open));
  }

  @Test
  void tarefaDeOutroUsuarioNoPedidoDa404() throws Exception {
    int others = createTask(tokenB, "{\"title\":\"De outro\"}");

    suggest(tokenA, "{\"taskIds\":[" + others + "]}").andExpect(status().isNotFound());
  }

  @Test
  void validaOCorpo() throws Exception {
    String ids = java.util.stream.IntStream.rangeClosed(1, 31).boxed().map(String::valueOf).collect(java.util.stream.Collectors.joining(","));

    suggest(tokenA, "{\"taskIds\":[" + ids + "]}").andExpect(status().isBadRequest());
    suggest(tokenA, "{\"taskIds\":[0]}").andExpect(status().isBadRequest());
    suggest(tokenA, "{\"outro\":1}").andExpect(status().isBadRequest());
  }

  @Test
  void passaDoLimiteDiarioDa429() throws Exception {
    when(ai.score(any(), any())).thenReturn(List.of());

    for (int i = 0; i < 5; i++) suggest(tokenA, "{}").andExpect(status().isOk());
    suggest(tokenA, "{}").andExpect(status().isTooManyRequests());
    suggest(tokenB, "{}").andExpect(status().isOk()); // o limite é por usuário
  }
}
