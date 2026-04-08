import { createSession, completeSession, cancelSession, getSessionsByTask, countPomodoros } from "../pomodoro";

import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('taskflow.db');

describe('CreateSession', () => {
    it('Cria uma sessão de pomodoro de 25min e retorna o ID', () => {
        
        // Sobrescreve o mock para que ele passe nesse teste
        (db.getFirstSync as jest.Mock).mockReturnValueOnce({
            id: 1,
            task_id: 1,
            type: 'focus',
            started_at: '2026-01-01 00:00:00',
        });

        const taskToFocus = { task_id: 1, type: 'focus' as const };
        const pomodoroCriado = createSession(taskToFocus);

        expect(pomodoroCriado.task_id).toBe(1);
        expect(pomodoroCriado.type).toBe('focus');
    })
})

describe('CompleteSession', () => {
    it('Acessa uma sessão de pomodoro aberta pelo ID e conclui.', () => {
        completeSession(1);

        expect(db.runSync).toHaveBeenCalledWith(
            `UPDATE pomodoro_sessions 
         SET status = 'completed', 
             ended_at = datetime('now'),
             duration_minutes = ROUND((julianday('now') - julianday(started_at)) * 1440)
         WHERE id = ?`, [1])
    })
})