import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService.findMe', () => {
  it('devolve o usuário do id informado', async () => {
    const user = { id: 1, email: 'a@b.c', displayName: null, avatarUrl: null };
    const findUnique = jest.fn().mockResolvedValue(user);
    const service = new UsersService({
      user: { findUnique },
    } as unknown as PrismaService);
    await expect(service.findMe(1)).resolves.toEqual(user);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('lança 404 quando o usuário do token não existe mais', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const service = new UsersService({
      user: { findUnique },
    } as unknown as PrismaService);
    await expect(service.findMe(1)).rejects.toThrow(NotFoundException);
  });
});
