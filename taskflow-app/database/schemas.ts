import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('taskflow.db');

export function initDatabase() {
    db.execSync(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT,
            display_name TEXT,
            avatar_url TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
    `);

    db.execSync(`
        CREATE TABLE IF NOT EXISTS tasks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            title TEXT NOT NULL,
            description TEXT,
            priority TEXT CHECK(priority IN ('low', 'medium', 'high')),
            estimated_pomodoros INTEGER,
            completed_pomodoros INTEGER DEFAULT 0,
            status TEXT CHECK(status IN ('pending', 'in_progress', 'done')) DEFAULT 'pending',
            due_date TEXT,
            completed_at DATETIME,
            sync_status TEXT CHECK(sync_status IN ('synced', 'pending', 'conflict')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME,
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    `);

    try {
        db.execSync(`ALTER TABLE tasks ADD COLUMN due_date TEXT`);
    } catch {}
    try {
        db.execSync(`ALTER TABLE tasks ADD COLUMN completed_pomodoros INTEGER DEFAULT 0`);
    } catch {}

    db.execSync(`
        CREATE TABLE IF NOT EXISTS pomodoro_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            task_id INTEGER,
            user_id INTEGER,
            started_at DATETIME,
            ended_at DATETIME,
            duration_seconds INTEGER,
            type TEXT CHECK(type IN ('focus', 'short_break', 'long_break')),
            status TEXT CHECK (status IN ('completed', 'cancelled', 'interrupted')),
            sync_status TEXT CHECK(sync_status IN ('synced', 'pending', 'conflict')),
            FOREIGN KEY (task_id) REFERENCES tasks(id),
            FOREIGN KEY (user_id) REFERENCES users(id)
        );
    `);
}