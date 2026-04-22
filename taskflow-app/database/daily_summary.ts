// Resumo diário

import { Task } from '@/types/task.types';
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('taskflow.db');

export function createDailySummary() {
    const tasks = db.getAllSync<Task>(
        'SELECT * FROM tasks WHERE status = "done" AND date(completed_at) = date("now")'
    );

    const qtdTasks = tasks.length;

    return { tasks, qtdTasks };
} 