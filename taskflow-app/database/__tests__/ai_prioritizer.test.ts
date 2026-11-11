import { requestSuggestions } from '../services/ai-prioritizer';
import { api, ApiError } from '../api/client';
import { Task } from '@/types/task.types';

jest.mock('../api/client', () => ({
  ...jest.requireActual('../api/client'),
  api: jest.fn(),
}));

const apiMock = api as jest.Mock;

const task = (id: number, remote_id: string | null): Task => ({
  id, remote_id, title: `T${id}`, description: '', priority: 'low', status: 'pending',
  estimated_pomodoros: null, completed_pomodoros: null, due_date: null,
  created_at: '2026-01-01', completed_at: null, updated_at: null,
});

beforeEach(() => jest.resetAllMocks());

describe('requestSuggestions', () => {
  it('manda os remote_id e devolve a resposta com ids locais', async () => {
    apiMock.mockResolvedValue({
      source: 'ai',
      suggestions: [{ taskId: 501, importance: 80, urgency: 30, quadrant: 'agendar', confidence: 77, justification: 'x' }],
    });

    const r = await requestSuggestions([task(1, '501')]);

    expect(apiMock).toHaveBeenCalledWith('POST', '/prioritization/suggestions', { taskIds: [501] });
    expect(r.source).toBe('ai');
    expect(r.skipped).toEqual([]);
    expect(r.suggestions).toEqual([
      { taskId: 1, importance: 80, urgency: 30, suggestedQuadrant: 'agendar', confidence: 77, justification: 'x' },
    ]);
  });

  it('deixa de fora tarefa sem remote_id numérico e avisa o chamador', async () => {
    apiMock.mockResolvedValue({ source: 'rules', suggestions: [] });

    const r = await requestSuggestions([task(1, null), task(2, 'abc'), task(3, '9')]);

    expect(apiMock).toHaveBeenCalledWith('POST', '/prioritization/suggestions', { taskIds: [9] });
    expect(r.skipped).toEqual([1, 2]);
  });

  it('sem nenhuma tarefa enviável não chama a API', async () => {
    const r = await requestSuggestions([task(1, null)]);

    expect(apiMock).not.toHaveBeenCalled();
    expect(r).toEqual({ source: 'rules', suggestions: [], skipped: [1] });
  });

  it('ignora taskId que o app não pediu', async () => {
    apiMock.mockResolvedValue({
      source: 'ai',
      suggestions: [{ taskId: 999, importance: 1, urgency: 1, quadrant: 'eliminar', confidence: 1, justification: '' }],
    });

    const r = await requestSuggestions([task(1, '501')]);

    expect(r.suggestions).toEqual([]);
  });

  it('propaga erro de rede e de status', async () => {
    apiMock.mockRejectedValueOnce(new Error('rede'));
    await expect(requestSuggestions([task(1, '5')])).rejects.toThrow('rede');

    apiMock.mockRejectedValueOnce(new ApiError(500));
    await expect(requestSuggestions([task(1, '5')])).rejects.toBeInstanceOf(ApiError);
  });
});
