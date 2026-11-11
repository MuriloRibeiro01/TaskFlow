package com.taskflow.api.prioritization;

import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;

/** Sem taskIds, vale para as tarefas não concluídas do usuário. */
public record SuggestionsRequest(@Size(max = PrioritizationService.MAX_TASKS) List<@NotNull @Min(1) Integer> taskIds) {}
