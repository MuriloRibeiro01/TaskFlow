import { Body, Controller, INestApplication, Post } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { IsInt, IsString } from 'class-validator';
import request from 'supertest';
import { App } from 'supertest/types';
import { configureApp } from './configure-app';

class ExemploDto {
  @IsString() title: string;
  @IsInt() pomodoros: number;
}

@Controller('exemplo')
class ExemploController {
  @Post()
  create(@Body() dto: ExemploDto) {
    return { isDto: dto instanceof ExemploDto, ...dto };
  }
}

describe('configureApp', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [ExemploController],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(() => app.close());

  it('aceita corpo válido e entrega o DTO tipado', () => {
    return request(app.getHttpServer())
      .post('/exemplo')
      .send({ title: 'Estudar', pomodoros: 2 })
      .expect(201)
      .expect({ isDto: true, title: 'Estudar', pomodoros: 2 });
  });

  it('rejeita campo inválido com 400', () => {
    return request(app.getHttpServer())
      .post('/exemplo')
      .send({ title: 'Estudar', pomodoros: 'dois' })
      .expect(400);
  });

  it('rejeita campo fora do DTO (ex.: userId) com 400', () => {
    return request(app.getHttpServer())
      .post('/exemplo')
      .send({ title: 'Estudar', pomodoros: 2, userId: 99 })
      .expect(400);
  });

  it('responde ao preflight de CORS', () => {
    return request(app.getHttpServer())
      .options('/exemplo')
      .set('Origin', 'http://localhost:8081')
      .set('Access-Control-Request-Method', 'POST')
      .expect(204)
      .expect('Access-Control-Allow-Origin', '*');
  });
});
