import { Task } from '../../domain/task/Task';
import { TaskRepository } from '../../domain/task/TaskRepository';
import { Priority } from '../../domain/task/Priority';

export interface CreateTaskDto {
  title: string;
  description: string;
  priority: Priority;
  estimatedPomodoros: number;
  dueDate: string | null;
  userId: string;
}

export class CreateTask {
  constructor(private readonly repo: TaskRepository) {}

  execute(dto: CreateTaskDto): Task {
    const task = Task.create({ ...dto, remoteId: null, quadrant: null });
    return this.repo.save(task);
  }
}
