import { createDailySummary } from '../daily_summary';
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabaseSync('taskflow.db');

describe('CreateDailySummary', () => {
    it('Cria um resumo semanal com tarefas concluídas', () => {

        const resumoCriado = createDailySummary();

        // Verifica se o retorno tem o formato esperado
        expect(resumoCriado).toHaveProperty('tasks');
        expect(resumoCriado).toHaveProperty('qtdTasks');

    })
})