import * as SQLite from 'expo-sqlite';
import {
  PrioritizationDecision,
  PrioritizationSession,
  QUADRANT_META,
  Quadrant,
  SuggestionResult,
} from '@/types/prioritization.types';
import { notifyLocalChange } from '../sync/sync_trigger';

const db = SQLite.openDatabaseSync('taskflow.db');

export function startSession(userId: string): PrioritizationSession {
  const result = db.runSync(
    'INSERT INTO prioritization_sessions (user_id, status) VALUES (?, ?)',
    [userId, 'in_progress']
  );

  const sessionId = Number(result.lastInsertRowId);

  const row = db.getFirstSync<any>(
    'SELECT * FROM prioritization_sessions WHERE id = ?',
    [sessionId]
  );

  return {
    id: row?.id ?? sessionId,
    userId: row?.user_id ?? userId,
    status: (row?.status as PrioritizationSession['status']) ?? 'in_progress',
    createdAt: row?.created_at ?? new Date().toISOString(),
    appliedAt: row?.applied_at ?? null,
  };
}

function toDecision(row: any): PrioritizationDecision {
  return {
    id: row.id,
    sessionId: row.session_id,
    taskId: row.task_id,
    userQuadrant: row.user_quadrant ?? null,
    suggestedQuadrant: row.suggested_quadrant ?? null,
    chosenQuadrant: row.chosen_quadrant,
    confidence: row.confidence ?? null,
    aiImportance: row.ai_importance ?? null,
    aiUrgency: row.ai_urgency ?? null,
    aiJustification: row.ai_justification ?? null,
  };
}

// Swipe cego do usuário + sugestão da IA (se houver). A escolha final nasce igual ao usuário.
export function decideTask(
  sessionId: number,
  taskId: number,
  userQuadrant: Quadrant,
  ai: SuggestionResult | null
): PrioritizationDecision {
  const result = db.runSync(
    `INSERT INTO prioritization_decisions
      (session_id, task_id, user_quadrant, suggested_quadrant, chosen_quadrant, confidence, ai_importance, ai_urgency, ai_justification)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      sessionId, taskId, userQuadrant, ai?.suggestedQuadrant ?? null, userQuadrant,
      ai?.confidence ?? null, ai?.importance ?? null, ai?.urgency ?? null, ai?.justification ?? null,
    ]
  );

  const decisionId = Number(result.lastInsertRowId);
  const row = db.getFirstSync<any>('SELECT * FROM prioritization_decisions WHERE id = ?', [decisionId]);

  return row ? toDecision(row) : {
    id: decisionId, sessionId, taskId,
    userQuadrant, suggestedQuadrant: ai?.suggestedQuadrant ?? null, chosenQuadrant: userQuadrant,
    confidence: ai?.confidence ?? null, aiImportance: ai?.importance ?? null,
    aiUrgency: ai?.urgency ?? null, aiJustification: ai?.justification ?? null,
  };
}

export function chooseFinal(sessionId: number, taskId: number, quadrant: Quadrant): void {
  db.runSync(
    'UPDATE prioritization_decisions SET chosen_quadrant = ? WHERE session_id = ? AND task_id = ?',
    [quadrant, sessionId, taskId]
  );
}

export function chooseAll(sessionId: number, side: 'user' | 'ai'): void {
  const column = side === 'user' ? 'user_quadrant' : 'suggested_quadrant';
  db.runSync(
    `UPDATE prioritization_decisions SET chosen_quadrant = ${column} WHERE session_id = ? AND ${column} IS NOT NULL`,
    [sessionId]
  );
}

export function undoDecision(sessionId: number): void {
  db.runSync(
    'DELETE FROM prioritization_decisions WHERE id = (SELECT MAX(id) FROM prioritization_decisions WHERE session_id = ?)',
    [sessionId]
  );
}

export function getDecisionsForSession(sessionId: number): PrioritizationDecision[] {
  const rows = db.getAllSync<any>(
    'SELECT * FROM prioritization_decisions WHERE session_id = ? ORDER BY id ASC',
    [sessionId]
  );

  return rows.map(toDecision);
}

export function applyPrioritization(sessionId: number): void {
  const decisions = getDecisionsForSession(sessionId);

  for (const decision of decisions) {
    const priority = QUADRANT_META[decision.chosenQuadrant].priority;
    db.runSync(
      "UPDATE tasks SET quadrant = ?, priority = ?, sync_status = 'pending', updated_at = datetime('now') WHERE id = ?",
      [decision.chosenQuadrant, priority, decision.taskId]
    );
  }

  db.runSync(
    "UPDATE prioritization_sessions SET status = 'applied', applied_at = datetime('now') WHERE id = ?",
    [sessionId]
  );
  notifyLocalChange();
}

export function discardPrioritization(sessionId: number): void {
  db.runSync(
    "UPDATE prioritization_sessions SET status = 'discarded' WHERE id = ?",
    [sessionId]
  );
}
