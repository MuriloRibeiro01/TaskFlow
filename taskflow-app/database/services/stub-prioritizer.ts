import { Task } from '@/types/task.types';
import { Quadrant, SuggestionResult } from '@/types/prioritization.types';

const JUSTIFICATIONS: Record<Quadrant, string> = {
  fazer_agora: 'Esta tarefa tem alta relevância e urgência imediata para as suas metas.',
  agendar: 'Tarefa estratégica de alto impacto que deve ser planejada no calendário.',
  delegar: 'Demanda urgente que pode ser distribuída ou simplificada por ter menor impacto direto.',
  eliminar: 'Atividade com baixo valor percebido e baixa urgência que pode ser descartada.',
};

function getRandomQuadrant(): Quadrant {
  const rand = Math.random();
  if (rand < 0.4) {
    return 'fazer_agora';
  }
  if (rand < 0.7) {
    return 'agendar';
  }
  if (rand < 0.9) {
    return 'delegar';
  }
  return 'eliminar';
}

function getRandomConfidence(): number {
  return Math.floor(Math.random() * (95 - 60 + 1)) + 60;
}

export async function suggestPrioritization(tasks: Task[]): Promise<SuggestionResult[]> {
  await new Promise((resolve) => setTimeout(resolve, 900));

  return tasks.map((task) => {
    const suggestedQuadrant = getRandomQuadrant();
    const confidence = getRandomConfidence();
    const justification = JUSTIFICATIONS[suggestedQuadrant];

    return {
      taskId: task.id,
      suggestedQuadrant,
      confidence,
      justification,
    };
  });
}
