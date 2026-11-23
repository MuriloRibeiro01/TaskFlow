package com.taskflow.api.domain.task;

// Nomes iguais aos do enum do Postgres e do JSON do app (por isso minúsculos).
public enum SyncStatus {
  synced, pending, conflict
}
