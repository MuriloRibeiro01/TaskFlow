import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { DevLoginDto } from './dto/dev-login.dto';

export interface JwtPayload {
  sub: number;
  email: string;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async devLogin({ email, displayName }: DevLoginDto) {
    // O índice único do Postgres diferencia maiúsculas; sem isso "A@x" e "a@x" virariam 2 contas.
    const normalized = email.trim().toLowerCase();
    const user = await this.prisma.user.upsert({
      where: { email: normalized },
      update: displayName ? { displayName } : {},
      create: { email: normalized, displayName },
    });
    const payload: JwtPayload = { sub: user.id, email: normalized };
    return { accessToken: await this.jwt.signAsync(payload), user };
  }
}
