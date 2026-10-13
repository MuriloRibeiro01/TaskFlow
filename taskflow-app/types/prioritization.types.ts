export type Quadrant = 'fazer_agora' | 'agendar' | 'delegar' | 'eliminar';

export interface QuadrantMeta {
  label: string;
  axes: string;
  priority: 'high' | 'medium' | 'low';
}

export const QUADRANT_META: Record<Quadrant, QuadrantMeta> = {
  fazer_agora: { label: 'Fazer agora', axes: 'URGENTE · IMPORTANTE',         priority: 'high'   },
  agendar:     { label: 'Agendar',     axes: 'NÃO URGENTE · IMPORTANTE',     priority: 'medium' },
  delegar:     { label: 'Delegar',     axes: 'URGENTE · POUCO IMPORTANTE',   priority: 'low'    },
  eliminar:    { label: 'Eliminar',    axes: 'NÃO URGENTE · POUCO IMPORTANTE', priority: 'low'  },
};

export interface SuggestionResult {
  taskId: number;
  suggestedQuadrant: Quadrant;
  confidence: number;      // 0–100
  justification: string;
}

export interface PrioritizationSession {
  id: number;
  userId: string;
  status: 'in_progress' | 'applied' | 'discarded';
  createdAt: string;
  appliedAt: string | null;
}

export interface PrioritizationDecision {
  id: number;
  sessionId: number;
  taskId: number;
  suggestedQuadrant: Quadrant | null;
  chosenQuadrant: Quadrant;
  confidence: number | null;
}
