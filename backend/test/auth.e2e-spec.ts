import request from 'supertest';
import { DEFAULT_PASSWORD, TestContext, createTestApp, createUser, loginAs, newAgent, resetDatabase } from './helpers/test-app';

describe('Autenticação e contas (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await createUser(ctx.prisma, { login: 'paula', role: 'EMPLOYEE' });
    await createUser(ctx.prisma, { login: 'helena', role: 'ADMIN', sectorName: 'TI' });
  });

  it('login válido grava cookie httpOnly e devolve o usuário sem hash de senha', async () => {
    const res = await newAgent(ctx.app).post('/api/auth/login').send({ login: 'Paula', password: DEFAULT_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ login: 'paula', role: 'EMPLOYEE' });
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
    const cookie = (res.headers['set-cookie'] as unknown as string[]).join(';');
    expect(cookie).toContain('sid=');
    expect(cookie.toLowerCase()).toContain('httponly');
    expect(cookie.toLowerCase()).toContain('samesite=lax');
  });

  it('guarda apenas o hash do token da sessão', async () => {
    const res = await newAgent(ctx.app).post('/api/auth/login').send({ login: 'paula', password: DEFAULT_PASSWORD });
    const token = /sid=([^;]+)/.exec((res.headers['set-cookie'] as unknown as string[]).join(';'))![1];
    const sessions = await ctx.prisma.session.findMany();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].tokenHash).not.toBe(token);
    expect(sessions[0].tokenHash).toHaveLength(64);
  });

  it('senha incorreta e usuário inexistente recebem a mesma resposta 401', async () => {
    const wrong = await newAgent(ctx.app).post('/api/auth/login').send({ login: 'paula', password: 'errada' });
    const missing = await newAgent(ctx.app).post('/api/auth/login').send({ login: 'ninguem', password: 'errada' });
    expect(wrong.status).toBe(401);
    expect(missing.status).toBe(401);
    expect(wrong.body.message).toBe(missing.body.message);
  });

  it('rota protegida sem sessão responde 401', async () => {
    const res = await newAgent(ctx.app).get('/api/tickets');
    expect(res.status).toBe(401);
  });

  it('mutação sem o cabeçalho X-Requested-With é bloqueada', async () => {
    const res = await request(ctx.app.getHttpServer())
      .post('/api/auth/login')
      .send({ login: 'paula', password: DEFAULT_PASSWORD });
    expect(res.status).toBe(403);
  });

  it('logout encerra a sessão', async () => {
    const agent = await loginAs(ctx.app, 'paula');
    expect((await agent.get('/api/auth/me')).status).toBe(200);
    expect((await agent.post('/api/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('AT-012: conta desativada perde a sessão atual e não consegue entrar de novo', async () => {
    const admin = await loginAs(ctx.app, 'helena');
    const paula = await loginAs(ctx.app, 'paula');
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { login: 'paula' } });

    const res = await admin.post(`/api/users/${user.id}/deactivate`);
    expect(res.status).toBe(200);
    expect(res.body.isActive).toBe(false);

    expect((await paula.get('/api/auth/me')).status).toBe(401);
    const retry = await newAgent(ctx.app).post('/api/auth/login').send({ login: 'paula', password: DEFAULT_PASSWORD });
    expect(retry.status).toBe(401);

    const stored = await ctx.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    expect(stored.deactivatedAt).not.toBeNull();
    expect(stored.deactivatedById).not.toBeNull();
  });

  it('conta reativada volta a autenticar', async () => {
    const admin = await loginAs(ctx.app, 'helena');
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { login: 'paula' } });
    await admin.post(`/api/users/${user.id}/deactivate`);
    await admin.post(`/api/users/${user.id}/reactivate`);
    const res = await newAgent(ctx.app).post('/api/auth/login').send({ login: 'paula', password: DEFAULT_PASSWORD });
    expect(res.status).toBe(200);
  });

  it('administrador não desativa a própria conta', async () => {
    const admin = await loginAs(ctx.app, 'helena');
    const me = await ctx.prisma.user.findUniqueOrThrow({ where: { login: 'helena' } });
    expect((await admin.post(`/api/users/${me.id}/deactivate`)).status).toBe(409);
  });

  it('troca de senha obrigatória bloqueia o restante da API até a troca', async () => {
    await createUser(ctx.prisma, { login: 'novato', role: 'EMPLOYEE', mustChangePassword: true });
    const agent = await loginAs(ctx.app, 'novato');

    const blocked = await agent.get('/api/tickets');
    expect(blocked.status).toBe(403);
    expect(blocked.body.message).toBe('PASSWORD_CHANGE_REQUIRED');
    expect((await agent.get('/api/auth/me')).status).toBe(200);

    const tooShort = await agent.post('/api/auth/change-password').send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'curta' });
    expect(tooShort.status).toBe(400);

    const changed = await agent
      .post('/api/auth/change-password')
      .send({ currentPassword: DEFAULT_PASSWORD, newPassword: 'nova-senha-muito-segura' });
    expect(changed.status).toBe(200);
    expect(changed.body.mustChangePassword).toBe(false);

    expect((await agent.get('/api/tickets')).status).toBe(200);
    const old = await newAgent(ctx.app).post('/api/auth/login').send({ login: 'novato', password: DEFAULT_PASSWORD });
    expect(old.status).toBe(401);
    const fresh = await newAgent(ctx.app).post('/api/auth/login').send({ login: 'novato', password: 'nova-senha-muito-segura' });
    expect(fresh.status).toBe(200);
  });

  it('redefinição pelo administrador exige nova troca e derruba as sessões do usuário', async () => {
    const admin = await loginAs(ctx.app, 'helena');
    const paula = await loginAs(ctx.app, 'paula');
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { login: 'paula' } });

    const res = await admin.post(`/api/users/${user.id}/reset-password`).send({});
    expect(res.status).toBe(200);
    expect(res.body.temporaryPassword.length).toBeGreaterThanOrEqual(10);

    expect((await paula.get('/api/auth/me')).status).toBe(401);
    const login = await newAgent(ctx.app)
      .post('/api/auth/login')
      .send({ login: 'paula', password: res.body.temporaryPassword });
    expect(login.status).toBe(200);
    expect(login.body.mustChangePassword).toBe(true);
  });

  it('endpoint de saúde é público e verifica o banco', async () => {
    const res = await newAgent(ctx.app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
