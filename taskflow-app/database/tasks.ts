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

export function editTask(id: number, input: { title: string; description: string; priority: string}) {
    
    db.runSync(
        'UPDATE tasks SET title = ?, description = ?, priority = ? WHERE id = ?',
        [input.title, input.description, input.priority, id]
    )
    
}

export function completeTask(id: number) {

    const result = db.getFirstSync<{ count: number }>(
        'SELECT COUNT(*) as count FROM pomodoro_sessions WHERE status = "completed" AND task_id = ?', [id]
    )

    const countPomodoro = result?.count ?? 0;

    db.runSync(
        'UPDATE tasks SET status = ?, completed_at = datetime("now"), completed_pomodoros = ? WHERE id = ?', ['done', countPomodoro, id]
    )
}

export function listTasks(status: string, priority: string): Task[] {
    const listTasks = db.getAllSync<Task>(
        'SELECT * FROM tasks WHERE date(created_at) = date("now") AND status = ? AND priority = ?', [status, priority]
    )

    return listTasks;
}