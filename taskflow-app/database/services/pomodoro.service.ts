// services/pomodoro.service.ts
import { db } from '../schemas';
import { supabase } from '../supabase/supabase';
import { SyncService } from '../sync/sync.service';
import { TasksService } from './tasks.service';

export interface PomodoroSession {
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

export interface CreatePomodoroDTO {
  task_id?: number;
  user_id: string;
  type: 'focus' | 'short_break' | 'long_break';
  started_at?: string;
}

export interface UpdatePomodoroDTO {
  ended_at?: string;
  duration_seconds?: number;
  status?: 'completed' | 'cancelled' | 'interrupted';
}

export interface PomodoroStats {
  totalSessions: number;
  completedSessions: number;
  totalFocusTime: number; // em minutos
  averageSessionDuration: number; // em minutos
  sessionsByType: {
    focus: number;
    short_break: number;
    long_break: number;
  };
  dailyStats: {
    date: string;
    sessions: number;
    focusTime: number;
  }[];
}

export class PomodoroService {
  private syncService: SyncService;
  private tasksService: TasksService;

  constructor() {
    this.syncService = new SyncService();
    this.tasksService = new TasksService();
  }

  /**
   * Inicia uma nova sessão pomodoro
   */
  async startSession(data: CreatePomodoroDTO): Promise<number> {
    try {
      // Validar dados
      if (!data.user_id) {
        throw new Error('user_id is required');
      }

      // Se for foco e tiver task_id, verificar se a task existe
      if (data.type === 'focus' && data.task_id) {
        const task = this.tasksService.getTask(data.task_id);
        if (!task) {
          throw new Error(`Task ${data.task_id} not found`);
        }
      }

      const startedAt = data.started_at || new Date().toISOString();

      // Inserir localmente com status 'pending'
      const result = db.runSync(
        `INSERT INTO pomodoro_sessions 
         (task_id, user_id, started_at, type, status, sync_status)
         VALUES (?, ?, ?, ?, 'in_progress', 'pending')`,
        data.task_id || null,
        data.user_id,
        startedAt,
        data.type
      );

      const sessionId = result.lastInsertRowId;

      // Se for foco, atualizar status da task para 'in_progress'
      if (data.type === 'focus' && data.task_id) {
        await this.tasksService.updateTaskStatus(data.task_id, 'in_progress');
      }

      // Tentar sincronizar imediatamente - CORRIGIDO
      try {
        await this.syncService.syncSession(sessionId);
      } catch (error) {
        console.error('Failed to sync new session:', error);
      }

      return sessionId;
    } catch (error) {
      console.error('Error starting pomodoro session:', error);
      throw error;
    }
  }

  /**
   * Completa uma sessão pomodoro
   */
  async completeSession(
    id: number, 
    endedAt?: string, 
    durationSeconds?: number
  ): Promise<void> {
    try {
      const session = this.getSession(id);
      if (!session) {
        throw new Error(`Session ${id} not found`);
      }

      const endTime = endedAt || new Date().toISOString();
      const duration = durationSeconds || this.calculateDuration(
        session.started_at,
        endTime
      );

      // Atualizar localmente
      db.runSync(
        `UPDATE pomodoro_sessions 
         SET ended_at = ?, duration_seconds = ?, status = 'completed', 
             sync_status = 'pending'
         WHERE id = ?`,
        endTime,
        duration,
        id
      );

      // Se for foco e tiver task_id, incrementar pomodoros
      if (session.type === 'focus' && session.task_id) {
        await this.tasksService.incrementCompletedPomodoros(session.task_id);
      }

      // Tentar sincronizar
      await this.syncService.syncSession(id);
    } catch (error) {
      console.error('Error completing pomodoro session:', error);
      throw error;
    }
  }

  /**
   * Cancela uma sessão pomodoro
   */
  async cancelSession(id: number): Promise<void> {
    try {
      const session = this.getSession(id);
      if (!session) {
        throw new Error(`Session ${id} not found`);
      }

      // Verificar se já foi completada
      if (session.status === 'completed') {
        throw new Error('Cannot cancel a completed session');
      }

      const endedAt = new Date().toISOString();
      const duration = this.calculateDuration(session.started_at, endedAt);

      db.runSync(
        `UPDATE pomodoro_sessions 
         SET ended_at = ?, duration_seconds = ?, status = 'cancelled',
             sync_status = 'pending'
         WHERE id = ?`,
        endedAt,
        duration,
        id
      );

      await this.syncService.syncSession(id);
    } catch (error) {
      console.error('Error cancelling pomodoro session:', error);
      throw error;
    }
  }

  /**
   * Interrompe uma sessão pomodoro
   */
  async interruptSession(id: number): Promise<void> {
    try {
      const session = this.getSession(id);
      if (!session) {
        throw new Error(`Session ${id} not found`);
      }

      if (session.status === 'completed') {
        throw new Error('Cannot interrupt a completed session');
      }

      const endedAt = new Date().toISOString();
      const duration = this.calculateDuration(session.started_at, endedAt);

      db.runSync(
        `UPDATE pomodoro_sessions 
         SET ended_at = ?, duration_seconds = ?, status = 'interrupted',
             sync_status = 'pending'
         WHERE id = ?`,
        endedAt,
        duration,
        id
      );

      await this.syncService.syncSession(id);
    } catch (error) {
      console.error('Error interrupting pomodoro session:', error);
      throw error;
    }
  }

  /**
   * Busca uma sessão específica
   */
  getSession(id: number): PomodoroSession | null {
    try {
      const result = db.getAllSync(
        `SELECT * FROM pomodoro_sessions WHERE id = ?`,
        id
      ) as any[];
      return result && result[0] ? result[0] : null;
    } catch (error) {
      console.error('Error fetching session:', error);
      return null;
    }
  }

  /**
   * Busca sessão por remote_id
   */
  getSessionByRemoteId(remoteId: string): PomodoroSession | null {
    try {
      const result = db.getAllSync(
        `SELECT * FROM pomodoro_sessions WHERE remote_id = ?`,
        remoteId
      ) as any[];
      return result && result[0] ? result[0] : null;
    } catch (error) {
      console.error('Error fetching session by remote_id:', error);
      return null;
    }
  }

  /**
   * Busca todas as sessões de um usuário
   */
  getSessions(userId: string): PomodoroSession[] {
    try {
      const result = db.getAllSync(
        `SELECT * FROM pomodoro_sessions 
         WHERE user_id = ? 
         ORDER BY started_at DESC`,
        userId
      ) as any[];
      return result || [];
    } catch (error) {
      console.error('Error fetching sessions:', error);
      return [];
    }
  }

  /**
   * Busca sessões de uma task específica
   */
  getSessionsByTask(taskId: number): PomodoroSession[] {
    try {
      const result = db.getAllSync(
        `SELECT * FROM pomodoro_sessions 
         WHERE task_id = ? 
         ORDER BY started_at DESC`,
        taskId
      ) as any[];
      return result || [];
    } catch (error) {
      console.error('Error fetching sessions by task:', error);
      return [];
    }
  }

  /**
   * Busca sessões do dia
   */
  getTodaySessions(userId: string): PomodoroSession[] {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const result = db.getAllSync(
        `SELECT * FROM pomodoro_sessions 
         WHERE user_id = ? 
           AND started_at >= ? 
           AND started_at < ?
         ORDER BY started_at DESC`,
        userId,
        today.toISOString(),
        tomorrow.toISOString()
      ) as any[];
      return result || [];
    } catch (error) {
      console.error('Error fetching today sessions:', error);
      return [];
    }
  }

  /**
   * Busca sessões por status
   */
  getSessionsByStatus(userId: string, status: PomodoroSession['status']): PomodoroSession[] {
    try {
      const result = db.getAllSync(
        `SELECT * FROM pomodoro_sessions 
         WHERE user_id = ? AND status = ?
         ORDER BY started_at DESC`,
        userId,
        status
      ) as any[];
      return result || [];
    } catch (error) {
      console.error('Error fetching sessions by status:', error);
      return [];
    }
  }

  /**
   * Busca sessões por tipo
   */
  getSessionsByType(userId: string, type: PomodoroSession['type']): PomodoroSession[] {
    try {
      const result = db.getAllSync(
        `SELECT * FROM pomodoro_sessions 
         WHERE user_id = ? AND type = ?
         ORDER BY started_at DESC`,
        userId,
        type
      ) as any[];
      return result || [];
    } catch (error) {
      console.error('Error fetching sessions by type:', error);
      return [];
    }
  }

  /**
   * Busca sessões com sincronização pendente
   */
  getPendingSessions(): PomodoroSession[] {
    try {
      const result = db.getAllSync(
        `SELECT * FROM pomodoro_sessions 
         WHERE sync_status IN ('pending', 'conflict')
         ORDER BY started_at DESC`
      ) as any[];
      return result || [];
    } catch (error) {
      console.error('Error fetching pending sessions:', error);
      return [];
    }
  }

  /**
   * Busca sessões com conflito
   */
  getConflictSessions(): PomodoroSession[] {
    try {
      const result = db.getAllSync(
        `SELECT * FROM pomodoro_sessions 
         WHERE sync_status = 'conflict'`
      ) as any[];
      return result || [];
    } catch (error) {
      console.error('Error fetching conflict sessions:', error);
      return [];
    }
  }

  /**
   * Resolve conflito manualmente (escolher versão local ou remota)
   */
  resolveConflict(id: number, useLocal: boolean): void {
    try {
      const session = this.getSession(id);
      if (!session) {
        throw new Error(`Session ${id} not found`);
      }

      if (useLocal) {
        // Forçar envio da versão local
        db.runSync(
          `UPDATE pomodoro_sessions SET sync_status = 'pending' WHERE id = ?`,
          id
        );
        // Disparar sincronização em background
        (async () => {
          try {
            await this.syncService.syncSession(id);
          } catch (error) {
            console.error('Failed to sync session after conflict resolution:', error);
          }
        })();
      } else {
        // Usar versão remota (baixar novamente)
        if (session.remote_id) {
          supabase
            .from('pomodoro_sessions')
            .select('*')
            .eq('id', session.remote_id)
            .single()
            .then(({ data, error }) => {
              if (error) throw error;
              if (data) {
                db.runSync(
                  `UPDATE pomodoro_sessions 
                   SET task_id = ?, started_at = ?, ended_at = ?,
                       duration_seconds = ?, type = ?, status = ?,
                       sync_status = 'synced'
                   WHERE id = ?`,
                  data.task_id,
                  data.started_at,
                  data.ended_at,
                  data.duration_seconds,
                  data.type,
                  data.status,
                  id
                );
              }
            })
        }
      }
    } catch (error) {
      console.error('Error resolving conflict:', error);
      throw error;
    }
  }

  /**
   * Calcula duração em segundos entre duas datas
   */
  private calculateDuration(startedAt: string, endedAt: string): number {
    const start = new Date(startedAt);
    const end = new Date(endedAt);
    return Math.floor((end.getTime() - start.getTime()) / 1000);
  }

  /**
   * Formata duração em segundos para string legível
   */
  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds}s`;
  }

  /**
   * Busca estatísticas das sessões
   */
  getStats(userId: string, days: number = 7): PomodoroStats {
    try {
      const sessions = this.getSessions(userId);
      const completedSessions = sessions.filter(s => s.status === 'completed');
      const focusSessions = completedSessions.filter(s => s.type === 'focus');

      // Estatísticas básicas
      const totalSessions = sessions.length;
      const completedCount = completedSessions.length;
      const totalFocusTime = focusSessions.reduce(
        (acc, s) => acc + (s.duration_seconds || 0),
        0
      );

      // Média de duração
      const avgDuration = completedSessions.length > 0
        ? completedSessions.reduce((acc, s) => acc + (s.duration_seconds || 0), 0) / completedSessions.length
        : 0;

      // Contagem por tipo
      const sessionsByType = {
        focus: sessions.filter(s => s.type === 'focus').length,
        short_break: sessions.filter(s => s.type === 'short_break').length,
        long_break: sessions.filter(s => s.type === 'long_break').length,
      };

      // Estatísticas diárias
      const dailyStats = this.getDailyStats(userId, days);

      return {
        totalSessions,
        completedSessions: completedCount,
        totalFocusTime: Math.round(totalFocusTime / 60), // converter para minutos
        averageSessionDuration: Math.round(avgDuration / 60),
        sessionsByType,
        dailyStats,
      };
    } catch (error) {
      console.error('Error fetching pomodoro stats:', error);
      return {
        totalSessions: 0,
        completedSessions: 0,
        totalFocusTime: 0,
        averageSessionDuration: 0,
        sessionsByType: { focus: 0, short_break: 0, long_break: 0 },
        dailyStats: [],
      };
    }
  }

  /**
   * Busca estatísticas diárias
   */
  private getDailyStats(userId: string, days: number): {
    date: string;
    sessions: number;
    focusTime: number;
  }[] {
    try {
      const stats: { date: string; sessions: number; focusTime: number }[] = [];
      const today = new Date();
      
      for (let i = days - 1; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        date.setHours(0, 0, 0, 0);
        
        const nextDate = new Date(date);
        nextDate.setDate(nextDate.getDate() + 1);

        const daySessions = db.getAllSync(
          `SELECT * FROM pomodoro_sessions 
           WHERE user_id = ? 
             AND status = 'completed'
             AND started_at >= ? 
             AND started_at < ?`,
          userId,
          date.toISOString(),
          nextDate.toISOString()
        ) as any[] || [];

        const focusSessions = daySessions.filter(s => s.type === 'focus');
        const focusTime = focusSessions.reduce(
          (acc, s) => acc + (s.duration_seconds || 0),
          0
        );

        stats.push({
          date: date.toISOString().split('T')[0],
          sessions: daySessions.length,
          focusTime: Math.round(focusTime / 60),
        });
      }

      return stats;
    } catch (error) {
      console.error('Error fetching daily stats:', error);
      return [];
    }
  }

  /**
   * Busca a última sessão ativa (iniciada mas não finalizada)
   */
  getActiveSession(userId: string): PomodoroSession | null {
    try {
      const result = db.getAllSync(
        `SELECT * FROM pomodoro_sessions 
         WHERE user_id = ? 
           AND status = 'in_progress'
         ORDER BY started_at DESC 
         LIMIT 1`,
        userId
      ) as any[];
      return result && result[0] ? result[0] : null;
    } catch (error) {
      console.error('Error fetching active session:', error);
      return null;
    }
  }

  /**
   * Verifica se há uma sessão ativa
   */
  hasActiveSession(userId: string): boolean {
    const activeSession = this.getActiveSession(userId);
    return activeSession !== null;
  }

  /**
   * Busca sessões de um período específico
   */
  getSessionsInPeriod(
    userId: string,
    startDate: Date,
    endDate: Date
  ): PomodoroSession[] {
    try {
      const result = db.getAllSync(
        `SELECT * FROM pomodoro_sessions 
         WHERE user_id = ? 
           AND started_at >= ? 
           AND started_at <= ?
         ORDER BY started_at DESC`,
        userId,
        startDate.toISOString(),
        endDate.toISOString()
      ) as any[];
      return result || [];
    } catch (error) {
      console.error('Error fetching sessions in period:', error);
      return [];
    }
  }

  /**
   * Busca sessões de hoje para uma task específica
   */
  getTodaySessionsByTask(taskId: number): PomodoroSession[] {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const result = db.getAllSync(
        `SELECT * FROM pomodoro_sessions 
         WHERE task_id = ? 
           AND started_at >= ? 
           AND started_at < ?
         ORDER BY started_at DESC`,
        taskId,
        today.toISOString(),
        tomorrow.toISOString()
      ) as any[];
      return result || [];
    } catch (error) {
      console.error('Error fetching today sessions by task:', error);
      return [];
    }
  }

  /**
   * Busca total de tempo gasto em uma task
   */
  getTotalTimeSpentOnTask(taskId: number): number {
    try {
      const sessions = db.getAllSync(
        `SELECT duration_seconds FROM pomodoro_sessions 
         WHERE task_id = ? AND status = 'completed' AND type = 'focus'`,
        taskId
      ) as any[] || [];

      const totalSeconds = sessions.reduce(
        (acc, s) => acc + (s.duration_seconds || 0),
        0
      );

      return Math.round(totalSeconds / 60); // retorna em minutos
    } catch (error) {
      console.error('Error calculating total time spent on task:', error);
      return 0;
    }
  }

  /**
   * Deleta uma sessão
   */
  async deleteSession(id: number): Promise<void> {
    try {
      const session = this.getSession(id);
      if (!session) {
        throw new Error(`Session ${id} not found`);
      }

      // Se tiver remote_id, deletar do Supabase também
      if (session.remote_id) {
        try {
          const { error } = await supabase
            .from('pomodoro_sessions')
            .delete()
            .eq('id', session.remote_id);

          if (error) {
            console.error('Error deleting from Supabase:', error);
            db.runSync(
              `UPDATE pomodoro_sessions SET sync_status = 'conflict' WHERE id = ?`,
              id
            );
            return;
          }
        } catch (error) {
          console.error('Error deleting from Supabase:', error);
          db.runSync(
            `UPDATE pomodoro_sessions SET sync_status = 'conflict' WHERE id = ?`,
            id
          );
          return;
        }
      }

      // Deletar localmente
      db.runSync(`DELETE FROM pomodoro_sessions WHERE id = ?`, id);
    } catch (error) {
      console.error('Error deleting session:', error);
      throw error;
    }
  }

  /**
   * Busca sessões de foco não completadas
   */
  getIncompleteFocusSessions(userId: string): PomodoroSession[] {
    try {
      const result = db.getAllSync(
        `SELECT * FROM pomodoro_sessions 
         WHERE user_id = ? 
           AND type = 'focus' 
           AND status IN ('in_progress', 'interrupted')
         ORDER BY started_at DESC`,
        userId
      ) as any[];
      return result || [];
    } catch (error) {
      console.error('Error fetching incomplete focus sessions:', error);
      return [];
    }
  }

  /**
   * Busca a última sessão completada
   */
  getLastCompletedSession(userId: string): PomodoroSession | null {
    try {
      const result = db.getAllSync(
        `SELECT * FROM pomodoro_sessions 
         WHERE user_id = ? AND status = 'completed'
         ORDER BY ended_at DESC 
         LIMIT 1`,
        userId
      ) as any[];
      return result && result[0] ? result[0] : null;
    } catch (error) {
      console.error('Error fetching last completed session:', error);
      return null;
    }
  }

  /**
   * Busca a sessão mais longa
   */
  getLongestSession(userId: string): PomodoroSession | null {
    try {
      const result = db.getAllSync(
        `SELECT * FROM pomodoro_sessions 
         WHERE user_id = ? AND status = 'completed'
         ORDER BY duration_seconds DESC 
         LIMIT 1`,
        userId
      ) as any[];
      return result && result[0] ? result[0] : null;
    } catch (error) {
      console.error('Error fetching longest session:', error);
      return null;
    }
  }

  /**
   * Busca streak de dias com sessões completadas
   */
  getStreak(userId: string): number {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      let streak = 0;
      let currentDate = new Date(today);
      
      while (true) {
        const dayStart = new Date(currentDate);
        dayStart.setHours(0, 0, 0, 0);
        
        const dayEnd = new Date(currentDate);
        dayEnd.setHours(23, 59, 59, 999);

        const sessions = db.getAllSync(
          `SELECT COUNT(*) as count FROM pomodoro_sessions 
           WHERE user_id = ? 
             AND status = 'completed'
             AND started_at >= ? 
             AND started_at <= ?`,
          userId,
          dayStart.toISOString(),
          dayEnd.toISOString()
        ) as any[];

        const count = sessions && sessions[0] ? sessions[0].count : 0;
        
        if (count > 0) {
          streak++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break;
        }
      }
      
      return streak;
    } catch (error) {
      console.error('Error calculating streak:', error);
      return 0;
    }
  }
}