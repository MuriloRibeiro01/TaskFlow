import { api } from '../api/client';
import { isServerId } from '../api/mappers';
import { Task } from '@/types/task.types';
import { Quadrant, SuggestionResult } from '@/types/prioritization.types';

export interface SuggestionsOutcome {
  source: 'ai' | 'model' | 'rules';
  suggestions: SuggestionResult[];
  skipped: number[]; // ids locais que não foram enviados (ainda sem id na API)
}

export async function requestSuggestions(tasks: Task[]): Promise<SuggestionsOutcome> {
  const sendable = tasks.filter((t) => isServerId(t.remote_id));
  const skipped = tasks.filter((t) => !isServerId(t.remote_id)).map((t) => t.id);
  if (sendable.length === 0) return { source: 'rules', suggestions: [], skipped };

  const localByRemote = new Map(sendable.map((t) => [Number(t.remote_id), t.id]));
  const res = await api<{ source: 'ai' | 'model' | 'rules'; suggestions: any[] }>(
    'POST',
    '/prioritization/suggestions',
    { taskIds: [...localByRemote.keys()] }
  );

  const suggestions: SuggestionResult[] = [];
  for (const s of res.suggestions) {
    const localId = localByRemote.get(s.taskId);
    if (localId === undefined) continue;
    suggestions.push({
      taskId: localId,
      importance: s.importance,
      urgency: s.urgency,
      suggestedQuadrant: s.quadrant as Quadrant,
      confidence: s.confidence,
      justification: s.justification,
    });
  }
  return { source: res.source, suggestions, skipped };
}
