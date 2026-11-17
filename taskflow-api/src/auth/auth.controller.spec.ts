import { NotFoundException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController.devLogin', () => {
  const original = process.env.ENABLE_DEV_LOGIN;
  const devLogin = jest.fn().mockResolvedValue({ accessToken: 't', user: {} });
  const controller = new AuthController({ devLogin } as unknown as AuthService);

  afterEach(() => {
    process.env.ENABLE_DEV_LOGIN = original;
    devLogin.mockClear();
  });

  it.each([undefined, '', 'false', '1', 'TRUE '])(
    'responde 404 quando ENABLE_DEV_LOGIN=%p',
    async (value) => {
      if (value === undefined) delete process.env.ENABLE_DEV_LOGIN;
      else process.env.ENABLE_DEV_LOGIN = value;
      await expect(controller.devLogin({ email: 'a@b.c' })).rejects.toThrow(
        NotFoundException,
      );
      expect(devLogin).not.toHaveBeenCalled();
    },
  );

  it('chama o service quando ENABLE_DEV_LOGIN=true', async () => {
    process.env.ENABLE_DEV_LOGIN = 'true';
    await controller.devLogin({ email: 'a@b.c' });
    expect(devLogin).toHaveBeenCalledWith({ email: 'a@b.c' });
  });
});
