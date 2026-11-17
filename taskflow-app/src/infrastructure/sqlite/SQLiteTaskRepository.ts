import * as SQLite from 'expo-sqlite';
import { Task, TaskProps } from '../../domain/task/Task';
import { TaskRepository } from '../../domain/task/TaskRepository';
import { Priority } from '../../domain/task/Priority';
import { TaskStatus } from '../../domain/task/TaskStatus';
import { notifyLocalChange } from '../../../database/sync/sync_trigger';

const db = SQLite.openDatabaseSync('taskflow.db');

type Row = {
  id: number; remote_id: string | null; title: string; description: string;
  priority: string; status: string; estimated_pomodoros: number | null;
  completed_pomodoros: number | null; due_date: string | null; quadrant: string | null;
  user_id: string; created_at: string; completed_at: string | null; updated_at: string | null;
};

function rowToTask(r: Row): Task {
  return Task.restore({
    id: r.id,
    remoteId: r.remote_id,
    title: r.title,
    description: r.description,
    priority: r.priority as Priority,
    status: r.status as TaskStatus,
    estimatedPomodoros: r.estimated_pomodoros ?? 1,
    completedPomodoros: r.completed_pomodoros ?? 0,
    dueDate: r.due_date,
    quadrant: r.quadrant,
    userId: r.user_id,
    createdAt: r.created_at,
    completedAt: r.completed_at,
    updatedAt: r.updated_at,
  } satisfies TaskProps);
}

export class SQLiteTaskRepository implements TaskRepository {
  save(task: Task): Task {
    const result = db.runSync(
      'INSERT INTO tasks (title, description, priority, estimated_pomodoros, due_date, user_id, sync_status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [task.title, task.description, task.priority, task.estimatedPomodoros, task.dueDate, task.userId, 'pending']
    );
    const row = db.getFirstSync<Row>('SELECT * FROM tasks WHERE id = ?', [result.lastInsertRowId]);
    notifyLocalChange();
    return rowToTask(row!);
  }

  findById(id: number): Task | null {
    const row = db.getFirstSync<Row>('SELECT * FROM tasks WHERE id = ?', [id]);
    return row ? rowToTask(row) : null;
  }

  findByUserId(userId: string): Task[] {
    const rows = db.getAllSync<Row>('SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    return rows.map(rowToTask);
  }

  update(task: Task): void {
    db.runSync(
      "UPDATE tasks SET title=?, description=?, priority=?, estimated_pomodoros=?, due_date=?, status=?, completed_at=?, sync_status='pending', updated_at=datetime('now') WHERE id=?",
      [task.title, task.description, task.priority, task.estimatedPomodoros, task.dueDate, task.status, task.completedAt, task.id!]
    );
    notifyLocalChange();
  }

  delete(id: number): void {
    db.runSync(
      `INSERT OR IGNORE INTO pending_deletes (kind, remote_id)
       SELECT 'task', remote_id FROM tasks
       WHERE id = ? AND remote_id IS NOT NULL AND remote_id NOT GLOB '*[^0-9]*'`, [id]
    );
    db.runSync('DELETE FROM tasks WHERE id = ?', [id]);
    notifyLocalChange();
  }
}
