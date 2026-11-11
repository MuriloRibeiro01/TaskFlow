package com.taskflow.api.prioritization;

import java.time.Instant;

/** O que a IA recebe de cada tarefa: só o necessário para julgar, sem dono nem datas internas. */
public record AiTask(
    Integer id, String title, String description, String priority, Instant dueDate, Integer estimatedPomodoros) {}
