package com.taskflow.api;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.taskflow.api.task.Task;
import com.taskflow.api.task.TaskRepository;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

@IntegrationTest
class InfraIntegrationTest {

  @Autowired MockMvc mvc;
  @Autowired JdbcTemplate jdbc;
  @Autowired TaskRepository tasks;

  @Test
  void getRaizRespondeHelloWorldSemToken() throws Exception {
    mvc.perform(get("/")).andExpect(status().isOk()).andExpect(content().string("Hello World!"));
  }

  @Test
  void flywayAplicouAMigrationInicial() {
    Integer applied =
        jdbc.queryForObject(
            "select count(*) from flyway_schema_history where version = '1' and success",
            Integer.class);
    assertThat(applied).isEqualTo(1);
  }

  @Test
  void gravaDatasEmUtcEPreencheCreatedAtEUpdatedAt() {
    Task task = new Task();
    task.setTitle("Fuso horário");
    task.setCompletedAt(Instant.parse("2026-10-01T10:00:00Z"));
    Task saved = tasks.saveAndFlush(task);

    // TIMESTAMP sem fuso: o texto gravado tem que ser a hora UTC, não a de São Paulo.
    String raw =
        jdbc.queryForObject(
            "select completed_at::text from tasks where id = ?", String.class, saved.getId());
    assertThat(raw).isEqualTo("2026-10-01 10:00:00");
    assertThat(saved.getCreatedAt()).isNotNull();
    assertThat(saved.getUpdatedAt()).isNotNull();
    assertThat(saved.getPriority().name()).isEqualTo("medium");
    assertThat(saved.getStatus().name()).isEqualTo("pending");

    tasks.delete(saved);
  }

  @Test
  void respondePreflightDeCors() throws Exception {
    mvc.perform(
            options("/tasks")
                .header("Origin", "http://localhost:8081")
                .header("Access-Control-Request-Method", "POST"))
        .andExpect(status().isOk())
        .andExpect(header().string("Access-Control-Allow-Origin", "*"));
  }
}
