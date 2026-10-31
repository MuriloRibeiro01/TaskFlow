import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

// Grava no banco real: usa um email único e apaga o próprio usuário no final.
describe('Auth (e2e)', () => {
  const email = `e2e-${Date.now()}@taskflow.test`;
  let app: INestApplication<App>;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  beforeEach(() => {
    process.env.ENABLE_DEV_LOGIN = 'true';
  });

  const http = () => request(app.getHttpServer());

  it('POST /auth/dev-login responde 404 com a flag desligada', async () => {
    process.env.ENABLE_DEV_LOGIN = 'false';
    await http().post('/auth/dev-login').send({ email }).expect(404);
    expect(await prisma.user.count({ where: { email } })).toBe(0);
  });

  it('POST /auth/dev-login rejeita email inválido e campos extras', async () => {
    await http()
      .post('/auth/dev-login')
      .send({ email: 'nao-e-email' })
      .expect(400);
    await http().post('/auth/dev-login').send({ email, id: 1 }).expect(400);
  });

  it('login → token → GET /users/me devolve o próprio usuário', async () => {
    const login = await http()
      .post('/auth/dev-login')
      .send({ email, displayName: 'E2E' })
      .expect(200);
    expect(login.body.user).toMatchObject({ email, displayName: 'E2E' });

    const me = await http()
      .get('/users/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200);
    expect(me.body).toEqual(login.body.user);
  });

  it('login repetido reaproveita o mesmo usuário (sem duplicar)', async () => {
    const a = await http().post('/auth/dev-login').send({ email }).expect(200);
    const b = await http()
      .post('/auth/dev-login')
      .send({ email: email.toUpperCase() })
      .expect(200);
    expect(b.body.user.id).toBe(a.body.user.id);
    expect(b.body.user.displayName).toBe('E2E');
    expect(await prisma.user.count({ where: { email } })).toBe(1);
  });

  it('GET /users/me sem token ou com token inválido responde 401', async () => {
    await http().get('/users/me').expect(401);
    await http()
      .get('/users/me')
      .set('Authorization', 'Bearer abc.def.ghi')
      .expect(401);
  });
});
