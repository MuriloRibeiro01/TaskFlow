import { SessionStatus } from './SessionStatus';
import { SessionType } from './SessionType';

export interface PomodoroSessionProps {
  id?: number;
  taskId: number;
  userId: string;
  type: SessionType;
  status: SessionStatus;
  durationSeconds: number;
  startedAt: string;
  endedAt: string | null;
}

export class PomodoroSession {
  private constructor(private readonly props: PomodoroSessionProps) {}

  static start(taskId: number, userId: string, durationSeconds: number, type: SessionType = 'focus'): PomodoroSession {
    return new PomodoroSession({ taskId, userId, type, status: 'running', durationSeconds, startedAt: new Date().toISOString(), endedAt: null });
  }

  static restore(props: PomodoroSessionProps): PomodoroSession {
    return new PomodoroSession(props);
  }

  finish(): PomodoroSession {
    if (this.props.status !== 'running') throw new Error('Sessão não está em andamento');
    return new PomodoroSession({ ...this.props, status: 'completed', endedAt: new Date().toISOString() });
  }

  cancel(): PomodoroSession {
    return new PomodoroSession({ ...this.props, status: 'cancelled', endedAt: new Date().toISOString() });
  }

  get id() { return this.props.id; }
  get taskId() { return this.props.taskId; }
  get userId() { return this.props.userId; }
  get type() { return this.props.type; }
  get status() { return this.props.status; }
  get durationSeconds() { return this.props.durationSeconds; }
  get startedAt() { return this.props.startedAt; }
  get endedAt() { return this.props.endedAt; }
}
