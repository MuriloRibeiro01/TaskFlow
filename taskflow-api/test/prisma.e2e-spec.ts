import { PrismaService } from '../src/prisma/prisma.service';

// Só leitura: não grava nada no banco.
describe('PrismaService (e2e, banco real)', () => {
  const prisma = new PrismaService();

  afterAll(() => prisma.onModuleDestroy());

  it('conecta no Postgres e consulta a tabela users', async () => {
    await expect(prisma.user.count()).resolves.toEqual(expect.any(Number));
  });
});
