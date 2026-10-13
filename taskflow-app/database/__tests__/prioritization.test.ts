import * as SQLite from 'expo-sqlite';
import {
  startPrioritization,
  decideTask,
  undoDecision,
  applyPrioritization,
  discardPrioritization,
  getDecisionsForSession,
} from '../services/prioritization.service';
import { suggestPrioritization } from '../services/stub-prioritizer';
import * as tasksModule from '../tasks';
import { Task } from '@/types/task.types';
import { QUADRANT_META, Quadrant } from '@/types/prioritization.types';

const db = SQLite.openDatabaseSync('taskflow.db');

describe('Prioritization Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('startPrioritization', () => {
    it('insere uma nova sessão e retorna sugestões para tarefas pendentes', async () => {
      const mockTasks: Task[] = [
        {
          id: 10,
          title: 'Tarefa 1',
          description: 'Desc 1',
          priority: 'low',
          status: 'pending',
          estimated_pomodoros: null,
          completed_pomodoros: null,
          due_date: null,
          created_at: '2026-01-01',
          completed_at: null,
          updated_at: null,
        },
        {
          id: 11,
          title: 'Tarefa Concluída',
          description: 'Desc 2',
          priority: 'medium',
          status: 'done',
          estimated_pomodoros: null,
          completed_pomodoros: null,
          due_date: null,
          created_at: '2026-01-01',
          completed_at: '2026-01-02',
          updated_at: null,
        },
      ];

      jest.spyOn(tasksModule, 'getAllTasks').mockReturnValue(mockTasks);

      (db.runSync as jest.Mock).mockReturnValueOnce({ lastInsertRowId: 42, changes: 1 });
      (db.getFirstSync as jest.Mock).mockReturnValueOnce({
        id: 42,
        user_id: 'user-xyz',
        status: 'in_progress',
        created_at: '2026-10-13 10:00:00',
        applied_at: null,
      });

      const result = await startPrioritization('user-xyz');

      expect(db.runSync).toHaveBeenCalledWith(
        'INSERT INTO prioritization_sessions (user_id, status) VALUES (?, ?)',
        ['user-xyz', 'in_progress']
      );

      expect(result.session).toEqual({
        id: 42,
        userId: 'user-xyz',
        status: 'in_progress',
        createdAt: '2026-10-13 10:00:00',
        appliedAt: null,
      });

      expect(result.suggestions).toHaveLength(1);
      expect(result.suggestions[0].taskId).toBe(10);
      expect(['fazer_agora', 'agendar', 'delegar', 'eliminar']).toContain(
        result.suggestions[0].suggestedQuadrant
      );
    });
  });

  describe('decideTask', () => {
    it('insere a decisão em prioritization_decisions e retorna o registro criado', () => {
      (db.runSync as jest.Mock).mockReturnValueOnce({ lastInsertRowId: 99, changes: 1 });
      (db.getFirstSync as jest.Mock).mockReturnValueOnce({
        id: 99,
        session_id: 1,
        task_id: 10,
        suggested_quadrant: 'fazer_agora',
        chosen_quadrant: 'agendar',
        confidence: 85,
        created_at: '2026-10-13 10:05:00',
      });

      const decision = decideTask(1, 10, 'agendar', 'fazer_agora', 85);

      expect(db.runSync).toHaveBeenCalledWith(
        'INSERT INTO prioritization_decisions (session_id, task_id, suggested_quadrant, chosen_quadrant, confidence) VALUES (?, ?, ?, ?, ?)',
        [1, 10, 'fazer_agora', 'agendar', 85]
      );

      expect(decision).toEqual({
        id: 99,
        sessionId: 1,
        taskId: 10,
        suggestedQuadrant: 'fazer_agora',
        chosenQuadrant: 'agendar',
        confidence: 85,
      });
    });
  });

  describe('undoDecision', () => {
    it('deleta o registro com maior id da sessão informada', () => {
      undoDecision(1);

      expect(db.runSync).toHaveBeenCalledWith(
        'DELETE FROM prioritization_decisions WHERE id = (SELECT MAX(id) FROM prioritization_decisions WHERE session_id = ?)',
        [1]
      );
    });
  });

  describe('getDecisionsForSession', () => {
    it('retorna a lista de decisões ordenadas por id ASC', () => {
      (db.getAllSync as jest.Mock).mockReturnValueOnce([
        {
          id: 1,
          session_id: 5,
          task_id: 10,
          suggested_quadrant: 'fazer_agora',
          chosen_quadrant: 'fazer_agora',
          confidence: 90,
        },
        {
          id: 2,
          session_id: 5,
          task_id: 12,
          suggested_quadrant: 'eliminar',
          chosen_quadrant: 'delegar',
          confidence: 70,
        },
      ]);

      const decisions = getDecisionsForSession(5);

      expect(db.getAllSync).toHaveBeenCalledWith(
        'SELECT * FROM prioritization_decisions WHERE session_id = ? ORDER BY id ASC',
        [5]
      );

      expect(decisions).toEqual([
        {
          id: 1,
          sessionId: 5,
          taskId: 10,
          suggestedQuadrant: 'fazer_agora',
          chosenQuadrant: 'fazer_agora',
          confidence: 90,
        },
        {
          id: 2,
          sessionId: 5,
          taskId: 12,
          suggestedQuadrant: 'eliminar',
          chosenQuadrant: 'delegar',
          confidence: 70,
        },
      ]);
    });
  });

  describe('applyPrioritization', () => {
    it('atualiza as tasks com quadrant e priority correspondentes e finaliza a sessão como applied', () => {
      (db.getAllSync as jest.Mock).mockReturnValueOnce([
        {
          id: 1,
          session_id: 5,
          task_id: 10,
          suggested_quadrant: 'fazer_agora',
          chosen_quadrant: 'fazer_agora',
          confidence: 80,
        },
        {
          id: 2,
          session_id: 5,
          task_id: 11,
          suggested_quadrant: 'delegar',
          chosen_quadrant: 'eliminar',
          confidence: 65,
        },
      ]);

      applyPrioritization(5);

      expect(db.runSync).toHaveBeenCalledWith(
        'UPDATE tasks SET quadrant = ?, priority = ? WHERE id = ?',
        ['fazer_agora', QUADRANT_META['fazer_agora'].priority, 10]
      );

      expect(db.runSync).toHaveBeenCalledWith(
        'UPDATE tasks SET quadrant = ?, priority = ? WHERE id = ?',
        ['eliminar', QUADRANT_META['eliminar'].priority, 11]
      );

      expect(db.runSync).toHaveBeenCalledWith(
        "UPDATE prioritization_sessions SET status = 'applied', applied_at = datetime('now') WHERE id = ?",
        [5]
      );
    });
  });

  describe('discardPrioritization', () => {
    it('atualiza o status da sessão para discarded', () => {
      discardPrioritization(5);

      expect(db.runSync).toHaveBeenCalledWith(
        "UPDATE prioritization_sessions SET status = 'discarded' WHERE id = ?",
        [5]
      );
    });
  });
});

describe('Stub Prioritizer', () => {
  it('gera sugestões com quadrante, confiança entre 60 e 95 e justificativa', async () => {
    const tasks: Task[] = [
      {
        id: 1,
        title: 'T1',
        description: '',
        priority: 'low',
        status: 'pending',
        estimated_pomodoros: null,
        completed_pomodoros: null,
        due_date: null,
        created_at: '2026-01-01',
        completed_at: null,
        updated_at: null,
      },
      {
        id: 2,
        title: 'T2',
        description: '',
        priority: 'high',
        status: 'pending',
        estimated_pomodoros: null,
        completed_pomodoros: null,
        due_date: null,
        created_at: '2026-01-01',
        completed_at: null,
        updated_at: null,
      },
    ];

    const suggestions = await suggestPrioritization(tasks);

    expect(suggestions).toHaveLength(2);
    for (const s of suggestions) {
      expect(['fazer_agora', 'agendar', 'delegar', 'eliminar']).toContain(s.suggestedQuadrant);
      expect(s.confidence).toBeGreaterThanOrEqual(60);
      expect(s.confidence).toBeLessThanOrEqual(95);
      expect(typeof s.justification).toBe('string');
      expect(s.justification.length).toBeGreaterThan(5);
    }
  });
});
