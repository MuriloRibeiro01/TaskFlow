import * as SQLite from 'expo-sqlite';
import {
  startSession,
  decideTask,
  chooseFinal,
  chooseAll,
  undoDecision,
  applyPrioritization,
  discardPrioritization,
  getDecisionsForSession,
} from '../services/prioritization.service';
import { QUADRANT_META, Quadrant } from '@/types/prioritization.types';
import { notifyLocalChange } from '../sync/sync_trigger';

jest.mock('../sync/sync_trigger', () => ({ notifyLocalChange: jest.fn() }));

const db = SQLite.openDatabaseSync('taskflow.db');

describe('Prioritization Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('startSession', () => {
    it('insere uma nova sessão e a devolve', () => {
      (db.runSync as jest.Mock).mockReturnValueOnce({ lastInsertRowId: 42, changes: 1 });
      (db.getFirstSync as jest.Mock).mockReturnValueOnce({
        id: 42, user_id: 'user-xyz', status: 'in_progress',
        created_at: '2026-10-13 10:00:00', applied_at: null,
      });

      const session = startSession('user-xyz');

      expect(db.runSync).toHaveBeenCalledWith(
        'INSERT INTO prioritization_sessions (user_id, status) VALUES (?, ?)',
        ['user-xyz', 'in_progress']
      );
      expect(session).toEqual({
        id: 42, userId: 'user-xyz', status: 'in_progress',
        createdAt: '2026-10-13 10:00:00', appliedAt: null,
      });
    });
  });

  describe('decideTask', () => {
    const ai = {
      taskId: 10, importance: 80, urgency: 20, suggestedQuadrant: 'agendar' as const,
      confidence: 85, justification: 'conta para a nota',
    };

    it('grava o swipe do usuário e a sugestão da IA; a escolha final nasce igual ao usuário', () => {
      (db.runSync as jest.Mock).mockReturnValueOnce({ lastInsertRowId: 99, changes: 1 });
      (db.getFirstSync as jest.Mock).mockReturnValueOnce({
        id: 99, session_id: 1, task_id: 10, user_quadrant: 'fazer_agora',
        suggested_quadrant: 'agendar', chosen_quadrant: 'fazer_agora', confidence: 85,
        ai_importance: 80, ai_urgency: 20, ai_justification: 'conta para a nota',
      });

      const decision = decideTask(1, 10, 'fazer_agora', ai);

      expect(db.runSync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO prioritization_decisions'),
        [1, 10, 'fazer_agora', 'agendar', 'fazer_agora', 85, 80, 20, 'conta para a nota']
      );
      expect(decision).toEqual({
        id: 99, sessionId: 1, taskId: 10,
        userQuadrant: 'fazer_agora', suggestedQuadrant: 'agendar', chosenQuadrant: 'fazer_agora',
        confidence: 85, aiImportance: 80, aiUrgency: 20, aiJustification: 'conta para a nota',
      });
    });

    it('sem sugestão da IA grava os campos da IA como nulos', () => {
      (db.runSync as jest.Mock).mockReturnValueOnce({ lastInsertRowId: 5, changes: 1 });
      (db.getFirstSync as jest.Mock).mockReturnValueOnce(null);

      decideTask(1, 10, 'eliminar', null);

      expect(db.runSync).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO prioritization_decisions'),
        [1, 10, 'eliminar', null, 'eliminar', null, null, null, null]
      );
    });
  });

  describe('chooseFinal', () => {
    it('troca a escolha final de uma tarefa da sessão', () => {
      chooseFinal(1, 10, 'delegar');

      expect(db.runSync).toHaveBeenCalledWith(
        'UPDATE prioritization_decisions SET chosen_quadrant = ? WHERE session_id = ? AND task_id = ?',
        ['delegar', 1, 10]
      );
    });
  });

  describe('chooseAll', () => {
    it("'user' copia o quadrante do usuário para a escolha final", () => {
      chooseAll(1, 'user');

      expect(db.runSync).toHaveBeenCalledWith(
        'UPDATE prioritization_decisions SET chosen_quadrant = user_quadrant WHERE session_id = ? AND user_quadrant IS NOT NULL',
        [1]
      );
    });

    it("'ai' copia a sugestão da IA, só onde ela existe", () => {
      chooseAll(1, 'ai');

      expect(db.runSync).toHaveBeenCalledWith(
        'UPDATE prioritization_decisions SET chosen_quadrant = suggested_quadrant WHERE session_id = ? AND suggested_quadrant IS NOT NULL',
        [1]
      );
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
          userQuadrant: null,
          suggestedQuadrant: 'fazer_agora',
          chosenQuadrant: 'fazer_agora',
          confidence: 90,
          aiImportance: null,
          aiUrgency: null,
          aiJustification: null,
        },
        {
          id: 2,
          sessionId: 5,
          taskId: 12,
          userQuadrant: null,
          suggestedQuadrant: 'eliminar',
          chosenQuadrant: 'delegar',
          confidence: 70,
          aiImportance: null,
          aiUrgency: null,
          aiJustification: null,
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

      // marca pendente: sem isso a priorização nunca chegava à API
      expect(db.runSync).toHaveBeenCalledWith(
        "UPDATE tasks SET quadrant = ?, priority = ?, sync_status = 'pending', updated_at = datetime('now') WHERE id = ?",
        ['fazer_agora', QUADRANT_META['fazer_agora'].priority, 10]
      );

      expect(db.runSync).toHaveBeenCalledWith(
        "UPDATE tasks SET quadrant = ?, priority = ?, sync_status = 'pending', updated_at = datetime('now') WHERE id = ?",
        ['eliminar', QUADRANT_META['eliminar'].priority, 11]
      );

      expect(notifyLocalChange).toHaveBeenCalledTimes(1);

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
