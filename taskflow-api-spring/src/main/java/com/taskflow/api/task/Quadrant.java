package com.taskflow.api.task;

// Mesmos valores do app (em português) e do CHECK da coluna.
public enum Quadrant {
  fazer_agora, agendar, delegar, eliminar;

  private static final int CUT = 50;

  /** Importante e urgente = fazer agora; só importante = agendar; só urgente = delegar; nenhum = eliminar. */
  public static Quadrant of(int importance, int urgency) {
    if (importance >= CUT) return urgency >= CUT ? fazer_agora : agendar;
    return urgency >= CUT ? delegar : eliminar;
  }
}
