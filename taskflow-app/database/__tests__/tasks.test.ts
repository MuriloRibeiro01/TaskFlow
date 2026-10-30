// TDD das tasks

import { completeTask, createTask, deleteTask, editTask, getAllTasks, getTaskById, listTasks, reopenTask } from "../tasks";

import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('taskflow.db');

describe('CreateTask', () => {
    it('Cria uma tarefa e retorna ela com um ID', () => {

        const input = {
            title: 'Estudar',
            description: 'Estudar Java',
            priority: 'high',
            user_id: 'user-123'
        }

        const tarefaCriada = createTask(input);

        expect(tarefaCriada.id).toBeDefined();
        expect(tarefaCriada.title).toBe('Estudar');
        expect(tarefaCriada.priority).toBe('high');
        expect(tarefaCriada.status).toBe('pending');
    });

    it('Vincula a tarefa ao usuário logado e marca como pendente de sincronização', () => {
        createTask({
            title: 'Estudar',
            description: 'Estudar Java',
            priority: 'high',
            user_id: 'user-123'
        });

        expect(db.runSync).toHaveBeenCalledWith(
            'INSERT INTO tasks (title, description, priority, estimated_pomodoros, due_date, user_id, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
            ['Estudar', 'Estudar Java', 'high', null, null, 'user-123', 'pending']
        );
    });
});

describe('GetAllTasks', () => {
    it('Lista apenas as tarefas do usuário informado', () => {
        getAllTasks('user-123');

        expect(db.getAllSync).toHaveBeenCalledWith(
            'SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC', ['user-123']
        );
    });
});

describe('DeleteTask', () => {
    it('Deleta uma tarefa com base no ID e retorna mensagem', () => {
        deleteTask(1);

        // Espera que o db rodou com essa query
        expect(db.runSync).toHaveBeenCalledWith(
            'DELETE FROM tasks WHERE id = ?', [1]
        );
    });

    it('Guarda o id da API antes de apagar, para o sync apagar lá também (senão o pull traria a tarefa de volta)', () => {
        (db.runSync as jest.Mock).mockClear();

        deleteTask(1);

        const sqls = (db.runSync as jest.Mock).mock.calls.map(c => String(c[0]));
        expect(sqls[0]).toContain('INSERT OR IGNORE INTO pending_deletes');
        expect(sqls[0]).toContain("NOT GLOB '*[^0-9]*'");
        expect((db.runSync as jest.Mock).mock.calls[0][1]).toEqual([1]);
        expect(sqls[1]).toBe('DELETE FROM tasks WHERE id = ?');
    });
});

describe('EditTask', () => {
    it('Editar título, descrição ou prioridade de uma tarefa específica com base no ID', () => {
        
        const input = {
            title: 'Jogar',
            description: 'Jogar Resident Evil 9',
            priority: 'low'
        }

        editTask(1, input);

        expect(db.runSync).toHaveBeenCalledWith(
            "UPDATE tasks SET title = ?, description = ?, priority = ?, estimated_pomodoros = ?, due_date = ?, sync_status = 'pending', updated_at = datetime('now') WHERE id = ?",
            ['Jogar', 'Jogar Resident Evil 9', 'low', null, null, 1]
        );

    });

    it('Editar tarefa com estimated_pomodoros e due_date', () => {
        const input = {
            title: 'Estudar',
            description: 'Estudar TypeScript',
            priority: 'medium',
            estimated_pomodoros: 3,
            due_date: '2026-10-15',
        };

        editTask(2, input);

        expect(db.runSync).toHaveBeenCalledWith(
            "UPDATE tasks SET title = ?, description = ?, priority = ?, estimated_pomodoros = ?, due_date = ?, sync_status = 'pending', updated_at = datetime('now') WHERE id = ?",
            ['Estudar', 'Estudar TypeScript', 'medium', 3, '2026-10-15', 2]
        );
    });
});

describe('CompleteTask', () => {
    it('Editar o completed_at marcando a tarefa como completa', () => {
        
        completeTask(1);

        expect(db.runSync).toHaveBeenCalledWith(
            'UPDATE tasks SET status = ?, completed_at = datetime("now"), completed_pomodoros = ?, sync_status = \'pending\', updated_at = datetime(\'now\') WHERE id = ?', ['done', 4, 1]
        );

    });
});

describe('ListTasks', () => {
    it('Lista todas as tarefas do dia com filtro de status e prioridade', () => {
        listTasks('done', 'high');

        expect(db.getAllSync).toHaveBeenCalledWith(
            'SELECT * FROM tasks WHERE date(created_at) = date("now") AND status = ? AND priority = ?', ['done', 'high']
        );
    })
})

describe('GetTaskById', () => {
    it('Pega uma tarefa apenas com base no ID', () => {

        getTaskById(1);

        expect(db.getFirstSync).toHaveBeenCalledWith(
            'SELECT * FROM tasks WHERE id = ?', [1]
        )     

    })
});

describe('ReOpenTask', () => {
    it('Desmarca uma tarefa como concluída para pendente.', () => {
        reopenTask(1);
        
        expect(db.runSync).toHaveBeenCalledWith(
            'UPDATE tasks SET status = ?, sync_status = \'pending\', updated_at = datetime(\'now\') WHERE id = ?', ['pending', 1]
        );
    })
})