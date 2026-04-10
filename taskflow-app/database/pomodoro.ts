import * as SQLite from 'expo-sqlite';

import { PomodoroSession } from '@/types/pomodoro.type';

const db = SQLite.openDatabaseSync('taskflow.db');

// Inicia uma sessão nova vinculada a uma tarefa
export function createSession(input: { task_id: number; type: 'focus' | 'break' }): PomodoroSession {
    const resultado = db.runSync(
        'INSERT INTO pomodoro_sessions (task_id, type, started_at) VALUES (?, ?, datetime("now"))',
        [input.task_id, input.type]
    );

    const ultimoId = resultado.lastInsertRowId;

    const sessao = db.getFirstSync<PomodoroSession>(
        'SELECT * FROM pomodoro_sessions WHERE id = ?', [ultimoId]
    );

    return sessao!;
}

// Conclui a sessão — registra fim e duração
export function completeSession(id: number) {
    db.runSync(
        `UPDATE pomodoro_sessions 
         SET status = 'completed', 
             ended_at = datetime('now'),
             duration_minutes = ROUND((julianday('now') - julianday(started_at)) * 1440)
         WHERE id = ?`,
        [id]
    );
}

// Cancela a sessão sem contar como pomodoro
export function cancelSession(id: number) {
    db.runSync(
        `UPDATE pomodoro_sessions 
         SET status = 'cancelled', 
             ended_at = datetime('now'),
             duration_minutes = ROUND((julianday('now') - julianday(started_at)) * 1440)
         WHERE id = ?`,
        [id]
    );
}

// Lista o histórico de sessões de uma tarefa
export function getSessionsByTask(task_id: number): PomodoroSession[] {
    return db.getAllSync<PomodoroSession>(
        'SELECT * FROM pomodoro_sessions WHERE task_id = ? ORDER BY started_at DESC',
        [task_id]
    );
}

// Conta quantos pomodoros de foco foram concluídos em uma tarefa
export function countPomodorosConcluidos(task_id: number): number {
    const resultado = db.getFirstSync<{ total: number }>(
        `SELECT COUNT(*) as total FROM pomodoro_sessions 
         WHERE task_id = ? AND type = 'focus' AND status = 'completed'`,
        [task_id]
    );

    return resultado?.total ?? 0;
}
