export type PomodoroSession = {
    id: number;
    task_id: number;
    type: 'focus' | 'break';
    status: 'running' | 'completed' | 'cancelled';
    started_at: string;
    ended_at: string | null;
    duration_minutes: number;
}