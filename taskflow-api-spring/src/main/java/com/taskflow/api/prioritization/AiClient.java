package com.taskflow.api.prioritization;

import java.util.List;

public interface AiClient {

  /** Lança qualquer RuntimeException se a IA não puder responder; o serviço cai na regra de reserva. */
  List<AiScore> score(String routine, List<AiTask> tasks);
}
