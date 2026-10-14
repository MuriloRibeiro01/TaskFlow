package com.taskflow.api.task;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Size;

/**
 * Campos ausentes (null) não são alterados. Sem userId, syncStatus, completedAt e datas: o servidor
 * controla esses campos, e o Jackson rejeita com 400 quem tentar enviá-los.
 */
public record UpdateTaskRequest(
    @Size(min = 1, max = 200) String title,
    @Size(max = 2000) String description,
    Priority priority,
    @Min(1) @Max(100) Integer estimatedPomodoros,
    TaskStatus status,
    @Min(0) @Max(1000) Integer completedPomodoros) {}
