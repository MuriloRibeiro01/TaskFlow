export interface Task {
    id: number,
    title: string;
    description: string;
    priority: string;
    status: string;
    created_at: string;
    completed_at: string | null;
    updated_at: string | null;
}