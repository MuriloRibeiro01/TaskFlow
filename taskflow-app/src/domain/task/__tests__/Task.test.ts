import { Task } from '../Task';

const BASE = {
  title: 'Estudar CA',
  description: 'Ler o doc de arquitetura',
  priority: 'high' as const,
  estimatedPomodoros: 2,
  dueDate: null,
  userId: 'user-1',
};

describe('Task.create', () => {
  it('cria tarefa com status pending e 0 pomodoros concluídos', () => {
    const task = Task.create(BASE);
    expect(task.status).toBe('pending');
    expect(task.completedPomodoros).toBe(0);
    expect(task.completedAt).toBeNull();
  });

  it('lança erro para título vazio', () => {
    expect(() => Task.create({ ...BASE, title: '  ' })).toThrow('Título obrigatório');
  });

  it('lança erro para estimativa < 1', () => {
    expect(() => Task.create({ ...BASE, estimatedPomodoros: 0 })).toThrow('Estimativa deve ser >= 1');
  });
});

describe('Task.complete / Task.reopen', () => {
  it('complete muda status para done e registra completedAt', () => {
    const task = Task.create(BASE).complete();
    expect(task.status).toBe('done');
    expect(task.completedAt).not.toBeNull();
  });

  it('complete duas vezes lança erro', () => {
    const done = Task.create(BASE).complete();
    expect(() => done.complete()).toThrow('Tarefa já concluída');
  });

  it('reopen restaura status para pending e limpa completedAt', () => {
    const task = Task.create(BASE).complete().reopen();
    expect(task.status).toBe('pending');
    expect(task.completedAt).toBeNull();
  });

  it('reopen em tarefa pending lança erro', () => {
    expect(() => Task.create(BASE).reopen()).toThrow('Tarefa não está concluída');
  });
});

describe('Task.incrementPomodoro', () => {
  it('incrementa completedPomodoros em 1', () => {
    const task = Task.create(BASE).incrementPomodoro();
    expect(task.completedPomodoros).toBe(1);
  });
});
