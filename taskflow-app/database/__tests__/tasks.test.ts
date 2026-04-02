// TDD das tasks

import { createTask, deleteTask } from "../tasks";

import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('taskflow.db');

describe('CreateTask', () => {
    it('Cria uma tarefa e retorna ela com um ID', () => {

        const input = {
            title: 'Estudar',
            description: 'Estudar Java',
            priority: 'high'
        }

        const tarefaCriada = createTask(input);

        expect(tarefaCriada.id).toBeDefined();
        expect(tarefaCriada.title).toBe('Estudar');
        expect(tarefaCriada.priority).toBe('high');
        expect(tarefaCriada.status).toBe('pending');
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
});