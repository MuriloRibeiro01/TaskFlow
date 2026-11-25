// Tradução entre as linhas do SQLite (snake_case) e o JSON da API (camelCase).

// O SQLite grava datetime('now') como 'AAAA-MM-DD HH:MM:SS' em UTC, sem fuso; o JS leria como hora local.
export function toIso(value?: string | null): string | undefined {
    if (!value) return undefined;
    const utc = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(' ', 'T')}Z` : value;
    const date = new Date(utc);
    return isNaN(date.getTime()) ? undefined : date.toISOString();
}

// ids da API são inteiros; UUID é resto do tempo em que o Supabase guardava os dados
export function isServerId(remoteId?: string | null): boolean {
    return !!remoteId && /^\d+$/.test(remoteId);
}

// JSON.stringify descarta undefined; a API (PATCH) trata campo ausente como "não alterar".
const orUndefined = <T>(v: T | null | undefined) => v ?? undefined;

export function taskBody(t: any) {
    return {
        title: t.title,
        description: orUndefined(t.description),
        priority: orUndefined(t.priority),
        estimatedPomodoros: orUndefined(t.estimated_pomodoros),
        dueDate: toIso(t.due_date),
        quadrant: orUndefined(t.quadrant),
    };
}

export function taskPatchBody(t: any) {
    return { ...taskBody(t), status: t.status, completedPomodoros: orUndefined(t.completed_pomodoros) };
}

export function taskFromApi(r: any) {
    return {
        remote_id: String(r.id),
        title: r.title,
        description: r.description,
        priority: r.priority,
        estimated_pomodoros: r.estimatedPomodoros,
        completed_pomodoros: r.completedPomodoros,
        status: r.status,
        completed_at: r.completedAt,
        due_date: r.dueDate,
        quadrant: r.quadrant,
        created_at: r.createdAt,
        updated_at: r.updatedAt,
    };
}

export function sessionBody(s: any, remoteTaskId?: number) {
    const startedAt = toIso(s.started_at);
    if (!startedAt) throw new Error('Sessão sem started_at válido');
    return {
        taskId: remoteTaskId,
        startedAt,
        endedAt: toIso(s.ended_at),
        durationSeconds: orUndefined(s.duration_seconds),
        type: s.type,
        status: s.status,
    };
}

export function sessionPatchBody(s: any) {
    return { endedAt: toIso(s.ended_at), durationSeconds: orUndefined(s.duration_seconds), status: s.status };
}

export function sessionFromApi(r: any, localTaskId: number | null) {
    return {
        remote_id: String(r.id),
        task_id: localTaskId,
        started_at: r.startedAt,
        ended_at: r.endedAt,
        duration_seconds: r.durationSeconds,
        type: r.type,
        status: r.status,
    };
}
