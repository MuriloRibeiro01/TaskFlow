import { Priority } from './Priority';
import { TaskStatus } from './TaskStatus';

export interface TaskProps {
  id?: number;
  remoteId?: string | null;
  title: string;
  description: string;
  priority: Priority;
  status: TaskStatus;
  estimatedPomodoros: number;
  completedPomodoros: number;
  dueDate: string | null;
  quadrant?: string | null;
  userId: string;
  createdAt: string;
  completedAt: string | null;
  updatedAt: string | null;
}

export class Task {
  private constructor(private readonly props: TaskProps) {}

  static create(props: Omit<TaskProps, 'status' | 'completedPomodoros' | 'createdAt' | 'completedAt' | 'updatedAt'>): Task {
    if (!props.title.trim()) throw new Error('Título obrigatório');
    if (props.estimatedPomodoros < 1) throw new Error('Estimativa deve ser >= 1');
    return new Task({
      ...props,
      status: 'pending',
      completedPomodoros: 0,
      createdAt: new Date().toISOString(),
      completedAt: null,
      updatedAt: null,
    });
  }

  static restore(props: TaskProps): Task {
    return new Task(props);
  }

  complete(): Task {
    if (this.props.status === 'done') throw new Error('Tarefa já concluída');
    return new Task({ ...this.props, status: 'done', completedAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
  }

  reopen(): Task {
    if (this.props.status !== 'done') throw new Error('Tarefa não está concluída');
    return new Task({ ...this.props, status: 'pending', completedAt: null, updatedAt: new Date().toISOString() });
  }

  incrementPomodoro(): Task {
    return new Task({ ...this.props, completedPomodoros: this.props.completedPomodoros + 1, updatedAt: new Date().toISOString() });
  }

  get id() { return this.props.id; }
  get title() { return this.props.title; }
  get description() { return this.props.description; }
  get priority() { return this.props.priority; }
  get status() { return this.props.status; }
  get estimatedPomodoros() { return this.props.estimatedPomodoros; }
  get completedPomodoros() { return this.props.completedPomodoros; }
  get dueDate() { return this.props.dueDate; }
  get userId() { return this.props.userId; }
  get createdAt() { return this.props.createdAt; }
  get completedAt() { return this.props.completedAt; }
  get updatedAt() { return this.props.updatedAt; }
  get remoteId() { return this.props.remoteId; }
  get quadrant() { return this.props.quadrant; }
}
