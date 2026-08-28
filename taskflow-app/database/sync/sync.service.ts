// sync/sync.service.ts
import { db } from '../schemas';
import { supabase } from '../supabase/supabase';
import { ConflictResolver } from './conflict.resolver';
import { NetworkService } from '../services/network.service';

export interface SyncResult {
  success: boolean;
  tasksSynced: number;
  sessionsSynced: number;
  errors: string[];
}

interface Task {
  id?: number;
  remote_id?: string;
  user_id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  estimated_pomodoros?: number;
  completed_pomodoros?: number;
  status: 'pending' | 'in_progress' | 'done';
  due_date?: string;
  completed_at?: string;
  sync_status: 'synced' | 'pending' | 'conflict';
  created_at?: string;
  updated_at?: string;
}

interface PomodoroSession {
  id?: number;
  remote_id?: string;
  task_id?: number;
  user_id: string;
  started_at: string;
  ended_at?: string;
  duration_seconds?: number;
  type: 'focus' | 'short_break' | 'long_break';
  status: 'completed' | 'cancelled' | 'interrupted' | 'in_progress';
  sync_status: 'synced' | 'pending' | 'conflict';
}

export class SyncService {
  private isSyncing = false;
  private conflictResolver: ConflictResolver;
  private networkService: NetworkService;

  constructor() {
    this.conflictResolver = new ConflictResolver();
    this.networkService = new NetworkService();
  }

  async syncAll(): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        success: false,
        tasksSynced: 0,
        sessionsSynced: 0,
        errors: ['Sync already in progress']
      };
    }

    if (!this.networkService.isConnected) {
      return {
        success: false,
        tasksSynced: 0,
        sessionsSynced: 0,
        errors: ['No internet connection']
      };
    }

    this.isSyncing = true;
    const result: SyncResult = {
      success: true,
      tasksSynced: 0,
      sessionsSynced: 0,
      errors: []
    };

    try {
      console.log('🔄 Starting full sync...');

      const tasksResult = await this.syncTasks();
      result.tasksSynced = tasksResult.synced;
      result.errors.push(...tasksResult.errors);

      const sessionsResult = await this.syncPomodoroSessions();
      result.sessionsSynced = sessionsResult.synced;
      result.errors.push(...sessionsResult.errors);

      console.log(`✅ Sync completed: ${result.tasksSynced} tasks, ${result.sessionsSynced} sessions synced`);

    } catch (error) {
      result.success = false;
      result.errors.push(`Sync failed: ${error}`);
      console.error('❌ Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  private async syncTasks(): Promise<{ synced: number; errors: string[] }> {
    let synced = 0;
    const errors: string[] = [];

    try {
      const pendingTasks = this.getPendingTasks();
      console.log(`📤 Uploading ${pendingTasks.length} pending tasks...`);

      for (const task of pendingTasks) {
        try {
          await this.upsertTaskToSupabase(task);
          synced++;
        } catch (error) {
          errors.push(`Failed to upload task ${task.id}: ${error}`);
        }
      }

      const remoteTasks = await this.fetchRemoteTasks();
      console.log(`📥 Downloading ${remoteTasks.length} remote tasks...`);

      for (const task of remoteTasks) {
        try {
          const localTask = this.getLocalTaskByRemoteId(task.id);
          
          if (localTask) {
            if (localTask.sync_status === 'conflict') {
              const resolvedTask = this.conflictResolver.resolveTaskConflict(localTask, task);
              this.upsertTaskToLocal(resolvedTask, 'synced');
            } else if (localTask.updated_at < task.updated_at) {
              this.upsertTaskToLocal(task, 'synced');
            }
          } else {
            this.upsertTaskToLocal(task, 'synced');
          }
        } catch (error) {
          errors.push(`Failed to download task ${task.id}: ${error}`);
        }
      }

    } catch (error) {
      errors.push(`Sync tasks failed: ${error}`);
    }

    return { synced, errors };
  }

  private async syncPomodoroSessions(): Promise<{ synced: number; errors: string[] }> {
    let synced = 0;
    const errors: string[] = [];

    try {
      const pendingSessions = this.getPendingSessions();
      console.log(`📤 Uploading ${pendingSessions.length} pending sessions...`);

      for (const session of pendingSessions) {
        try {
          await this.upsertSessionToSupabase(session);
          synced++;
        } catch (error) {
          errors.push(`Failed to upload session ${session.id}: ${error}`);
        }
      }

      const remoteSessions = await this.fetchRemoteSessions();
      console.log(`📥 Downloading ${remoteSessions.length} remote sessions...`);

      for (const session of remoteSessions) {
        try {
          const localSession = this.getLocalSessionByRemoteId(session.id);
          
          if (localSession) {
            if (localSession.sync_status === 'conflict') {
              const resolvedSession = this.conflictResolver.resolveSessionConflict(localSession, session);
              this.upsertSessionToLocal(resolvedSession, 'synced');
            } else if (localSession.ended_at < session.ended_at) {
              this.upsertSessionToLocal(session, 'synced');
            }
          } else {
            this.upsertSessionToLocal(session, 'synced');
          }
        } catch (error) {
          errors.push(`Failed to download session ${session.id}: ${error}`);
        }
      }

    } catch (error) {
      errors.push(`Sync sessions failed: ${error}`);
    }

    return { synced, errors };
  }

  private getPendingTasks(): any[] {
    try {
      return db.getAllSync(
        `SELECT * FROM tasks 
         WHERE sync_status IN ('pending', 'conflict') 
         AND user_id IS NOT NULL`
      );
    } catch (error) {
      console.error('Error getting pending tasks:', error);
      return [];
    }
  }

  private getPendingSessions(): any[] {
    try {
      return db.getAllSync(
        `SELECT * FROM pomodoro_sessions 
         WHERE sync_status IN ('pending', 'conflict') 
         AND user_id IS NOT NULL`
      );
    } catch (error) {
      console.error('Error getting pending sessions:', error);
      return [];
    }
  }

  private async upsertTaskToSupabase(task: any): Promise<void> {
    const { data, error } = await supabase
      .from('tasks')
      .upsert({
        id: task.remote_id || undefined,
        user_id: task.user_id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        estimated_pomodoros: task.estimated_pomodoros,
        completed_pomodoros: task.completed_pomodoros || 0,
        status: task.status,
        due_date: task.due_date,
        completed_at: task.completed_at,
        updated_at: new Date().toISOString()
      })
      .select();

    if (error) throw error;

    if (data && data[0]) {
      db.runSync(
        `UPDATE tasks 
         SET remote_id = ?, sync_status = 'synced', updated_at = ? 
         WHERE id = ?`,
        data[0].id,
        new Date().toISOString(),
        task.id
      );
    }
  }

  private async fetchRemoteTasks(): Promise<any[]> {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  private getLocalTaskByRemoteId(remoteId: string): any | null {
    try {
      const result = db.getAllSync(
        `SELECT * FROM tasks WHERE remote_id = ?`,
        remoteId
      );
      return result && result[0] ? result[0] : null;
    } catch (error) {
      console.error('Error getting local task by remote_id:', error);
      return null;
    }
  }

  private upsertTaskToLocal(task: any, syncStatus: 'synced' | 'pending' | 'conflict' = 'synced'): void {
    db.runSync(
      `INSERT OR REPLACE INTO tasks 
       (id, remote_id, user_id, title, description, priority, 
        estimated_pomodoros, completed_pomodoros, status, 
        due_date, completed_at, sync_status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      task.id || null,
      task.remote_id || task.id,
      task.user_id,
      task.title,
      task.description,
      task.priority,
      task.estimated_pomodoros,
      task.completed_pomodoros || 0,
      task.status,
      task.due_date,
      task.completed_at,
      syncStatus,
      new Date().toISOString()
    );
  }

  private async upsertSessionToSupabase(session: any): Promise<void> {
    const { data, error } = await supabase
      .from('pomodoro_sessions')
      .upsert({
        id: session.remote_id || undefined,
        task_id: session.task_id,
        user_id: session.user_id,
        started_at: session.started_at,
        ended_at: session.ended_at,
        duration_seconds: session.duration_seconds,
        type: session.type,
        status: session.status
      })
      .select();

    if (error) throw error;

    if (data && data[0]) {
      db.runSync(
        `UPDATE pomodoro_sessions 
         SET remote_id = ?, sync_status = 'synced' 
         WHERE id = ?`,
        data[0].id,
        session.id
      );
    }
  }

  private async fetchRemoteSessions(): Promise<any[]> {
    const { data, error } = await supabase
      .from('pomodoro_sessions')
      .select('*')
      .order('ended_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  private getLocalSessionByRemoteId(remoteId: string): any | null {
    try {
      const result = db.getAllSync(
        `SELECT * FROM pomodoro_sessions WHERE remote_id = ?`,
        remoteId
      );
      return result && result[0] ? result[0] : null;
    } catch (error) {
      console.error('Error getting local session by remote_id:', error);
      return null;
    }
  }

  private upsertSessionToLocal(session: any, syncStatus: 'synced' | 'pending' | 'conflict' = 'synced'): void {
    db.runSync(
      `INSERT OR REPLACE INTO pomodoro_sessions 
       (id, remote_id, task_id, user_id, started_at, ended_at, 
        duration_seconds, type, status, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      session.id || null,
      session.remote_id || session.id,
      session.task_id,
      session.user_id,
      session.started_at,
      session.ended_at,
      session.duration_seconds,
      session.type,
      session.status,
      syncStatus
    );
  }

  async syncTask(localId: number): Promise<void> {
    try {
      const task = db.getAllSync(
        `SELECT * FROM tasks WHERE id = ?`,
        localId
      );

      if (!task || !task[0]) {
        throw new Error(`Task ${localId} not found`);
      }

      await this.upsertTaskToSupabase(task[0]);
    } catch (error) {
      console.error('Error syncing task:', error);
      throw error;
    }
  }

  async syncSession(localId: number): Promise<void> {
    try {
      const session = db.getAllSync(
        `SELECT * FROM pomodoro_sessions WHERE id = ?`,
        localId
      );

      if (!session || !session[0]) {
        throw new Error(`Session ${localId} not found`);
      }

      await this.upsertSessionToSupabase(session[0]);
    } catch (error) {
      console.error('Error syncing session:', error);
      throw error;
    }
  }

  markTaskAsConflict(localId: number): void {
    db.runSync(
      `UPDATE tasks SET sync_status = 'conflict' WHERE id = ?`,
      localId
    );
  }

  markSessionAsConflict(localId: number): void {
    db.runSync(
      `UPDATE pomodoro_sessions SET sync_status = 'conflict' WHERE id = ?`,
      localId
    );
  }

  resetAllSyncStatus(): void {
    db.runSync(`UPDATE tasks SET sync_status = 'pending'`);
    db.runSync(`UPDATE pomodoro_sessions SET sync_status = 'pending'`);
  }

  hasPendingData(): boolean {
    try {
      const pendingTasks = db.getAllSync(
        `SELECT COUNT(*) as count FROM tasks WHERE sync_status IN ('pending', 'conflict')`
      );
      const pendingSessions = db.getAllSync(
        `SELECT COUNT(*) as count FROM pomodoro_sessions WHERE sync_status IN ('pending', 'conflict')`
      );

      const tasksCount = pendingTasks && pendingTasks[0] ? (pendingTasks[0] as any).count : 0;
      const sessionsCount = pendingSessions && pendingSessions[0] ? (pendingSessions[0] as any).count : 0;

      return tasksCount > 0 || sessionsCount > 0;
    } catch (error) {
      console.error('Error checking pending data:', error);
      return false;
    }
  }

  getSyncStats(): {
    pendingTasks: number;
    pendingSessions: number;
    conflictTasks: number;
    conflictSessions: number;
  } {
    try {
      const stats = db.getAllSync(`
        SELECT 
          (SELECT COUNT(*) FROM tasks WHERE sync_status = 'pending') as pendingTasks,
          (SELECT COUNT(*) FROM tasks WHERE sync_status = 'conflict') as conflictTasks,
          (SELECT COUNT(*) FROM pomodoro_sessions WHERE sync_status = 'pending') as pendingSessions,
          (SELECT COUNT(*) FROM pomodoro_sessions WHERE sync_status = 'conflict') as conflictSessions
      `);

      if (stats && stats[0]) {
        const s = stats[0] as any;
        return {
          pendingTasks: s.pendingTasks || 0,
          pendingSessions: s.pendingSessions || 0,
          conflictTasks: s.conflictTasks || 0,
          conflictSessions: s.conflictSessions || 0
        };
      }

      return {
        pendingTasks: 0,
        pendingSessions: 0,
        conflictTasks: 0,
        conflictSessions: 0
      };
    } catch (error) {
      console.error('Error getting sync stats:', error);
      return {
        pendingTasks: 0,
        pendingSessions: 0,
        conflictTasks: 0,
        conflictSessions: 0
      };
    }
  }
}