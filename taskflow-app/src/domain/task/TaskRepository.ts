import { Task } from './Task';

export interface TaskRepository {
  save(task: Task): Task;
  findById(id: number): Task | null;
  findByUserId(userId: string): Task[];
  update(task: Task): void;
  delete(id: number): void;
}
