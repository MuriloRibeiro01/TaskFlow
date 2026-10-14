// Simula db com mock com valor "hardcoded"
// Se uma função de db. NÃO EXISTIR NESSE ARQUIVO, ela NÃO VAI RODAR.

const mockDb = {
    execSync: jest.fn(),
    runSync: jest.fn().mockReturnValue({ lastInsertRowId: 1, changes: 1 }),
    getFirstSync: jest.fn().mockReturnValue({
        id: 1,
        title: 'Estudar',
        description: 'Estudar Java',
        priority: 'high',
        status: 'pending',
        count: 4
    }),
    getAllSync: jest.fn().mockReturnValue([])
};

// Iguala valor da função com o mockDb que sempre retorna o mesmo valor
export const openDatabaseSync = jest.fn().mockReturnValue(mockDb);

