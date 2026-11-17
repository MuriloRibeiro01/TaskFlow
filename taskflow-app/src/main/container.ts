import { SQLiteTaskRepository } from '../infrastructure/sqlite/SQLiteTaskRepository';
import { CreateTask } from '../application/task/CreateTask';

// shortcut: singleton instanciado na primeira importação; reinicializar se trocar o banco
const taskRepository = new SQLiteTaskRepository();

export const container = {
  createTask: new CreateTask(taskRepository),
  taskRepository,
};
