// TDD das tasks

import { completeTask, createTask, deleteTask, editTask, listTasks } from "../tasks";

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

describe('EditTask', () => {
    it('Editar título, descrição ou prioridade de uma tarefa específica com base no ID', () => {
        
        const input = {
            title: 'Jogar',
            description: 'Jogar Resident Evil 9',
            priority: 'low'
        }

        editTask(1, input);

        expect(db.runSync).toHaveBeenCalledWith(
            'UPDATE tasks SET title = ?, description = ?, priority = ? WHERE id = ?', ['Jogar', 'Jogar Resident Evil 9', 'low', 1]
        );

    });
});

describe('CompleteTask', () => {
    it('Editar o completed_at marcando a tarefa como completa', () => {
        
        completeTask(1);

        expect(db.runSync).toHaveBeenCalledWith(
            'UPDATE tasks SET status = ?, completed_at = datetime("now"), completed_pomodoros = ?  WHERE id = ?', ['done', 5, 1]
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