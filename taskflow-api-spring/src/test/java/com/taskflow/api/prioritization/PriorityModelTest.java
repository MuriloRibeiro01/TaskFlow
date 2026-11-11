package com.taskflow.api.prioritization;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import java.io.InputStream;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

class PriorityModelTest {

  private final JsonMapper json = JsonMapper.builder().build();
  private final PriorityModel model = PriorityModel.fromClasspath("/modelo-prioridade.json", json);

  /** Contrato com o Python: mesmas frases, mesmas probabilidades (treinar.py gera o arquivo de referência). */
  @Test
  void reproduzAsProbabilidadesDoPython() throws Exception {
    try (InputStream in = getClass().getResourceAsStream("/modelo-paridade.json")) {
      JsonNode refs = json.readTree(in);
      int comparadas = 0;
      for (JsonNode ref : refs) {
        Optional<Map<String, Double>> p = model.predict(ref.get("texto").asString());
        if (p.isEmpty()) continue; // sem nenhum termo conhecido o modelo se abstém
        for (var e : ref.get("probabilidades").properties()) {
          assertThat(p.get().get(e.getKey())).as(ref.get("texto").asString() + " / " + e.getKey()).isCloseTo(e.getValue().asDouble(), within(1e-4));
        }
        comparadas++;
      }
      assertThat(comparadas).isGreaterThanOrEqualTo(5);
    }
  }

  @Test
  void probabilidadesSomamUm() {
    Map<String, Double> p = model.predict("Pagar boleto do plano de saúde").orElseThrow();
    assertThat(p.values().stream().mapToDouble(Double::doubleValue).sum()).isCloseTo(1.0, within(1e-9));
    assertThat(p).containsKeys("high", "medium", "low");
  }

  @Test
  void tarefaImportanteTemMaisChanceDeAltaQueTarefaFutil() {
    Map<String, Double> boleto = model.predict("Pagar boleto do plano de saúde").orElseThrow();
    Map<String, Double> vela = model.predict("Comprar vela aromática").orElseThrow();
    assertThat(boleto.get("high")).isGreaterThan(vela.get("high"));
    assertThat(vela.get("low")).isGreaterThan(boleto.get("low"));
  }

  @Test
  void ignoraAcentoECaixa() {
    assertThat(model.predict("PAGAR BOLETO DO PLANO DE SAUDE")).isEqualTo(model.predict("pagar boleto do plano de saúde"));
  }

  @Test
  void seAbstemSemTextoOuSemTermoConhecido() {
    assertThat(model.predict(null)).isEmpty();
    assertThat(model.predict("   ")).isEmpty();
    assertThat(model.predict("zzzqqq xxxkkk")).isEmpty();
  }

  @Test
  void arquivoInexistenteFalhaComMensagemClara() {
    assertThatThrownBy(() -> PriorityModel.fromClasspath("/nao-existe.json", json)).hasMessageContaining("nao-existe.json");
  }
}
