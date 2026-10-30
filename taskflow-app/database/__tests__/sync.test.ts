// TDD do SyncService apontado para a API Spring (push primeiro, depois pull)

import { SyncService } from '../sync/sync.service';
import { api, ApiError } from '../api/client';
import { db } from '../schemas';

jest.mock('../services/network.service', () => ({ NetworkService: class { isConnected = true; } }));
jest.mock('../api/client', () => ({
    api: jest.fn(),
    getSession: jest.fn().mockResolvedValue({ accessToken: 't', user: { id: '42' } }),
    ApiError: class ApiError extends Error { status: number; constructor(status: number) { super(String(status)); this.status = status; } },
}));
jest.mock('../schemas', () => ({
    db: { runSync: jest.fn(), getAllSync: jest.fn(), execSync: jest.fn() },
}));

const apiMock = api as jest.Mock;
const getAllSync = db.getAllSync as jest.Mock;
const runSync = db.runSync as jest.Mock;

// getAllSync responde conforme o trecho do SQL
function tabelas(rows: Record<string, any[]>) {
    getAllSync.mockImplementation((sql: string) => {
        for (const [trecho, linhas] of Object.entries(rows)) if (sql.includes(trecho)) return linhas;
        return [];
    });
}

const tarefaRemota = {
    id: 7, title: 'Remota', description: null, priority: 'medium', estimatedPomodoros: 1, completedPomodoros: 0,
    status: 'pending', completedAt: null, dueDate: null, quadrant: null,
    createdAt: '2026-10-01T10:00:00Z', updatedAt: '2026-10-02T10:00:00Z',
};

beforeEach(() => {
    jest.clearAllMocks();
    apiMock.mockResolvedValue([]);
    tabelas({});
});

describe('envio de tarefas', () => {
    it('Cria na API a tarefa pendente sem remote_id e grava o id do servidor', async () => {
        tabelas({ "FROM tasks \n         WHERE sync_status": [{ id: 1, title: 'Nova', status: 'pending', completed_pomodoros: 0, priority: 'high' }] });
        apiMock.mockImplementation(async (method: string, path: string) =>
            method === 'POST' && path === '/tasks' ? { ...tarefaRemota, id: 21, title: 'Nova' } : []);

        const result = await new SyncService().syncAll();

        expect(apiMock).toHaveBeenCalledWith('POST', '/tasks', expect.objectContaining({ title: 'Nova', priority: 'high' }));
        expect(runSync).toHaveBeenCalledWith(expect.stringContaining('remote_id = ?'), '21', '2026-10-02T10:00:00Z', 1);
        expect(result.tasksSynced).toBe(1);
        expect(result.errors).toEqual([]);
    });

    it('Atualiza com PATCH quando o remote_id é um id da API', async () => {
        tabelas({ "FROM tasks \n         WHERE sync_status": [{ id: 1, remote_id: '7', title: 'Editada', status: 'pending', completed_pomodoros: 0 }] });
        apiMock.mockResolvedValue({ ...tarefaRemota });

        await new SyncService().syncAll();

        expect(apiMock).toHaveBeenCalledWith('PATCH', '/tasks/7', expect.objectContaining({ title: 'Editada', status: 'pending' }));
    });

    it('Cria de novo a tarefa cujo remote_id é UUID antigo do Supabase', async () => {
        tabelas({ "FROM tasks \n         WHERE sync_status": [{ id: 1, remote_id: '3f2a-aaaa-uuid', title: 'Antiga', status: 'pending', completed_pomodoros: 0 }] });
        apiMock.mockResolvedValue({ ...tarefaRemota, id: 30 });

        await new SyncService().syncAll();

        expect(apiMock).toHaveBeenCalledWith('POST', '/tasks', expect.anything());
        expect(apiMock).not.toHaveBeenCalledWith('PATCH', expect.stringContaining('3f2a'), expect.anything());
    });

    it('Tarefa criada já concluída recebe um PATCH com o status, e o remote_id é salvo antes dele', async () => {
        tabelas({ "FROM tasks \n         WHERE sync_status": [{ id: 1, title: 'Feita', status: 'done', completed_pomodoros: 2 }] });
        apiMock.mockImplementation(async (method: string) => ({ ...tarefaRemota, id: 40 }));

        await new SyncService().syncAll();

        const chamadas = apiMock.mock.calls.filter(c => c[0] !== 'GET').map(c => `${c[0]} ${c[1]}`);
        expect(chamadas).toEqual(['POST /tasks', 'PATCH /tasks/40']);
        expect(apiMock).toHaveBeenCalledWith('PATCH', '/tasks/40', expect.objectContaining({ status: 'done', completedPomodoros: 2 }));
    });

    it('Falha de uma tarefa não impede as outras e fica registrada nos erros', async () => {
        tabelas({ "FROM tasks \n         WHERE sync_status": [
            { id: 1, title: 'Ruim', status: 'pending', completed_pomodoros: 0 },
            { id: 2, title: 'Boa', status: 'pending', completed_pomodoros: 0 },
        ] });
        apiMock.mockImplementation(async (method: string, path: string, body: any) => {
            if (method === 'POST' && body?.title === 'Ruim') throw new ApiError(400);
            return method === 'POST' ? { ...tarefaRemota, id: 50 } : [];
        });

        const result = await new SyncService().syncAll();

        expect(result.tasksSynced).toBe(1);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]).toContain('task 1');
    });
});

describe('download de tarefas', () => {
    it('Insere localmente a tarefa remota desconhecida, do usuário logado', async () => {
        apiMock.mockImplementation(async (_m: string, path: string) => (path === '/tasks' ? [tarefaRemota] : []));

        await new SyncService().syncAll();

        expect(runSync).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO tasks'),
            '7', '42', 'Remota', null, 'medium', 1, 0, 'pending', null, null, null,
            '2026-10-01T10:00:00Z', '2026-10-02T10:00:00Z');
    });

    it('Não sobrescreve tarefa local pendente', async () => {
        tabelas({ 'FROM tasks WHERE remote_id': [{ id: 1, remote_id: '7', sync_status: 'pending', updated_at: '2020-01-01 00:00:00' }] });
        apiMock.mockImplementation(async (_m: string, path: string) => (path === '/tasks' ? [tarefaRemota] : []));

        await new SyncService().syncAll();

        expect(runSync.mock.calls.some(c => String(c[0]).includes('UPDATE tasks SET title'))).toBe(false);
        expect(runSync.mock.calls.some(c => String(c[0]).includes('INSERT INTO tasks'))).toBe(false);
    });

    it('Atualiza a tarefa local sincronizada quando a remota é mais nova', async () => {
        tabelas({ 'FROM tasks WHERE remote_id': [{ id: 1, remote_id: '7', sync_status: 'synced', updated_at: '2026-10-01 10:00:00' }] });
        apiMock.mockImplementation(async (_m: string, path: string) => (path === '/tasks' ? [tarefaRemota] : []));

        await new SyncService().syncAll();

        expect(runSync.mock.calls.some(c => String(c[0]).includes('UPDATE tasks SET title') && c.includes(1))).toBe(true);
    });
});

describe('sessões', () => {
    it('Envia a sessão com o id da tarefa no servidor', async () => {
        tabelas({
            "FROM pomodoro_sessions \n         WHERE sync_status": [{
                id: 3, task_id: 1, started_at: '2026-10-01 10:00:00', ended_at: '2026-10-01 10:25:00',
                duration_seconds: 1500, type: 'focus', status: 'completed',
            }],
            'SELECT remote_id FROM tasks WHERE id': [{ remote_id: '9' }],
        });
        apiMock.mockImplementation(async (method: string, path: string) =>
            method === 'POST' && path === '/sessions' ? { id: 60 } : []);

        const result = await new SyncService().syncAll();

        expect(apiMock).toHaveBeenCalledWith('POST', '/sessions', expect.objectContaining({ taskId: 9, durationSeconds: 1500 }));
        expect(runSync).toHaveBeenCalledWith(expect.stringContaining('UPDATE pomodoro_sessions'), '60', 3);
        expect(result.sessionsSynced).toBe(1);
    });

    it('Não envia a sessão enquanto a tarefa dela não foi sincronizada', async () => {
        tabelas({
            "FROM pomodoro_sessions \n         WHERE sync_status": [{ id: 3, task_id: 1, started_at: '2026-10-01 10:00:00', type: 'focus', status: 'completed' }],
            'SELECT remote_id FROM tasks WHERE id': [{ remote_id: null }],
        });

        const result = await new SyncService().syncAll();

        expect(apiMock).not.toHaveBeenCalledWith('POST', '/sessions', expect.anything());
        expect(result.errors[0]).toContain('session 3');
    });
});

describe('deleções e legado', () => {
    it('Apaga na API o que foi apagado localmente e limpa o registro; 404 conta como feito', async () => {
        tabelas({ 'FROM pending_deletes': [{ kind: 'task', remote_id: '5' }, { kind: 'task', remote_id: '6' }] });
        apiMock.mockImplementation(async (method: string, path: string) => {
            if (method === 'DELETE' && path === '/tasks/6') throw new ApiError(404);
            return [];
        });

        const result = await new SyncService().syncAll();

        expect(apiMock).toHaveBeenCalledWith('DELETE', '/tasks/5');
        expect(apiMock).toHaveBeenCalledWith('DELETE', '/tasks/6');
        expect(runSync).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM pending_deletes'), 'task', '5');
        expect(runSync).toHaveBeenCalledWith(expect.stringContaining('DELETE FROM pending_deletes'), 'task', '6');
        expect(result.errors).toEqual([]);
    });

    it('Marca como pendentes os registros com remote_id antigo (UUID do Supabase)', async () => {
        await new SyncService().syncAll();

        const sqls = runSync.mock.calls.map(c => String(c[0]));
        expect(sqls.some(s => s.includes('UPDATE tasks') && s.includes("GLOB '*[^0-9]*'"))).toBe(true);
        expect(sqls.some(s => s.includes('UPDATE pomodoro_sessions') && s.includes("GLOB '*[^0-9]*'"))).toBe(true);
    });
});
