// TDD da tradução entre as linhas do SQLite (snake_case) e o JSON da API (camelCase)

import { isServerId, sessionBody, sessionFromApi, taskBody, taskFromApi, taskPatchBody, toIso } from '../api/mappers';

describe('toIso', () => {
    it('Trata o datetime do SQLite (sem fuso) como UTC', () => {
        expect(toIso('2026-10-01 10:00:00')).toBe('2026-10-01T10:00:00.000Z');
    });

    it('Mantém datas ISO e descarta vazio ou inválido', () => {
        expect(toIso('2026-10-01T10:00:00.000Z')).toBe('2026-10-01T10:00:00.000Z');
        expect(toIso(null)).toBeUndefined();
        expect(toIso('')).toBeUndefined();
        expect(toIso('lixo')).toBeUndefined();
    });
});

describe('isServerId', () => {
    it('Só aceita id numérico da API; UUID do Supabase não', () => {
        expect(isServerId('12')).toBe(true);
        expect(isServerId('3f2a-uuid')).toBe(false);
        expect(isServerId('123e4567-e89b-12d3-a456-426614174000')).toBe(false);
        expect(isServerId(null)).toBe(false);
        expect(isServerId(undefined)).toBe(false);
    });
});

describe('taskBody', () => {
    it('Converte a tarefa local para o corpo de criação e omite os nulos', () => {
        const body = taskBody({
            title: 'Estudar', description: null, priority: 'high', estimated_pomodoros: 3,
            due_date: '2026-12-01 12:00:00', quadrant: 'agendar', status: 'done', user_id: 'u',
        });

        expect(body).toEqual({
            title: 'Estudar', priority: 'high', estimatedPomodoros: 3,
            dueDate: '2026-12-01T12:00:00.000Z', quadrant: 'agendar',
        });
    });

    it('taskPatchBody acrescenta status e pomodoros concluídos', () => {
        expect(taskPatchBody({ title: 'x', status: 'done', completed_pomodoros: 2 })).toMatchObject({
            title: 'x', status: 'done', completedPomodoros: 2,
        });
    });
});

describe('taskFromApi', () => {
    it('Converte a resposta da API para as colunas locais, com remote_id em texto', () => {
        expect(taskFromApi({
            id: 7, title: 'T', description: null, priority: 'low', estimatedPomodoros: 2,
            completedPomodoros: 1, status: 'in_progress', completedAt: null, dueDate: '2026-12-01T12:00:00Z',
            quadrant: 'delegar', createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-02T10:00:00Z',
        })).toEqual({
            remote_id: '7', title: 'T', description: null, priority: 'low', estimated_pomodoros: 2,
            completed_pomodoros: 1, status: 'in_progress', completed_at: null, due_date: '2026-12-01T12:00:00Z',
            quadrant: 'delegar', created_at: '2026-10-01T10:00:00Z', updated_at: '2026-10-02T10:00:00Z',
        });
    });
});

describe('sessões', () => {
    it('sessionBody usa o id da tarefa no servidor e datas ISO', () => {
        expect(sessionBody({
            started_at: '2026-10-01 10:00:00', ended_at: '2026-10-01 10:25:00',
            duration_seconds: 1500, type: 'focus', status: 'completed',
        }, 9)).toEqual({
            taskId: 9, startedAt: '2026-10-01T10:00:00.000Z', endedAt: '2026-10-01T10:25:00.000Z',
            durationSeconds: 1500, type: 'focus', status: 'completed',
        });
    });

    it('sessionBody recusa sessão sem início (a API exige startedAt)', () => {
        expect(() => sessionBody({ type: 'focus', status: 'completed' }, undefined)).toThrow('started_at');
    });

    it('sessionFromApi devolve as colunas locais com o task_id local', () => {
        expect(sessionFromApi({
            id: 4, taskId: 9, startedAt: 'a', endedAt: 'b', durationSeconds: 60, type: 'focus', status: 'completed',
        }, 2)).toEqual({
            remote_id: '4', task_id: 2, started_at: 'a', ended_at: 'b', duration_seconds: 60, type: 'focus', status: 'completed',
        });
    });
});
