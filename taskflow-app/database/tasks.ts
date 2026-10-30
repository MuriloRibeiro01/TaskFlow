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
    user_id: string;
}): Task {
    const resultado = db.runSync(
        'INSERT INTO tasks (title, description, priority, estimated_pomodoros, due_date, user_id, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [input.title, input.description, input.priority, input.estimated_pomodoros ?? null, input.due_date ?? null, input.user_id, 'pending']
    );

    const tarefa = db.getFirstSync<Task>(
        'SELECT * FROM tasks WHERE id = ?', [resultado.lastInsertRowId]
    );

    return tarefa!;
};

export function deleteTask(id: number) {

    // Tarefa que já existe na API: guarda o id para o sync apagar lá (só ids numéricos; UUID do Supabase não vale)
    db.runSync(
        `INSERT OR IGNORE INTO pending_deletes (kind, remote_id)
         SELECT 'task', remote_id FROM tasks
         WHERE id = ? AND remote_id IS NOT NULL AND remote_id NOT GLOB '*[^0-9]*'`, [id]
    );

    db.runSync(
        'DELETE FROM tasks WHERE id = ?', [id]
    );

}

export function editTask(id: number, input: {
  title: string;
  description: string;
  priority: string;
  estimated_pomodoros?: number;
  due_date?: string | null;
}) {
    db.runSync(
        "UPDATE tasks SET title = ?, description = ?, priority = ?, estimated_pomodoros = ?, due_date = ?, sync_status = 'pending', updated_at = datetime('now') WHERE id = ?",
        [input.title, input.description, input.priority, input.estimated_pomodoros ?? null, input.due_date ?? null, id]
    )
}

export function completeTask(id: number) {

    const result = db.getFirstSync<{ count: number }>(
        'SELECT COUNT(*) as count FROM pomodoro_sessions WHERE status = "completed" AND task_id = ?', [id]
    )

    const countPomodoro = result?.count ?? 0;

    db.runSync(
        'UPDATE tasks SET status = ?, completed_at = datetime("now"), completed_pomodoros = ?, sync_status = \'pending\', updated_at = datetime(\'now\') WHERE id = ?', ['done', countPomodoro, id]
    )
}

export function getAllTasks(userId: string): Task[] {
    return db.getAllSync<Task>(
        'SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC', [userId]
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
        'UPDATE tasks SET status = ?, sync_status = \'pending\', updated_at = datetime(\'now\') WHERE id = ?', ['pending', id]
    )
}