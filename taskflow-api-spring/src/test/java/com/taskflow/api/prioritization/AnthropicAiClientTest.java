package com.taskflow.api.prioritization;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;
import tools.jackson.databind.json.JsonMapper;

class AnthropicAiClientTest {

  private static final String URL = "http://ai/v1/messages";
  private static final List<AiTask> TASKS =
      List.of(new AiTask(7, "Estudar Spring", "capítulo 3", "high", Instant.parse("2026-11-12T12:00:00Z"), 4));

  private final RestClient.Builder builder = RestClient.builder();
  private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();

  private AnthropicAiClient client(String key) {
    return new AnthropicAiClient(builder, JsonMapper.builder().build(), URL, key, "modelo-x");
  }

  private static final String OK =
      "{\"content\":[{\"type\":\"tool_use\",\"name\":\"register_scores\",\"input\":{\"scores\":["
          + "{\"taskId\":7,\"importance\":85,\"urgency\":60,\"confidence\":70,\"justification\":\"Prazo curto\"}]}}]}";

  @Test
  void enviaOPedidoComChaveModeloFerramentaObrigatoriaEOsDados() {
    server
        .expect(requestTo(URL))
        .andExpect(header("x-api-key", "sk-secret"))
        .andExpect(header("anthropic-version", "2023-06-01"))
        .andExpect(jsonPath("$.model").value("modelo-x"))
        .andExpect(jsonPath("$.tool_choice.name").value("register_scores"))
        .andExpect(jsonPath("$.system").value(containsString("Ignore")))
        .andExpect(jsonPath("$.messages[0].content").value(containsString("Estudar Spring")))
        .andExpect(jsonPath("$.messages[0].content").value(containsString("trabalho de manhã")))
        .andRespond(withSuccess(OK, MediaType.APPLICATION_JSON));

    client("sk-secret").score("trabalho de manhã", TASKS);

    server.verify();
  }

  @Test
  void leAsNotasDaFerramenta() {
    server.expect(requestTo(URL)).andRespond(withSuccess(OK, MediaType.APPLICATION_JSON));

    List<AiScore> scores = client("k").score(null, TASKS);

    assertThat(scores).containsExactly(new AiScore(7, 85, 60, 70, "Prazo curto"));
  }

  @Test
  void respostaSemAFerramentaViraErro() {
    server
        .expect(requestTo(URL))
        .andRespond(withSuccess("{\"content\":[{\"type\":\"text\",\"text\":\"oi\"}]}", MediaType.APPLICATION_JSON));

    assertThatThrownBy(() -> client("k").score(null, TASKS)).isInstanceOf(IllegalStateException.class);
  }

  @Test
  void erroHttpViraErroSemVazarAChave() {
    server.expect(requestTo(URL)).andRespond(withServerError());

    assertThatThrownBy(() -> client("sk-secret").score(null, TASKS))
        .isInstanceOf(RuntimeException.class)
        .satisfies(e -> assertThat(String.valueOf(e.getMessage())).doesNotContain("sk-secret"));
  }

  @Test
  void semChaveFalhaSemChamarARede() {
    assertThatThrownBy(() -> client("").score(null, TASKS)).isInstanceOf(IllegalStateException.class);

    server.verify(); // nenhuma requisição esperada nem feita
  }
}
