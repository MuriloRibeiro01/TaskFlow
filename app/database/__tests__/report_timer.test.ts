// Relatório em PDF (HTML gerado) e cálculo do tempo restante do timer pelo horário de término.
import { buildReportHtml } from '@/services/reportHtml';
import { phaseSchedule, secondsUntil } from '@/hooks/useTimerViewModel';
import { Task } from '@/types/task.types';

jest.mock('expo-haptics', () => ({}));
jest.mock('@/services/notificationService', () => ({}));
jest.mock('@/database/settings', () => ({}));
// O ViewModel do timer puxa o contexto de login (e com ele o NetInfo nativo); aqui só interessa a função pura
jest.mock('@/database/context/auth_context', () => ({}));
jest.mock('@/database/tasks', () => ({}));
jest.mock('@/database/pomodoro', () => ({}));

const task = (over: Partial<Task>): Task => ({
    id: 1, title: 'Tarefa', description: '', priority: 'medium',
    estimated_pomodoros: 1, completed_pomodoros: 0, status: 'pending',
    due_date: null, completed_at: null, created_at: '2026-11-20', updated_at: null,
    ...over,
});

describe('buildReportHtml', () => {
    const now = new Date('2026-11-24T12:00:00Z');

    it('Soma tarefas e pomodoros concluídos nos últimos 7 dias e ignora os mais antigos', () => {
        const html = buildReportHtml([
            task({ id: 1, status: 'done', completed_at: '2026-11-24T10:00:00Z', completed_pomodoros: 2 }),
            task({ id: 2, status: 'done', completed_at: '2026-11-18T10:00:00Z', completed_pomodoros: 3 }),
            task({ id: 3, status: 'done', completed_at: '2026-11-10T10:00:00Z', completed_pomodoros: 9 }),
            task({ id: 4, status: 'pending' }),
        ], 'Ana', now);

        expect(html).toContain('<b>2</b><small>TAREFAS CONCLUÍDAS');
        expect(html).toContain('<b>5</b><small>POMODOROS');
        expect(html).toContain('<b>1</b><small>TAREFAS EM ABERTO');
        expect(html).toContain('18/11/2026 a 24/11/2026');
    });

    it('Escapa o HTML dos títulos e do nome (texto digitado pelo usuário)', () => {
        const html = buildReportHtml(
            [task({ status: 'done', completed_at: '2026-11-24T10:00:00Z', title: '<script>x</script>' })],
            'A & B', now,
        );
        expect(html).not.toContain('<script>');
        expect(html).toContain('&lt;script&gt;x&lt;/script&gt;');
        expect(html).toContain('A &amp; B');
    });

    it('Sem tarefas concluídas mostra a mensagem de período vazio', () => {
        expect(buildReportHtml([], 'Ana', now)).toContain('Nenhuma tarefa concluída no período.');
    });
});

describe('secondsUntil', () => {
    it('Conta o que falta pelo horário de término, mesmo depois de muito tempo parado', () => {
        expect(secondsUntil(10_000, 0)).toBe(10);
        expect(secondsUntil(10_000, 9_001)).toBe(1);
        expect(secondsUntil(10_000, 60_000)).toBe(0);
    });
});

describe('phaseSchedule', () => {
    it('No foco com 2 pomodoros restantes: fim do foco, fim da pausa e fim do último foco (sem pausa depois)', () => {
        expect(phaseSchedule('focus', 600, 2, 1500, 300)).toEqual([
            { phase: 'focus', seconds: 600 },
            { phase: 'break', seconds: 900 },
            { phase: 'focus', seconds: 2400 },
        ]);
    });

    it('Na pausa: avisa o fim da pausa e depois o de cada foco que falta', () => {
        expect(phaseSchedule('break', 120, 1, 1500, 300)).toEqual([
            { phase: 'break', seconds: 120 },
            { phase: 'focus', seconds: 1620 },
        ]);
    });

    it('Sem pomodoros restantes não agenda nada', () => {
        expect(phaseSchedule('focus', 600, 0, 1500, 300)).toEqual([]);
    });
});
