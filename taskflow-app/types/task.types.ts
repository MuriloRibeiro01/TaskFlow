export interface Task {
    id: number;
    title: string;
    description: string;
    priority: string;
    status: string;
    estimated_pomodoros: number | null;
    completed_pomodoros: number | null;
    due_date: string | null;
    created_at: string;
    completed_at: string | null;
    updated_at: string | null;
}