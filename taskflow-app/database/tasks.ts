// CRUD das tasks

import * as SQLite from 'expo-sqlite';

import { Task } from '@/types/task.types';

const db = SQLite.openDatabaseSync('taskflow.db');

export function createTask(input: {
    title: string;
    description: string;
    priority: string;
    estimated_pomodoros?: number;
    due_date?: string;
}): Task {
    const resultado = db.runSync(
        'INSERT INTO tasks (title, description, priority, estimated_pomodoros, due_date) VALUES (?, ?, ?, ?, ?)',
        [input.title, input.description, input.priority, input.estimated_pomodoros ?? null, input.due_date ?? null]
    );

    const tarefa = db.getFirstSync<Task>(
        'SELECT * FROM tasks WHERE id = ?', [resultado.lastInsertRowId]
    );

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
    db.runSync(
        'UPDATE tasks SET status = ?, completed_at = datetime("now") WHERE id = ?', ['done', id]
    )
}

export function getAllTasks(): Task[] {
    return db.getAllSync<Task>(
        'SELECT * FROM tasks ORDER BY created_at DESC'
    );
}

export function listTasks(status: string, priority: string): Task[] {
    return db.getAllSync<Task>(
        'SELECT * FROM tasks WHERE date(created_at) = date("now") AND status = ? AND priority = ?', [status, priority]
    );
}

export function getTaskById(id: number) {
    return db.getFirstSync<Task>(
        'SELECT * FROM tasks WHERE id = ?', [id]
    );
}

export function reopenTask(id: number) {
    db.runSync(
        'UPDATE tasks SET status = ? WHERE id = ?', ['pending', id]
    )
}