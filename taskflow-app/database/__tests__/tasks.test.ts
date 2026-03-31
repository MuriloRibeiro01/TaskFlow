// TDD das tasks

import { createTask } from "../tasks";

describe('CreateTask', () => {
    it('Cria uma tarefa e retorna ela com um ID', () => {

        const input = {
            title: 'Estudar',
            description: 'Estudar Java',
            priority: 'high'
        }

        const tarefaCriada = createTask(input);

        expect(tarefaCriada.id).toBeDefined();
        expect(tarefaCriada.title).toBe('Estudar');
        expect(tarefaCriada.priority).toBe('high');
        expect(tarefaCriada.status).toBe('pending');
    });
});