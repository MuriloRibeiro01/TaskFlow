package com.taskflow.api.session;

final class SessionLimits {

  /** 24 horas: bem acima de qualquer foco real, só para barrar valor absurdo. */
  static final int MAX_DURATION_SECONDS = 86_400;

  private SessionLimits() {}
}
