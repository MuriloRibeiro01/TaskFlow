import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  const originalUrl = process.env.DATABASE_URL;

  afterEach(() => {
    process.env.DATABASE_URL = originalUrl;
  });

  it('lança erro claro quando DATABASE_URL não está definida', () => {
    delete process.env.DATABASE_URL;
    expect(() => new PrismaService()).toThrow('DATABASE_URL');
  });

  it('cria o client quando DATABASE_URL existe (sem conectar)', () => {
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
    const service = new PrismaService();
    expect(typeof service.user.count).toBe('function');
    expect(typeof service.task.findMany).toBe('function');
  });

  it('desconecta ao destruir o módulo', async () => {
    process.env.DATABASE_URL = 'postgresql://u:p@localhost:5432/db';
    const service = new PrismaService();
    const disconnect = jest.spyOn(service, '$disconnect').mockResolvedValue();
    await service.onModuleDestroy();
    expect(disconnect).toHaveBeenCalledTimes(1);
  });
});
