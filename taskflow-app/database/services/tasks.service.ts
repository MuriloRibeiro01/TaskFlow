// services/tasks.service.ts
import { db } from '../schemas';
import { supabase } from '../supabase/supabase';
import { SyncService } from '../sync/sync.service';

export interface Task {
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

export interface CreateTaskDTO {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  estimated_pomodoros?: number;
  due_date?: string;
  user_id: string;
}

export interface UpdateTaskDTO {
  title?: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';
  estimated_pomodoros?: number;
  status?: 'pending' | 'in_progress' | 'done';
  due_date?: string;
  completed_at?: string;
}

export class TasksService {
  private syncService: SyncService;

  constructor() {
    this.syncService = new SyncService();
  }

  /**
   * Cria uma nova task localmente e tenta sincronizar
   */
  async createTask(data: CreateTaskDTO): Promise<number> {
    try {
      // Validar dados obrigatórios
      if (!data.title || !data.user_id) {
        throw new Error('Title and user_id are required');
      }

      // Inserir localmente com status 'pending'
      const result = db.runSync(
        `INSERT INTO tasks 
         (title, description, priority, estimated_pomodoros, 
          due_date, user_id, status, sync_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
        data.title,
        data.description || null,
        data.priority || 'medium',
        data.estimated_pomodoros || 1,
        data.due_date || null,
        data.user_id,
        'pending',
        new Date().toISOString(),
        new Date().toISOString()
      );

      const taskId = result.lastInsertRowId;

      // Tentar sincronizar imediatamente - CORRIGIDO
      try {
        await this.syncService.syncTask(taskId);
      } catch (error) {
        console.error('Failed to sync new task:', error);
      }

      return taskId;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  /**
   * Busca todas as tasks do usuário
   */
  getTasks(userId: string): Task[] {
    try {
      const result = db.getAllSync(
        `SELECT * FROM tasks 
         WHERE user_id = ? 
         ORDER BY 
           CASE 
             WHEN status = 'pending' THEN 1
             WHEN status = 'in_progress' THEN 2
             WHEN status = 'done' THEN 3
           END,
           due_date ASC,
           created_at DESC`,
        userId
      ) as any[];
      return result || [];
    } catch (error) {
      console.error('Error fetching tasks:', error);
      return [];
    }
  }

  /**
   * Busca tasks por status
   */
  getTasksByStatus(userId: string, status: Task['status']): Task[] {
    try {
      const result = db.getAllSync(
        `SELECT * FROM tasks 
         WHERE user_id = ? AND status = ?
         ORDER BY due_date ASC, created_at DESC`,
        userId,
        status
      ) as any[];
      return result || [];
    } catch (error) {
      console.error('Error fetching tasks by status:', error);
      return [];
    }
  }

  /**
   * Busca uma task específica
   */
  getTask(id: number): Task | null {
    try {
      const result = db.getAllSync(
        `SELECT * FROM tasks WHERE id = ?`,
        id
      ) as any[];
      return result && result[0] ? result[0] : null;
    } catch (error) {
      console.error('Error fetching task:', error);
      return null;
    }
  }

  /**
   * Busca task por remote_id
   */
  getTaskByRemoteId(remoteId: string): Task | null {
    try {
      const result = db.getAllSync(
        `SELECT * FROM tasks WHERE remote_id = ?`,
        remoteId
      ) as any[];
      return result && result[0] ? result[0] : null;
    } catch (error) {
      console.error('Error fetching task by remote_id:', error);
      return null;
    }
  }

  /**
   * Atualiza uma task
   */
  async updateTask(id: number, data: UpdateTaskDTO): Promise<void> {
    try {
      // Verificar se a task existe
      const existingTask = this.getTask(id);
      if (!existingTask) {
        throw new Error(`Task ${id} not found`);
      }

      // Construir query de atualização dinâmica
      const updates: string[] = [];
      const values: any[] = [];

      if (data.title !== undefined) {
        updates.push('title = ?');
        values.push(data.title);
      }
      if (data.description !== undefined) {
        updates.push('description = ?');
        values.push(data.description);
      }
      if (data.priority !== undefined) {
        updates.push('priority = ?');
        values.push(data.priority);
      }
      if (data.estimated_pomodoros !== undefined) {
        updates.push('estimated_pomodoros = ?');
        values.push(data.estimated_pomodoros);
      }
      if (data.status !== undefined) {
        updates.push('status = ?');
        values.push(data.status);
        
        // Se status for 'done', marcar completed_at
        if (data.status === 'done') {
          updates.push('completed_at = ?');
          values.push(new Date().toISOString());
        }
      }
      if (data.due_date !== undefined) {
        updates.push('due_date = ?');
        values.push(data.due_date);
      }

      // Sempre atualizar updated_at e sync_status
      updates.push('updated_at = ?');
      values.push(new Date().toISOString());
      updates.push('sync_status = ?');
      values.push('pending');

      // Adicionar id no final
      values.push(id);

      const query = `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`;
      db.runSync(query, ...values);

      // Tentar sincronizar
      await this.syncService.syncTask(id);
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }

  /**
   * Atualiza o status da task
   */
  async updateTaskStatus(id: number, status: Task['status']): Promise<void> {
    await this.updateTask(id, { status });
  }

  /**
   * Incrementa completed_pomodoros
   */
  async incrementCompletedPomodoros(id: number): Promise<void> {
    try {
      const task = this.getTask(id);
      if (!task) {
        throw new Error(`Task ${id} not found`);
      }

      const current = task.completed_pomodoros || 0;
      const estimated = task.estimated_pomodoros || 0;

      db.runSync(
        `UPDATE tasks 
         SET completed_pomodoros = ?, 
             updated_at = ?, 
             sync_status = 'pending'
         WHERE id = ?`,
        current + 1,
        new Date().toISOString(),
        id
      );

      // Se completou todos os pomodoros, marcar como done
      if (current + 1 >= estimated) {
        await this.updateTaskStatus(id, 'done');
      } else {
        await this.syncService.syncTask(id);
      }
    } catch (error) {
      console.error('Error incrementing pomodoros:', error);
      throw error;
    }
  }

  /**
   * Deleta uma task
   */
  async deleteTask(id: number): Promise<void> {
    try {
      const task = this.getTask(id);
      if (!task) {
        throw new Error(`Task ${id} not found`);
      }

      // Se tiver remote_id, deletar do Supabase também
      if (task.remote_id) {
        try {
          const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', task.remote_id);

          if (error) {
            console.error('Error deleting from Supabase:', error);
            // Marcar como conflito se não conseguir deletar
            db.runSync(
              `UPDATE tasks SET sync_status = 'conflict' WHERE id = ?`,
              id
            );
            return;
          }
        } catch (error) {
          console.error('Error deleting from Supabase:', error);
          db.runSync(
            `UPDATE tasks SET sync_status = 'conflict' WHERE id = ?`,
            id
          );
          return;
        }
      }

      // Deletar localmente
      db.runSync(`DELETE FROM tasks WHERE id = ?`, id);
    } catch (error) {
      console.error('Error deleting task:', error);
      throw error;
    }
  }

  /**
   * Busca tasks com sincronização pendente
   */
  getPendingTasks(): Task[] {
    try {
      const result = db.getAllSync(
        `SELECT * FROM tasks 
         WHERE sync_status IN ('pending', 'conflict')
         ORDER BY updated_at DESC`
      ) as any[];
      return result || [];
    } catch (error) {
      console.error('Error fetching pending tasks:', error);
      return [];
    }
  }

  /**
   * Busca tasks com conflito
   */
  getConflictTasks(): Task[] {
    try {
      const result = db.getAllSync(
        `SELECT * FROM tasks WHERE sync_status = 'conflict'`
      ) as any[];
      return result || [];
    } catch (error) {
      console.error('Error fetching conflict tasks:', error);
      return [];
    }
  }

  /**
   * Resolve conflito manualmente (escolher versão local ou remota)
   */
  resolveConflict(id: number, useLocal: boolean): void {
    try {
      const task = this.getTask(id);
      if (!task) {
        throw new Error(`Task ${id} not found`);
      }

      if (useLocal) {
        // Forçar envio da versão local
        db.runSync(
          `UPDATE tasks SET sync_status = 'pending' WHERE id = ?`,
          id
        );
        // Disparar sincronização em background
        (async () => {
          try {
            await this.syncService.syncTask(id);
          } catch (error) {
            console.error('Error syncing after conflict resolution:', error);
          }
        })();
      } else {
        // Usar versão remota (baixar novamente)
        if (task.remote_id) {
          supabase
            .from('tasks')
            .select('*')
            .eq('id', task.remote_id)
            .single()
            .then(({ data, error }) => {
              if (error) throw error;
              if (data) {
                db.runSync(
                  `UPDATE tasks 
                   SET title = ?, description = ?, priority = ?,
                       estimated_pomodoros = ?, completed_pomodoros = ?,
                       status = ?, due_date = ?, completed_at = ?,
                       updated_at = ?, sync_status = 'synced'
                   WHERE id = ?`,
                  data.title,
                  data.description,
                  data.priority,
                  data.estimated_pomodoros,
                  data.completed_pomodoros,
                  data.status,
                  data.due_date,
                  data.completed_at,
                  data.updated_at,
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
   * Busca tasks com data de vencimento próxima (próximos 7 dias)
   */
  getUpcomingTasks(userId: string): Task[] {
    try {
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);

      const result = db.getAllSync(
        `SELECT * FROM tasks 
         WHERE user_id = ? 
           AND status != 'done'
           AND due_date IS NOT NULL
           AND due_date BETWEEN ? AND ?
         ORDER BY due_date ASC`,
        userId,
        today.toISOString(),
        nextWeek.toISOString()
      ) as any[];
      return result || [];
    } catch (error) {
      console.error('Error fetching upcoming tasks:', error);
      return [];
    }
  }

  /**
   * Busca tasks atrasadas
   */
  getOverdueTasks(userId: string): Task[] {
    try {
      const today = new Date().toISOString();

      const result = db.getAllSync(
        `SELECT * FROM tasks 
         WHERE user_id = ? 
           AND status != 'done'
           AND due_date IS NOT NULL
           AND due_date < ?
         ORDER BY due_date ASC`,
        userId,
        today
      ) as any[];
      return result || [];
    } catch (error) {
      console.error('Error fetching overdue tasks:', error);
      return [];
    }
  }

  /**
   * Busca estatísticas das tasks
   */
  getTaskStats(userId: string): {
    total: number;
    pending: number;
    inProgress: number;
    done: number;
    completionRate: number;
  } {
    try {
      const result = db.getAllSync(
        `SELECT 
           COUNT(*) as total,
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
           SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as inProgress,
           SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as done
         FROM tasks 
         WHERE user_id = ?`,
        userId
      ) as any[];

      if (result && result[0]) {
        const stats = result[0];
        const total = stats.total || 0;
        const done = stats.done || 0;
        
        return {
          total,
          pending: stats.pending || 0,
          inProgress: stats.inProgress || 0,
          done,
          completionRate: total > 0 ? (done / total) * 100 : 0
        };
      }

      return {
        total: 0,
        pending: 0,
        inProgress: 0,
        done: 0,
        completionRate: 0
      };
    } catch (error) {
      console.error('Error fetching task stats:', error);
      return {
        total: 0,
        pending: 0,
        inProgress: 0,
        done: 0,
        completionRate: 0
      };
    }
  }

  /**
   * Busca tasks por prioridade
   */
  getTasksByPriority(userId: string, priority: Task['priority']): Task[] {
    try {
      const result = db.getAllSync(
        `SELECT * FROM tasks 
         WHERE user_id = ? AND priority = ?
         ORDER BY due_date ASC, created_at DESC`,
        userId,
        priority
      ) as any[];
      return result || [];
    } catch (error) {
      console.error('Error fetching tasks by priority:', error);
      return [];
    }
  }

  /**
   * Busca tasks com filtros avançados
   */
  searchTasks(userId: string, searchTerm: string): Task[] {
    try {
      const result = db.getAllSync(
        `SELECT * FROM tasks 
         WHERE user_id = ? 
           AND (title LIKE ? OR description LIKE ?)
         ORDER BY created_at DESC`,
        userId,
        `%${searchTerm}%`,
        `%${searchTerm}%`
      ) as any[];
      return result || [];
    } catch (error) {
      console.error('Error searching tasks:', error);
      return [];
    }
  }

  /**
   * Verifica se uma task pode ser deletada (não tem dependências)
   */
  canDeleteTask(id: number): boolean {
    try {
      // Verificar se há sessões pomodoro associadas
      const sessions = db.getAllSync(
        `SELECT COUNT(*) as count FROM pomodoro_sessions WHERE task_id = ?`,
        id
      ) as any[];
      
      const count = sessions && sessions[0] ? sessions[0].count : 0;
      return count === 0;
    } catch (error) {
      console.error('Error checking if task can be deleted:', error);
      return false;
    }
  }

  /**
   * Busca tasks com datas de vencimento agrupadas
   */
  getTasksGroupedByDueDate(userId: string): {
    today: Task[];
    tomorrow: Task[];
    thisWeek: Task[];
    later: Task[];
    overdue: Task[];
  } {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const nextWeek = new Date(today);
      nextWeek.setDate(nextWeek.getDate() + 7);

      const tasks = this.getTasks(userId);
      
      const result = {
        today: [] as Task[],
        tomorrow: [] as Task[],
        thisWeek: [] as Task[],
        later: [] as Task[],
        overdue: [] as Task[]
      };

      tasks.forEach(task => {
        if (!task.due_date || task.status === 'done') return;

        const dueDate = new Date(task.due_date);
        dueDate.setHours(0, 0, 0, 0);

        if (dueDate < today) {
          result.overdue.push(task);
        } else if (dueDate.getTime() === today.getTime()) {
          result.today.push(task);
        } else if (dueDate.getTime() === tomorrow.getTime()) {
          result.tomorrow.push(task);
        } else if (dueDate <= nextWeek) {
          result.thisWeek.push(task);
        } else {
          result.later.push(task);
        }
      });

      return result;
    } catch (error) {
      console.error('Error grouping tasks by due date:', error);
      return {
        today: [],
        tomorrow: [],
        thisWeek: [],
        later: [],
        overdue: []
      };
    }
  }
}