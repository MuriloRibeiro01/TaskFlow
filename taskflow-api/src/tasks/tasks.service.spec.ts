import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TasksService } from './tasks.service';

const USER = 1;
const task = (over: Record<string, unknown> = {}) => ({
  id: 10,
  userId: USER,
  title: 'Estudar',
  status: 'pending',
  completedAt: null,
  ...over,
});

describe('TasksService', () => {
  let prisma: { task: Record<string, jest.Mock> };
  let service: TasksService;

  beforeEach(() => {
    prisma = {
      task: {
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 10, ...data }),
          ),
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(task()),
        update: jest
          .fn()
          .mockImplementation(({ data }) => Promise.resolve(task(data))),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    service = new TasksService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('grava a tarefa com o userId do token', async () => {
      await service.create(USER, { title: 'Estudar' });
      expect(prisma.task.create).toHaveBeenCalledWith({
        data: { title: 'Estudar', userId: USER },
      });
    });
  });

  describe('findAll', () => {
    it('filtra pelo usuário e ordena da mais nova para a mais antiga', async () => {
      await service.findAll(USER, {});
      expect(prisma.task.findMany).toHaveBeenCalledWith({
        where: { userId: USER },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('aplica o filtro de status quando enviado', async () => {
      await service.findAll(USER, { status: 'done' });
      expect(prisma.task.findMany.mock.calls[0][0].where).toEqual({
        userId: USER,
        status: 'done',
      });
    });
  });

  describe('findOne', () => {
    it('busca pelo id E pelo usuário (ownership)', async () => {
      await service.findOne(USER, 10);
      expect(prisma.task.findFirst).toHaveBeenCalledWith({
        where: { id: 10, userId: USER },
      });
    });

    it('lança 404 quando a tarefa não existe ou é de outro usuário', async () => {
      prisma.task.findFirst.mockResolvedValue(null);
      await expect(service.findOne(USER, 10)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('update', () => {
    it('lança 404 e não atualiza tarefa de outro usuário', async () => {
      prisma.task.findFirst.mockResolvedValue(null);
      await expect(service.update(USER, 10, { title: 'x' })).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.task.update).not.toHaveBeenCalled();
    });

    it('preenche completedAt ao mudar o status para done', async () => {
      await service.update(USER, 10, { status: 'done' });
      const { data } = prisma.task.update.mock.calls[0][0];
      expect(data.completedAt).toBeInstanceOf(Date);
    });

    it('mantém o completedAt original quando a tarefa já estava done', async () => {
      const original = new Date('2026-10-01T10:00:00Z');
      prisma.task.findFirst.mockResolvedValue(
        task({ status: 'done', completedAt: original }),
      );
      await service.update(USER, 10, { status: 'done' });
      expect(
        prisma.task.update.mock.calls[0][0].data.completedAt,
      ).toBeUndefined();
    });

    it('limpa o completedAt ao sair de done', async () => {
      prisma.task.findFirst.mockResolvedValue(
        task({ status: 'done', completedAt: new Date() }),
      );
      await service.update(USER, 10, { status: 'pending' });
      expect(prisma.task.update.mock.calls[0][0].data.completedAt).toBeNull();
    });

    it('não mexe no completedAt quando o status não é enviado', async () => {
      await service.update(USER, 10, { title: 'Novo' });
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 10 },
        data: { title: 'Novo' },
      });
    });
  });

  describe('remove', () => {
    it('apaga só se a tarefa for do usuário (em uma única query)', async () => {
      await service.remove(USER, 10);
      expect(prisma.task.deleteMany).toHaveBeenCalledWith({
        where: { id: 10, userId: USER },
      });
    });

    it('lança 404 quando nada foi apagado', async () => {
      prisma.task.deleteMany.mockResolvedValue({ count: 0 });
      await expect(service.remove(USER, 10)).rejects.toThrow(NotFoundException);
    });
  });
});
