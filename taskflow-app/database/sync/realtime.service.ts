// sync/realtime.service.ts
import { supabase } from '../supabase/supabase';
import { db } from '../schemas';

export class RealtimeService {
  private subscriptions: any[] = [];

  subscribeToChanges() {
    // Inscrever para mudanças nas tasks
    const taskSubscription = supabase
      .channel('tasks_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks'
        },
        (payload) => {
          this.handleTaskChange(payload);
        }
      )
      .subscribe();

    // Inscrever para mudanças nas sessões pomodoro
    const sessionSubscription = supabase
      .channel('sessions_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pomodoro_sessions'
        },
        (payload) => {
          this.handleSessionChange(payload);
        }
      )
      .subscribe();

    this.subscriptions = [taskSubscription, sessionSubscription];
  }

  unsubscribe() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
  }

  private handleTaskChange(payload: any) {
    const { event, new: newRecord, old: oldRecord } = payload;

    switch (event) {
      case 'INSERT':
        this.insertTaskLocal(newRecord);
        break;
      case 'UPDATE':
        this.updateTaskLocal(newRecord);
        break;
      case 'DELETE':
        this.deleteTaskLocal(oldRecord.id);
        break;
    }
  }

  private handleSessionChange(payload: any) {
    const { event, new: newRecord, old: oldRecord } = payload;

    switch (event) {
      case 'INSERT':
        this.insertSessionLocal(newRecord);
        break;
      case 'UPDATE':
        this.updateSessionLocal(newRecord);
        break;
      case 'DELETE':
        this.deleteSessionLocal(oldRecord.id);
        break;
    }
  }

  private insertTaskLocal(task: any) {
    try {
      db.runSync(
        `INSERT OR REPLACE INTO tasks 
         (remote_id, user_id, title, description, priority, 
          estimated_pomodoros, completed_pomodoros, status, 
          due_date, completed_at, sync_status, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', ?)`,
        task.id,
        task.user_id,
        task.title,
        task.description,
        task.priority,
        task.estimated_pomodoros,
        task.completed_pomodoros || 0,
        task.status,
        task.due_date,
        task.completed_at,
        task.updated_at || new Date().toISOString()
      );
    } catch (error) {
      console.error('Error inserting task locally:', error);
    }
  }

  private updateTaskLocal(task: any) {
    try {
      db.runSync(
        `UPDATE tasks 
         SET title = ?, description = ?, priority = ?,
             estimated_pomodoros = ?, completed_pomodoros = ?,
             status = ?, due_date = ?, completed_at = ?,
             updated_at = ?, sync_status = 'synced'
         WHERE remote_id = ?`,
        task.title,
        task.description,
        task.priority,
        task.estimated_pomodoros,
        task.completed_pomodoros || 0,
        task.status,
        task.due_date,
        task.completed_at,
        task.updated_at || new Date().toISOString(),
        task.id
      );
    } catch (error) {
      console.error('Error updating task locally:', error);
    }
  }

  private deleteTaskLocal(remoteId: string) {
    try {
      db.runSync(
        `DELETE FROM tasks WHERE remote_id = ?`,
        remoteId
      );
    } catch (error) {
      console.error('Error deleting task locally:', error);
    }
  }

  private insertSessionLocal(session: any) {
    try {
      db.runSync(
        `INSERT OR REPLACE INTO pomodoro_sessions 
         (remote_id, task_id, user_id, started_at, ended_at, 
          duration_seconds, type, status, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
        session.id,
        session.task_id,
        session.user_id,
        session.started_at,
        session.ended_at,
        session.duration_seconds,
        session.type,
        session.status
      );
    } catch (error) {
      console.error('Error inserting session locally:', error);
    }
  }

  private updateSessionLocal(session: any) {
    try {
      db.runSync(
        `UPDATE pomodoro_sessions 
         SET task_id = ?, started_at = ?, ended_at = ?,
             duration_seconds = ?, type = ?, status = ?,
             sync_status = 'synced'
         WHERE remote_id = ?`,
        session.task_id,
        session.started_at,
        session.ended_at,
        session.duration_seconds,
        session.type,
        session.status,
        session.id
      );
    } catch (error) {
      console.error('Error updating session locally:', error);
    }
  }

  private deleteSessionLocal(remoteId: string) {
    try {
      db.runSync(
        `DELETE FROM pomodoro_sessions WHERE remote_id = ?`,
        remoteId
      );
    } catch (error) {
      console.error('Error deleting session locally:', error);
    }
  }
}