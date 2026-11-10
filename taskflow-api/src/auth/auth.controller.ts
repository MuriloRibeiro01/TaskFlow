import {
  Body,
  Controller,
  HttpCode,
  NotFoundException,
  Post,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { DevLoginDto } from './dto/dev-login.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  // Login sem prova de identidade: só existe com ENABLE_DEV_LOGIN=true (nunca em produção).
  @Post('dev-login')
  @HttpCode(200)
  async devLogin(@Body() dto: DevLoginDto) {
    if (process.env.ENABLE_DEV_LOGIN !== 'true') throw new NotFoundException();
    return this.auth.devLogin(dto);
  }
}
