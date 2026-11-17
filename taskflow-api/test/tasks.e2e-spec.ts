import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

// Grava no banco real: dois usuários com email único, apagados (com as tarefas) no final.
describe('Tasks (e2e)', () => {
  const stamp = Date.now();
  const emails = [
    `e2e-${stamp}-a@taskflow.test`,
    `e2e-${stamp}-b@taskflow.test`,
  ];
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;

  const http = () => request(app.getHttpServer());
  const login = async (email: string) =>
    (await http().post('/auth/dev-login').send({ email }).expect(200)).body
      .accessToken as string;

  beforeAll(async () => {
    process.env.ENABLE_DEV_LOGIN = 'true';
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    tokenA = await login(emails[0]);
    tokenB = await login(emails[1]);
  });

  afterAll(async () => {
    const where = { user: { email: { in: emails } } };
    await prisma.task.deleteMany({ where });
    await prisma.user.deleteMany({ where: { email: { in: emails } } });
    await app.close();
  });

  it('exige token em todas as rotas', async () => {
    await http().get('/tasks').expect(401);
    await http().post('/tasks').send({ title: 'x' }).expect(401);
    await http().get('/tasks/1').expect(401);
    await http().patch('/tasks/1').send({}).expect(401);
    await http().delete('/tasks/1').expect(401);
  });

  it('CRUD completo do próprio usuário', async () => {
    const auth = { Authorization: `Bearer ${tokenA}` };

    const created = await http()
      .post('/tasks')
      .set(auth)
      .send({
        title: 'Estudar Prisma',
        priority: 'high',
        estimatedPomodoros: 4,
      })
      .expect(201);
    expect(created.body).toMatchObject({
      title: 'Estudar Prisma',
      priority: 'high',
      status: 'pending',
      completedPomodoros: 0,
    });
    const id = created.body.id;

    const list = await http().get('/tasks').set(auth).expect(200);
    expect(list.body.map((t: { id: number }) => t.id)).toContain(id);

    await http().get(`/tasks/${id}`).set(auth).expect(200);

    const done = await http()
      .patch(`/tasks/${id}`)
      .set(auth)
      .send({ status: 'done' })
      .expect(200);
    expect(done.body.completedAt).not.toBeNull();

    const onlyDone = await http()
      .get('/tasks?status=done')
      .set(auth)
      .expect(200);
    expect(
      onlyDone.body.every((t: { status: string }) => t.status === 'done'),
    ).toBe(true);

    await http().delete(`/tasks/${id}`).set(auth).expect(204);
    await http().get(`/tasks/${id}`).set(auth).expect(404);
  });

  it('um usuário não vê, edita nem apaga tarefa de outro', async () => {
    const { body } = await http()
      .post('/tasks')
      .set({ Authorization: `Bearer ${tokenA}` })
      .send({ title: 'Privada' })
      .expect(201);
    const asB = { Authorization: `Bearer ${tokenB}` };

    await http().get(`/tasks/${body.id}`).set(asB).expect(404);
    await http()
      .patch(`/tasks/${body.id}`)
      .set(asB)
      .send({ title: 'invadida' })
      .expect(404);
    await http().delete(`/tasks/${body.id}`).set(asB).expect(404);
    const listB = await http().get('/tasks').set(asB).expect(200);
    expect(listB.body).toEqual([]);

    const still = await prisma.task.findUnique({ where: { id: body.id } });
    expect(still).toMatchObject({ title: 'Privada' });
  });

  it('valida corpo, query e id', async () => {
    const auth = { Authorization: `Bearer ${tokenA}` };
    await http().post('/tasks').set(auth).send({}).expect(400);
    await http().post('/tasks').set(auth).send({ title: '' }).expect(400);
    await http()
      .post('/tasks')
      .set(auth)
      .send({ title: 'x', priority: 'urgente' })
      .expect(400);
    await http()
      .post('/tasks')
      .set(auth)
      .send({ title: 'x', estimatedPomodoros: 5000 })
      .expect(400);
    // userId no corpo seria a forma de criar tarefa em nome de outra pessoa
    await http()
      .post('/tasks')
      .set(auth)
      .send({ title: 'x', userId: 999 })
      .expect(400);
    await http().get('/tasks?status=feito').set(auth).expect(400);
    await http().get('/tasks/abc').set(auth).expect(400);
    await http().get('/tasks/99999999999').set(auth).expect(400);
  });
});
