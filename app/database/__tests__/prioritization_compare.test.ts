import { quadrantFromAnswers, compareLists } from '../services/prioritization.compare';
import { PrioritizationDecision } from '@/types/prioritization.types';

function dec(taskId: number, user: any, ai: any, justification = 'j', confidence = 80): PrioritizationDecision {
  return {
    id: taskId, sessionId: 1, taskId,
    userQuadrant: user, suggestedQuadrant: ai, chosenQuadrant: user,
    confidence, aiImportance: null, aiUrgency: null, aiJustification: justification,
  };
}

describe('quadrantFromAnswers', () => {
  it.each([
    [true, true, 'fazer_agora'],
    [true, false, 'agendar'],
    [false, true, 'delegar'],
    [false, false, 'eliminar'],
  ])('importante=%s urgente=%s -> %s', (i, u, q) => {
    expect(quadrantFromAnswers(i, u)).toBe(q);
  });
});

describe('compareLists', () => {
  it('lista vazia: sem divergência e taxa 0', () => {
    expect(compareLists([])).toEqual({ agreements: [], divergences: [], agreementRate: 0 });
  });

  it('tudo igual: taxa 100', () => {
    const r = compareLists([dec(1, 'agendar', 'agendar'), dec(2, 'eliminar', 'eliminar')]);
    expect(r.agreements).toHaveLength(2);
    expect(r.divergences).toHaveLength(0);
    expect(r.agreementRate).toBe(100);
  });

  it('tudo diferente: taxa 0', () => {
    const r = compareLists([dec(1, 'agendar', 'delegar'), dec(2, 'eliminar', 'fazer_agora')]);
    expect(r.divergences).toHaveLength(2);
    expect(r.agreementRate).toBe(0);
  });

  it('uma divergência de duas: taxa 50 e traz os dois lados', () => {
    const r = compareLists([dec(1, 'agendar', 'agendar'), dec(2, 'eliminar', 'fazer_agora', 'tem prova', 70)]);
    expect(r.divergences).toEqual([
      { taskId: 2, userQuadrant: 'eliminar', aiQuadrant: 'fazer_agora', justification: 'tem prova', confidence: 70 },
    ]);
    expect(r.agreementRate).toBe(50);
  });

  it('ignora decisão sem sugestão da IA', () => {
    const r = compareLists([dec(1, 'agendar', null)]);
    expect(r.agreements).toHaveLength(0);
    expect(r.divergences).toHaveLength(0);
    expect(r.agreementRate).toBe(0);
  });
});
