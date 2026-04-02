// CRUD das tasks

import * as SQLite from 'expo-sqlite';

import { Task } from '@/types/task.types';

const db = SQLite.openDatabaseSync('taskflow.db');

//Cria um objeto com os valores de input e executa um select SQL
// : Task define o type do retorno
export function createTask(input: { title: string; description: string; priority: string }): Task {
    const resultado = db.runSync(
        'INSERT INTO tasks (title, description, priority) VALUES (?, ?, ?)',
        [input.title, input.description, input.priority]
    );

    const ultimoId = resultado.lastInsertRowId;

    // O resultado da consulta é um type 'Task'
    const tarefa = db.getFirstSync<Task>(
        'SELECT * FROM tasks WHERE id = ?', [ultimoId]
    );

    // etorna o valor NOT NULL
    return tarefa!;
};

export function deleteTask(id: number) {

    db.runSync(
        'DELETE FROM tasks WHERE id = ?', [id]
    );

}