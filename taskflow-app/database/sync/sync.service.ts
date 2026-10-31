// sync/sync.service.ts
import { db } from '../schemas';
import { api, ApiError, getSession } from '../api/client';
import { isServerId, sessionBody, sessionFromApi, sessionPatchBody, taskBody, taskFromApi, taskPatchBody, toIso } from '../api/mappers';
import { ConflictResolver } from './conflict.resolver';
import { NetworkService } from '../services/network.service';

export interface SyncResult {
  success: boolean;
  // enviados para a API / mudanças aplicadas no celular vindas da API
  tasksSynced: number;
  sessionsSynced: number;
  tasksDownloaded: number;
  sessionsDownloaded: number;
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
  // Pedido que chegou durante um sync: roda de novo no fim, senão a gravação feita no meio esperaria o próximo gatilho
  private rerunRequested = false;
  private running: Promise<SyncResult> | null = null;
  private conflictResolver: ConflictResolver;
  private networkService: NetworkService;

  constructor() {
    this.conflictResolver = new ConflictResolver();
    this.networkService = new NetworkService();
  }

  // Resolve quando não há sync rodando nem agendado (inclusive a rodada extra).
  async idle(): Promise<void> {
    while (this.running) await this.running;
  }

  syncAll(): Promise<SyncResult> {
    if (this.isSyncing) {
      this.rerunRequested = true;
      return Promise.resolve({
        success: false,
        tasksSynced: 0,
        sessionsSynced: 0,
        tasksDownloaded: 0,
        sessionsDownloaded: 0,
        errors: ['Sync already in progress']
      });
    }

    const run = this.runSync().finally(() => {
      if (this.running === run) this.running = null;
      if (this.rerunRequested) {
        this.rerunRequested = false;
        this.syncAll();
      }
    });
    this.running = run;
    return run;
  }

  private async runSync(): Promise<SyncResult> {

    if (!this.networkService.isConnected) {
      return {
        success: false,
        tasksSynced: 0,
        sessionsSynced: 0,
        tasksDownloaded: 0,
        sessionsDownloaded: 0,
        errors: ['No internet connection']
      };
    }

    this.isSyncing = true;
    const result: SyncResult = {
      success: true,
      tasksSynced: 0,
      sessionsSynced: 0,
      tasksDownloaded: 0,
      sessionsDownloaded: 0,
      errors: []
    };

    try {
      console.log('🔄 Starting full sync...');

      const userId = await this.currentUserId();
      this.requeueLegacyRemoteIds();
      this.adoptOrphans(userId);

      result.errors.push(...(await this.pushDeletes()));

      const tasksResult = await this.syncTasks(userId);
      result.tasksSynced = tasksResult.synced;
      result.tasksDownloaded = tasksResult.downloaded;
      result.errors.push(...tasksResult.errors);

      const sessionsResult = await this.syncPomodoroSessions(userId);
      result.sessionsSynced = sessionsResult.synced;
      result.sessionsDownloaded = sessionsResult.downloaded;
      result.errors.push(...sessionsResult.errors);

      console.log(
        `✅ Sync completed: tarefas ${result.tasksSynced} enviadas / ${result.tasksDownloaded} baixadas, ` +
        `sessões ${result.sessionsSynced} enviadas / ${result.sessionsDownloaded} baixadas`
      );

    } catch (error) {
      result.success = false;
      result.errors.push(`Sync failed: ${error}`);
      console.error('❌ Sync failed:', error);
    } finally {
      this.isSyncing = false;
    }

    return result;
  }

  // O dono dos dados no SQLite é o usuário logado na API; no servidor o dono vem do token.
  private async currentUserId(): Promise<string> {
    const session = await getSession();
    if (!session) throw new Error('No session');
    return session.user.id;
  }

  // Registros que guardam um UUID do Supabase em remote_id nunca existiram na API: voltam para a fila.
  private requeueLegacyRemoteIds(): void {
    for (const table of ['tasks', 'pomodoro_sessions']) {
      db.runSync(
        `UPDATE ${table} SET remote_id = NULL, sync_status = 'pending'
         WHERE remote_id IS NOT NULL AND remote_id GLOB '*[^0-9]*'`
      );
    }
  }

  // Criados antes de existir login (user_id vazio): passam a ser do usuário logado e sobem no sync.
  private adoptOrphans(userId: string): void {
    for (const table of ['tasks', 'pomodoro_sessions']) {
      db.runSync(
        `UPDATE ${table} SET user_id = ?, sync_status = 'pending' WHERE user_id IS NULL OR user_id = ''`,
        userId
      );
    }
  }

  // Apagados localmente (deleteTask guarda o id do servidor): apaga na API antes de baixar, senão voltariam.
  private async pushDeletes(): Promise<string[]> {
    const errors: string[] = [];
    const rows = db.getAllSync(`SELECT kind, remote_id FROM pending_deletes`) as any[];

    for (const { kind, remote_id } of rows) {
      try {
        try {
          await api('DELETE', `/${kind === 'task' ? 'tasks' : 'sessions'}/${remote_id}`);
        } catch (error) {
          if (!(error instanceof ApiError && error.status === 404)) throw error;
        }
        db.runSync(`DELETE FROM pending_deletes WHERE kind = ? AND remote_id = ?`, kind, remote_id);
      } catch (error) {
        errors.push(`Failed to delete ${kind} ${remote_id}: ${error}`);
      }
    }

    return errors;
  }

  private async syncTasks(userId: string): Promise<{ synced: number; downloaded: number; errors: string[] }> {
    let synced = 0;
    let downloaded = 0;
    const errors: string[] = [];

    try {
      const pendingTasks = this.getPendingTasks(userId);
      console.log(`📤 Uploading ${pendingTasks.length} pending tasks...`);

      for (const task of pendingTasks) {
        try {
          await this.upsertTaskToApi(task);
          synced++;
        } catch (error) {
          errors.push(`Failed to upload task ${task.id}: ${error}`);
        }
      }

      const remoteTasks = await this.fetchRemoteTasks();
      console.log(`📥 Downloading ${remoteTasks.length} remote tasks...`);

      for (const remote of remoteTasks) {
        try {
          const task = taskFromApi(remote);
          const localTask = this.getLocalTaskByRemoteId(task.remote_id);

          if (!localTask) {
            this.insertTaskLocal(task, userId);
            downloaded++;
          } else if (localTask.sync_status === 'conflict') {
            // local mais novo: fica na fila e sobe no próximo sync
            if (this.conflictResolver.resolveTaskConflict(localTask, task) === localTask) {
              db.runSync(`UPDATE tasks SET sync_status = 'pending' WHERE id = ?`, localTask.id);
            } else {
              this.updateTaskLocal(localTask.id, task);
              downloaded++;
            }
          } else if (localTask.sync_status === 'synced' && this.isNewer(task.updated_at, localTask.updated_at)) {
            this.updateTaskLocal(localTask.id, task);
            downloaded++;
          }
        } catch (error) {
          errors.push(`Failed to download task ${remote.id}: ${error}`);
        }
      }

    } catch (error) {
      errors.push(`Sync tasks failed: ${error}`);
    }

    return { synced, downloaded, errors };
  }

  private async syncPomodoroSessions(userId: string): Promise<{ synced: number; downloaded: number; errors: string[] }> {
    let synced = 0;
    let downloaded = 0;
    const errors: string[] = [];

    try {
      const pendingSessions = this.getPendingSessions(userId);
      console.log(`📤 Uploading ${pendingSessions.length} pending sessions...`);

      for (const session of pendingSessions) {
        try {
          await this.upsertSessionToApi(session);
          synced++;
        } catch (error) {
          errors.push(`Failed to upload session ${session.id}: ${error}`);
        }
      }

      const remoteSessions = await this.fetchRemoteSessions();
      console.log(`📥 Downloading ${remoteSessions.length} remote sessions...`);

      for (const remote of remoteSessions) {
        try {
          const session = sessionFromApi(remote, this.localTaskId(remote.taskId));
          const localSession = this.getLocalSessionByRemoteId(session.remote_id);

          // A sessão sincronizada é sempre regravada com a do servidor; só conta como baixada a nova.
          if (!localSession) {
            this.insertSessionLocal(session, userId);
            downloaded++;
          } else if (localSession.sync_status === 'synced') {
            this.updateSessionLocal(localSession.id, session);
          } else if (localSession.sync_status === 'conflict') {
            if (this.conflictResolver.resolveSessionConflict(localSession, session) === localSession) {
              db.runSync(`UPDATE pomodoro_sessions SET sync_status = 'pending' WHERE id = ?`, localSession.id);
            } else {
              this.updateSessionLocal(localSession.id, session);
            }
          }
        } catch (error) {
          errors.push(`Failed to download session ${remote.id}: ${error}`);
        }
      }

    } catch (error) {
      errors.push(`Sync sessions failed: ${error}`);
    }

    return { synced, downloaded, errors };
  }

  // O SQLite e a API usam formatos de data diferentes; compara como instantes.
  private isNewer(remoteDate?: string, localDate?: string): boolean {
    const remote = toIso(remoteDate);
    const local = toIso(localDate);
    return !!remote && (!local || remote > local);
  }

  private getPendingTasks(userId: string): any[] {
    try {
      return db.getAllSync(
        `SELECT * FROM tasks 
         WHERE sync_status IN ('pending', 'conflict') 
         AND user_id = ?`,
        userId
      );
    } catch (error) {
      console.error('Error getting pending tasks:', error);
      return [];
    }
  }

  private getPendingSessions(userId: string): any[] {
    try {
      return db.getAllSync(
        `SELECT * FROM pomodoro_sessions 
         WHERE sync_status IN ('pending', 'conflict') 
         AND user_id = ?`,
        userId
      );
    } catch (error) {
      console.error('Error getting pending sessions:', error);
      return [];
    }
  }

  private async upsertTaskToApi(task: any): Promise<void> {
    let remote;

    if (isServerId(task.remote_id)) {
      remote = await api('PATCH', `/tasks/${task.remote_id}`, taskPatchBody(task));
    } else {
      remote = await api('POST', '/tasks', taskBody(task));
      // Guarda o id já agora: se o PATCH abaixo falhar, o próximo sync atualiza em vez de duplicar.
      db.runSync(`UPDATE tasks SET remote_id = ? WHERE id = ?`, String(remote.id), task.id);
      // A criação não aceita status nem pomodoros concluídos.
      if (task.status !== 'pending' || (task.completed_pomodoros ?? 0) > 0) {
        remote = await api('PATCH', `/tasks/${remote.id}`, taskPatchBody(task));
      }
    }

    db.runSync(
      `UPDATE tasks 
       SET remote_id = ?, sync_status = 'synced', updated_at = ? 
       WHERE id = ?`,
      String(remote.id),
      remote.updatedAt,
      task.id
    );
  }

  private async fetchRemoteTasks(): Promise<any[]> {
    return api('GET', '/tasks');
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

  private insertTaskLocal(task: any, userId: string): void {
    db.runSync(
      `INSERT INTO tasks 
       (remote_id, user_id, title, description, priority, 
        estimated_pomodoros, completed_pomodoros, status, 
        due_date, completed_at, quadrant, created_at, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
      task.remote_id,
      userId,
      task.title,
      task.description,
      task.priority,
      task.estimated_pomodoros,
      task.completed_pomodoros,
      task.status,
      task.due_date,
      task.completed_at,
      task.quadrant,
      task.created_at,
      task.updated_at
    );
  }

  private updateTaskLocal(localId: number, task: any): void {
    db.runSync(
      `UPDATE tasks SET title = ?, description = ?, priority = ?, 
        estimated_pomodoros = ?, completed_pomodoros = ?, status = ?, 
        due_date = ?, completed_at = ?, quadrant = ?, updated_at = ?, sync_status = 'synced'
       WHERE id = ?`,
      task.title,
      task.description,
      task.priority,
      task.estimated_pomodoros,
      task.completed_pomodoros,
      task.status,
      task.due_date,
      task.completed_at,
      task.quadrant,
      task.updated_at,
      localId
    );
  }

  // Id da tarefa no SQLite a partir do id dela na API (null se ainda não foi baixada).
  private localTaskId(remoteTaskId?: number | null): number | null {
    if (remoteTaskId == null) return null;
    const row = db.getAllSync(`SELECT id FROM tasks WHERE remote_id = ?`, String(remoteTaskId))[0] as any;
    return row ? row.id : null;
  }

  // Id da tarefa na API; a sessão só sobe depois da tarefa dela.
  private remoteTaskId(localTaskId?: number | null): number | undefined {
    if (localTaskId == null) return undefined;
    const row = db.getAllSync(`SELECT remote_id FROM tasks WHERE id = ?`, localTaskId)[0] as any;
    if (!row || !isServerId(row.remote_id)) throw new Error(`Task ${localTaskId} not synced yet`);
    return Number(row.remote_id);
  }

  private async upsertSessionToApi(session: any): Promise<void> {
    const remote = isServerId(session.remote_id)
      ? await api('PATCH', `/sessions/${session.remote_id}`, sessionPatchBody(session))
      : await api('POST', '/sessions', sessionBody(session, this.remoteTaskId(session.task_id)));

    db.runSync(
      `UPDATE pomodoro_sessions 
       SET remote_id = ?, sync_status = 'synced' 
       WHERE id = ?`,
      String(remote.id),
      session.id
    );
  }

  private async fetchRemoteSessions(): Promise<any[]> {
    return api('GET', '/sessions');
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

  private insertSessionLocal(session: any, userId: string): void {
    db.runSync(
      `INSERT INTO pomodoro_sessions 
       (remote_id, task_id, user_id, started_at, ended_at, 
        duration_seconds, type, status, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
      session.remote_id,
      session.task_id,
      userId,
      session.started_at,
      session.ended_at,
      session.duration_seconds,
      session.type,
      session.status
    );
  }

  private updateSessionLocal(localId: number, session: any): void {
    db.runSync(
      `UPDATE pomodoro_sessions 
       SET task_id = ?, started_at = ?, ended_at = ?, duration_seconds = ?, 
           type = ?, status = ?, sync_status = 'synced' 
       WHERE id = ?`,
      session.task_id,
      session.started_at,
      session.ended_at,
      session.duration_seconds,
      session.type,
      session.status,
      localId
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

      await this.upsertTaskToApi(task[0]);
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

      await this.upsertSessionToApi(session[0]);
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