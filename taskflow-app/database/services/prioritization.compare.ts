import { PrioritizationDecision, Quadrant } from '@/types/prioritization.types';

export function quadrantFromAnswers(important: boolean, urgent: boolean): Quadrant {
  if (important) return urgent ? 'fazer_agora' : 'agendar';
  return urgent ? 'delegar' : 'eliminar';
}

export interface Divergence {
  taskId: number;
  userQuadrant: Quadrant;
  aiQuadrant: Quadrant;
  justification: string | null;
  confidence: number | null;
}

export function compareLists(decisions: PrioritizationDecision[]) {
  const agreements: PrioritizationDecision[] = [];
  const divergences: Divergence[] = [];

  for (const d of decisions) {
    if (!d.suggestedQuadrant || !d.userQuadrant) continue;
    if (d.userQuadrant === d.suggestedQuadrant) agreements.push(d);
    else {
      divergences.push({
        taskId: d.taskId,
        userQuadrant: d.userQuadrant,
        aiQuadrant: d.suggestedQuadrant,
        justification: d.aiJustification,
        confidence: d.confidence,
      });
    }
  }

  const total = agreements.length + divergences.length;
  return { agreements, divergences, agreementRate: total ? Math.round((agreements.length / total) * 100) : 0 };
}
