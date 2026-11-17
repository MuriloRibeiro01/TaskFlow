import { CreateTask } from '../CreateTask';
import { Task } from '../../../domain/task/Task';
import { TaskRepository } from '../../../domain/task/TaskRepository';

class InMemoryTaskRepository implements TaskRepository {
  private store: Task[] = [];
  private nextId = 1;

  save(task: Task): Task {
    const saved = Task.restore({ ...this.snapshotProps(task), id: this.nextId++ });
    this.store.push(saved);
    return saved;
  }

  findById(id: number) { return this.store.find((t) => t.id === id) ?? null; }
  findByUserId(userId: string) { return this.store.filter((t) => t.userId === userId); }
  update(task: Task) { this.store = this.store.map((t) => (t.id === task.id ? task : t)); }
  delete(id: number) { this.store = this.store.filter((t) => t.id !== id); }

  private snapshotProps(task: Task) {
    return {
      id: task.id, remoteId: task.remoteId, title: task.title, description: task.description,
      priority: task.priority, status: task.status, estimatedPomodoros: task.estimatedPomodoros,
      completedPomodoros: task.completedPomodoros, dueDate: task.dueDate, quadrant: task.quadrant,
      userId: task.userId, createdAt: task.createdAt, completedAt: task.completedAt, updatedAt: task.updatedAt,
    };
  }
}

describe('CreateTask use case', () => {
  let repo: InMemoryTaskRepository;
  let createTask: CreateTask;

  beforeEach(() => {
    repo = new InMemoryTaskRepository();
    createTask = new CreateTask(repo);
  });

  it('persiste e retorna tarefa com id', () => {
    const task = createTask.execute({
      title: 'Implementar CA', description: '', priority: 'high',
      estimatedPomodoros: 3, dueDate: null, userId: 'u1',
    });
    expect(task.id).toBeDefined();
    expect(task.status).toBe('pending');
    expect(repo.findById(task.id!)).not.toBeNull();
  });

  it('repassa erro de validação do domínio', () => {
    expect(() =>
      createTask.execute({ title: '', description: '', priority: 'low', estimatedPomodoros: 1, dueDate: null, userId: 'u1' })
    ).toThrow('Título obrigatório');
  });
});
