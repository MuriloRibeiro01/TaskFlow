import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthGuard } from './auth.guard';

function contextWith(headers: Record<string, string>) {
  const req: { headers: Record<string, string>; user?: unknown } = { headers };
  const ctx = {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
  return { ctx, req };
}

describe('AuthGuard', () => {
  const jwt = new JwtService({ secret: 'x'.repeat(32) });
  const guard = new AuthGuard(jwt);

  it('rejeita sem header Authorization', async () => {
    await expect(guard.canActivate(contextWith({}).ctx)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('rejeita esquema diferente de Bearer', async () => {
    const token = await jwt.signAsync({ sub: 1 });
    const { ctx } = contextWith({ authorization: `Basic ${token}` });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rejeita token assinado com outro segredo', async () => {
    const forged = await new JwtService({ secret: 'y'.repeat(32) }).signAsync({
      sub: 1,
    });
    const { ctx } = contextWith({ authorization: `Bearer ${forged}` });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('rejeita token expirado', async () => {
    const expired = await jwt.signAsync({ sub: 1 }, { expiresIn: -10 });
    const { ctx } = contextWith({ authorization: `Bearer ${expired}` });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('aceita token válido e coloca o payload em req.user', async () => {
    const token = await jwt.signAsync({ sub: 1, email: 'a@b.c' });
    const { ctx, req } = contextWith({ authorization: `Bearer ${token}` });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.user).toMatchObject({ sub: 1, email: 'a@b.c' });
  });
});
