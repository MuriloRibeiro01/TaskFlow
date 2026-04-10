import { createSession, completeSession, cancelSession, getSessionsByTask, countPomodorosConcluidos } from "../pomodoro";

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

describe('CancelSession', () => {
    it('Deve selecionar uma sessão de pomodoro pelo ID e alterar o status para cancelado.', () => {
        cancelSession(1);

        expect(db.runSync).toHaveBeenCalledWith(
            `UPDATE pomodoro_sessions 
         SET status = 'cancelled', 
             ended_at = datetime('now'),
             duration_minutes = ROUND((julianday('now') - julianday(started_at)) * 1440)
         WHERE id = ?`, [1]
        )
    })
})

describe('GetSessionsByTask', () => {
    it('Monta um array com todas as sessões de pomodoro criadas para uma tarefa específica, buscada pelo ID', () => {
        
        // Variável para capturar o return da função
        const sessoes = getSessionsByTask(1);
            
        expect(sessoes).toEqual([]);
    })
})

describe('CountPomodorosConcluidos', () => {
    it('Seleciona uma tarefa específica e conta o número de pomodoros concluídos.', () => {
        const totalPomodoros = countPomodorosConcluidos(1);

        expect(totalPomodoros).toBeDefined();
    })
})