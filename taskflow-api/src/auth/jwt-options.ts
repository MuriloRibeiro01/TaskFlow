import { JwtModuleOptions } from '@nestjs/jwt';

const MIN_SECRET_LENGTH = 32;

// Roda na inicialização: a API não sobe sem um segredo, em vez de assinar tokens com `undefined`.
export function jwtOptionsFactory(): JwtModuleOptions {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `JWT_SECRET ausente ou com menos de ${MIN_SECRET_LENGTH} caracteres`,
    );
  }
  return { secret, signOptions: { expiresIn: '1d' } };
}
