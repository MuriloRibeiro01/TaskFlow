package com.taskflow.api.task;

// Nomes iguais aos do enum do Postgres e do JSON do app (por isso minúsculos).
public enum SyncStatus {
  synced, pending, conflict
}
