import { INestApplication, ValidationPipe } from '@nestjs/common';

// Separado do main.ts para os testes e2e usarem a mesma configuração da produção.
export function configureApp(app: INestApplication) {
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // Auth é por Bearer token (sem cookies), então liberar qualquer origem não expõe credenciais.
  app.enableCors();
}
