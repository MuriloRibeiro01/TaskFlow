import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { ListTasksQuery } from './dto/list-tasks.query';
import { UpdateTaskDto } from './dto/update-task.dto';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  create(userId: number, dto: CreateTaskDto) {
    return this.prisma.task.create({ data: { ...dto, userId } });
  }

  findAll(userId: number, { status }: ListTasksQuery) {
    return this.prisma.task.findMany({
      where: { userId, ...(status && { status }) },
      orderBy: { createdAt: 'desc' },
    });
  }

  // 404 (e não 403) também para tarefa de outro usuário, para não revelar que o id existe.
  async findOne(userId: number, id: number) {
    const task = await this.prisma.task.findFirst({ where: { id, userId } });
    if (!task) throw new NotFoundException();
    return task;
  }

  async update(userId: number, id: number, dto: UpdateTaskDto) {
    const current = await this.findOne(userId, id);
    const data: UpdateTaskDto & { completedAt?: Date | null } = { ...dto };
    if (dto.status === 'done' && current.status !== 'done')
      data.completedAt = new Date();
    if (dto.status && dto.status !== 'done') data.completedAt = null;
    // O id já foi validado como do usuário acima, e o userId não pode ser alterado pelo DTO.
    return this.prisma.task.update({ where: { id }, data });
  }

  async remove(userId: number, id: number) {
    const { count } = await this.prisma.task.deleteMany({
      where: { id, userId },
    });
    if (count === 0) throw new NotFoundException();
  }
}
