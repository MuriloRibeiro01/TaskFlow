import * as SQLite from 'expo-sqlite';
import { getAllTasks } from '@/database/tasks';
import { Task } from '@/types/task.types';
import {
  PrioritizationDecision,
  PrioritizationSession,
  QUADRANT_META,
  Quadrant,
  SuggestionResult,
} from '@/types/prioritization.types';
import { suggestPrioritization } from './stub-prioritizer';
import { notifyLocalChange } from '../sync/sync_trigger';

const db = SQLite.openDatabaseSync('taskflow.db');

export async function startPrioritization(
  userId: string
): Promise<{ session: PrioritizationSession; suggestions: SuggestionResult[] }> {
  const result = db.runSync(
    'INSERT INTO prioritization_sessions (user_id, status) VALUES (?, ?)',
    [userId, 'in_progress']
  );

  const sessionId = Number(result.lastInsertRowId);

  const row = db.getFirstSync<any>(
    'SELECT * FROM prioritization_sessions WHERE id = ?',
    [sessionId]
  );

  const session: PrioritizationSession = {
    id: row?.id ?? sessionId,
    userId: row?.user_id ?? userId,
    status: (row?.status as PrioritizationSession['status']) ?? 'in_progress',
    createdAt: row?.created_at ?? new Date().toISOString(),
    appliedAt: row?.applied_at ?? null,
  };

  const tasks = getAllTasks(userId).filter((t: Task) => t.status !== 'done');
  const suggestions = await suggestPrioritization(tasks);

  return { session, suggestions };
}

export function decideTask(
  sessionId: number,
  taskId: number,
  chosenQuadrant: Quadrant,
  suggestedQuadrant: Quadrant | null,
  confidence: number | null
): PrioritizationDecision {
  const result = db.runSync(
    'INSERT INTO prioritization_decisions (session_id, task_id, suggested_quadrant, chosen_quadrant, confidence) VALUES (?, ?, ?, ?, ?)',
    [sessionId, taskId, suggestedQuadrant, chosenQuadrant, confidence]
  );

  const decisionId = Number(result.lastInsertRowId);

  const row = db.getFirstSync<any>(
    'SELECT * FROM prioritization_decisions WHERE id = ?',
    [decisionId]
  );

  return {
    id: row?.id ?? decisionId,
    sessionId: row?.session_id ?? sessionId,
    taskId: row?.task_id ?? taskId,
    suggestedQuadrant:
      (row?.suggested_quadrant !== undefined
        ? row.suggested_quadrant
        : suggestedQuadrant) ?? null,
    chosenQuadrant: row?.chosen_quadrant ?? chosenQuadrant,
    confidence:
      (row?.confidence !== undefined ? row.confidence : confidence) ?? null,
  };
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

  return rows.map((row) => ({
    id: row.id,
    sessionId: row.session_id,
    taskId: row.task_id,
    suggestedQuadrant: row.suggested_quadrant ?? null,
    chosenQuadrant: row.chosen_quadrant,
    confidence: row.confidence ?? null,
  }));
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
