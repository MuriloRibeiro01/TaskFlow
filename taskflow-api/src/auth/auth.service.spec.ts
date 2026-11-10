import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService.devLogin', () => {
  const jwt = new JwtService({ secret: 'x'.repeat(32) });
  const user = {
    id: 7,
    email: 'teste@taskflow.dev',
    displayName: 'Teste',
    avatarUrl: null,
  };
  let upsert: jest.Mock;
  let service: AuthService;

  beforeEach(() => {
    upsert = jest.fn().mockResolvedValue(user);
    service = new AuthService(
      { user: { upsert } } as unknown as PrismaService,
      jwt,
    );
  });

  it('normaliza o email (trim + minúsculas) antes do upsert', async () => {
    await service.devLogin({ email: '  Teste@TaskFlow.DEV ' });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'teste@taskflow.dev' } }),
    );
  });

  it('não sobrescreve o displayName quando ele não é enviado', async () => {
    await service.devLogin({ email: 'teste@taskflow.dev' });
    expect(upsert.mock.calls[0][0].update).toEqual({});
  });

  it('atualiza o displayName quando enviado', async () => {
    await service.devLogin({
      email: 'teste@taskflow.dev',
      displayName: 'Novo',
    });
    expect(upsert.mock.calls[0][0].update).toEqual({ displayName: 'Novo' });
    expect(upsert.mock.calls[0][0].create).toEqual({
      email: 'teste@taskflow.dev',
      displayName: 'Novo',
    });
  });

  it('devolve o usuário e um JWT com sub = id do usuário', async () => {
    const result = await service.devLogin({ email: 'teste@taskflow.dev' });
    expect(result.user).toEqual(user);
    const payload = await jwt.verifyAsync(result.accessToken);
    expect(payload).toMatchObject({ sub: 7, email: 'teste@taskflow.dev' });
  });
});
