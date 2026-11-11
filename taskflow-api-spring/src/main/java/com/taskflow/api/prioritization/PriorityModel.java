package com.taskflow.api.prioritization;

import java.io.IOException;
import java.io.InputStream;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Classificador de prioridade (high/medium/low) pelo título da tarefa: TF-IDF de palavras e pares de palavras
 * seguido de regressão logística. Os pesos vêm de modelo-prioridade.json, gerado por taskflow-ml/treinar.py;
 * esta classe repete a conta do scikit-learn (o teste de paridade confere contra o Python).
 */
@Component
public class PriorityModel {

  private static final Pattern TOKEN = Pattern.compile("[\\p{L}\\p{N}_]{2,}");
  private static final Pattern MARKS = Pattern.compile("\\p{M}+");

  private final List<String> classes;
  private final Map<String, Integer> vocabulary;
  private final double[] idf;
  private final double[][] coef;
  private final double[] intercept;

  @Autowired
  PriorityModel(JsonMapper json) {
    this(load("/modelo-prioridade.json", json));
  }

  private PriorityModel(JsonNode root) {
    classes = new ArrayList<>();
    root.get("classes").forEach(c -> classes.add(c.asString()));
    vocabulary = new HashMap<>();
    root.get("vocabulario").properties().forEach(e -> vocabulary.put(e.getKey(), e.getValue().asInt()));
    idf = doubles(root.get("idf"));
    coef = new double[classes.size()][];
    for (int i = 0; i < coef.length; i++) coef[i] = doubles(root.get("coef").get(i));
    intercept = doubles(root.get("intercepto"));
  }

  static PriorityModel fromClasspath(String path, JsonMapper json) {
    return new PriorityModel(load(path, json));
  }

  private static JsonNode load(String path, JsonMapper json) {
    try (InputStream in = PriorityModel.class.getResourceAsStream(path)) {
      if (in == null) throw new IllegalStateException("Modelo não encontrado: " + path);
      return json.readTree(in);
    } catch (IOException e) {
      throw new IllegalStateException("Modelo ilegível: " + path);
    }
  }

  /** Probabilidade de cada classe; vazio se não há texto ou nenhum termo é conhecido (o modelo não tem o que dizer). */
  public Optional<Map<String, Double>> predict(String text) {
    if (text == null || text.isBlank()) return Optional.empty();

    Map<Integer, Integer> counts = new HashMap<>();
    List<String> tokens = tokens(text);
    for (int i = 0; i < tokens.size(); i++) {
      count(counts, tokens.get(i));
      if (i + 1 < tokens.size()) count(counts, tokens.get(i) + " " + tokens.get(i + 1));
    }
    if (counts.isEmpty()) return Optional.empty();

    Map<Integer, Double> x = new HashMap<>();
    double norm = 0;
    for (var e : counts.entrySet()) {
      double v = (1 + Math.log(e.getValue())) * idf[e.getKey()];
      x.put(e.getKey(), v);
      norm += v * v;
    }
    norm = Math.sqrt(norm);

    double[] logits = new double[classes.size()];
    double max = Double.NEGATIVE_INFINITY;
    for (int c = 0; c < logits.length; c++) {
      double z = intercept[c];
      for (var e : x.entrySet()) z += coef[c][e.getKey()] * e.getValue() / norm;
      logits[c] = z;
      max = Math.max(max, z);
    }
    double sum = 0;
    for (int c = 0; c < logits.length; c++) {
      logits[c] = Math.exp(logits[c] - max);
      sum += logits[c];
    }
    Map<String, Double> probabilities = new LinkedHashMap<>();
    for (int c = 0; c < logits.length; c++) probabilities.put(classes.get(c), logits[c] / sum);
    return Optional.of(probabilities);
  }

  private void count(Map<Integer, Integer> counts, String term) {
    Integer index = vocabulary.get(term);
    if (index != null) counts.merge(index, 1, Integer::sum);
  }

  // Mesmo pré-processamento do TfidfVectorizer(strip_accents="unicode", lowercase=True).
  private static List<String> tokens(String text) {
    String clean = MARKS.matcher(Normalizer.normalize(text, Normalizer.Form.NFKD)).replaceAll("").toLowerCase();
    List<String> tokens = new ArrayList<>();
    Matcher m = TOKEN.matcher(clean);
    while (m.find()) tokens.add(m.group());
    return tokens;
  }

  private static double[] doubles(JsonNode array) {
    double[] values = new double[array.size()];
    for (int i = 0; i < values.length; i++) values[i] = array.get(i).asDouble();
    return values;
  }
}
