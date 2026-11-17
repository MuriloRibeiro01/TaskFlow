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
  importance: number;      // 0–100
  urgency: number;         // 0–100
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
  userQuadrant: Quadrant | null;      // swipe cego do usuário
  suggestedQuadrant: Quadrant | null; // sugestão da IA
  chosenQuadrant: Quadrant;           // escolha final (usada ao aplicar)
  confidence: number | null;
  aiImportance: number | null;
  aiUrgency: number | null;
  aiJustification: string | null;
}
