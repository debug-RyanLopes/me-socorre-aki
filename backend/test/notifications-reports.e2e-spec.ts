import {
  TestContext,
  createTestApp,
  createUser,
  loginAs,
  openTicket,
  resetDatabase,
  runDemoSeed,
} from './helpers/test-app';

describe('Notificações, regras de prioridade e relatórios (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  describe('com dados mínimos', () => {
    beforeEach(async () => {
      await resetDatabase(ctx.prisma);
      await createUser(ctx.prisma, { login: 'paula', role: 'EMPLOYEE' });
      await createUser(ctx.prisma, { login: 'carlos', role: 'EMPLOYEE', sectorName: 'RH' });
      await createUser(ctx.prisma, { login: 'marcos', role: 'TECHNICIAN', sectorName: 'TI' });
      await createUser(ctx.prisma, { login: 'helena', role: 'ADMIN', sectorName: 'TI' });
    });

    it('AT-015: resposta da TI gera notificação com contador, leitura e link para o chamado', async () => {
      const paula = await loginAs(ctx.app, 'paula');
      const marcos = await loginAs(ctx.app, 'marcos');
      const id = (await openTicket(paula)).body.id;

      expect((await paula.get('/api/notifications/unread-count')).body).toEqual({ count: 0 });
      await marcos.post(`/api/tickets/${id}/comments`).send({ body: 'Pode trazer o notebook?' });

      expect((await paula.get('/api/notifications/unread-count')).body).toEqual({ count: 1 });
      const list = (await paula.get('/api/notifications')).body;
      expect(list).toHaveLength(1);
      expect(list[0]).toMatchObject({ ticketId: id, readAt: null, type: 'NEW_COMMENT' });

      const read = await paula.post(`/api/notifications/${list[0].id}/read`);
      expect(read.status).toBe(200);
      expect(read.body.readAt).not.toBeNull();
      expect((await paula.get('/api/notifications/unread-count')).body).toEqual({ count: 0 });
      expect((await paula.get('/api/notifications')).body).toHaveLength(1);
    });

    it('marcar todas como lidas', async () => {
      const paula = await loginAs(ctx.app, 'paula');
      const marcos = await loginAs(ctx.app, 'marcos');
      const id = (await openTicket(paula)).body.id;
      await marcos.post(`/api/tickets/${id}/comments`).send({ body: 'um' });
      await marcos.post(`/api/tickets/${id}/triage`).send({});
      expect((await paula.get('/api/notifications/unread-count')).body.count).toBe(2);
      expect((await paula.post('/api/notifications/read-all')).body).toEqual({ updated: 2 });
      expect((await paula.get('/api/notifications/unread-count')).body.count).toBe(0);
    });

    it('usuário não lê nem marca notificação de outro', async () => {
      const paula = await loginAs(ctx.app, 'paula');
      const carlos = await loginAs(ctx.app, 'carlos');
      const marcos = await loginAs(ctx.app, 'marcos');
      const id = (await openTicket(paula)).body.id;
      await marcos.post(`/api/tickets/${id}/comments`).send({ body: 'oi' });
      const notification = (await paula.get('/api/notifications')).body[0];

      expect((await carlos.get('/api/notifications')).body).toEqual([]);
      expect((await carlos.post(`/api/notifications/${notification.id}/read`)).status).toBe(404);
      expect((await paula.get('/api/notifications/unread-count')).body.count).toBe(1);
    });

    it('observação interna não notifica o solicitante; novo chamado notifica a TI', async () => {
      const paula = await loginAs(ctx.app, 'paula');
      const marcos = await loginAs(ctx.app, 'marcos');
      const helena = await loginAs(ctx.app, 'helena');
      const id = (await openTicket(paula)).body.id;

      expect((await marcos.get('/api/notifications/unread-count')).body.count).toBe(1);
      expect((await helena.get('/api/notifications/unread-count')).body.count).toBe(1);
      await marcos.post(`/api/tickets/${id}/comments`).send({ body: 'só TI', visibility: 'INTERNAL' });
      expect((await paula.get('/api/notifications/unread-count')).body.count).toBe(0);
    });

    it('comentário do funcionário notifica o responsável', async () => {
      const paula = await loginAs(ctx.app, 'paula');
      const marcos = await loginAs(ctx.app, 'marcos');
      const id = (await openTicket(paula)).body.id;
      await marcos.post(`/api/tickets/${id}/assume`);
      await marcos.post('/api/notifications/read-all');
      await paula.post(`/api/tickets/${id}/comments`).send({ body: 'Mais detalhes' });
      expect((await marcos.get('/api/notifications/unread-count')).body.count).toBe(1);
    });

    it('administrador edita as regras de prioridade e a sugestão passa a usá-las', async () => {
      const helena = await loginAs(ctx.app, 'helena');
      const paula = await loginAs(ctx.app, 'paula');
      const rules = (await helena.get('/api/priority-rules')).body;
      expect(rules.weights).toHaveLength(10);
      expect(rules.thresholds).toHaveLength(4);

      const base = await openTicket(paula, { impactAffected: 'SELF', impactBlocking: 'LIMITED', impactAlternative: 'YES' });
      expect((await ctx.prisma.ticket.findUniqueOrThrow({ where: { id: base.body.id } })).priority).toBe('MEDIUM');

      const weights = rules.weights.map((w: { question: string; option: string; points: number }) =>
        w.question === 'BLOCKING' && w.option === 'LIMITED' ? { ...w, points: 3 } : w,
      );
      const updated = await helena.put('/api/priority-rules').send({ weights, thresholds: rules.thresholds });
      expect(updated.status).toBe(200);

      const after = await openTicket(paula, { impactAffected: 'SELF', impactBlocking: 'LIMITED', impactAlternative: 'YES' });
      expect((await ctx.prisma.ticket.findUniqueOrThrow({ where: { id: after.body.id } })).priority).toBe('HIGH');
      expect((await ctx.prisma.ticket.findUniqueOrThrow({ where: { id: base.body.id } })).priority).toBe('MEDIUM');
    });

    it('rejeita regras de prioridade incoerentes', async () => {
      const helena = await loginAs(ctx.app, 'helena');
      const rules = (await helena.get('/api/priority-rules')).body;
      const bad = rules.thresholds.map((t: { priority: string; minScore: number }) =>
        t.priority === 'HIGH' ? { ...t, minScore: 1 } : t,
      );
      expect((await helena.put('/api/priority-rules').send({ weights: rules.weights, thresholds: bad })).status).toBe(400);
      expect((await helena.put('/api/priority-rules').send({ weights: rules.weights.slice(1), thresholds: rules.thresholds })).status).toBe(400);
    });

    it('relatório resume o período e exige perfil administrador', async () => {
      const paula = await loginAs(ctx.app, 'paula');
      const marcos = await loginAs(ctx.app, 'marcos');
      const helena = await loginAs(ctx.app, 'helena');
      const first = (await openTicket(paula)).body.id;
      await openTicket(paula);
      await marcos.post(`/api/tickets/${first}/assume`);
      await marcos.post(`/api/tickets/${first}/resolve`).send({ solution: 'ok' });

      const res = await helena.get('/api/reports/summary?period=today');
      expect(res.status).toBe(200);
      expect(res.body.totals).toMatchObject({ total: 2, resolvedOrClosed: 1, unassignedNow: 1 });
      expect(res.body.totals.avgResolutionSeconds).toBeGreaterThanOrEqual(0);
      expect(res.body.byStatus).toEqual(expect.arrayContaining([{ key: 'OPEN', name: 'OPEN', count: 1 }]));
      expect(res.body.bySector[0]).toMatchObject({ name: 'Financeiro', count: 2 });
      expect(res.body.byTechnician.map((r: { name: string }) => r.name)).toEqual(expect.arrayContaining(['marcos', 'Sem responsável']));

      expect((await helena.get('/api/reports/summary?period=ontem')).status).toBe(400);
      expect((await marcos.get('/api/reports/summary')).status).toBe(403);
      expect((await paula.get('/api/reports/summary')).status).toBe(403);
    });

    it('relatório do período "hoje" ignora chamados antigos', async () => {
      const paula = await loginAs(ctx.app, 'paula');
      const helena = await loginAs(ctx.app, 'helena');
      const id = (await openTicket(paula)).body.id;
      await openTicket(paula);
      await ctx.prisma.ticket.update({ where: { id }, data: { createdAt: new Date(Date.now() - 10 * 24 * 3_600_000) } });

      expect((await helena.get('/api/reports/summary?period=today')).body.totals.total).toBe(1);
      expect((await helena.get('/api/reports/summary?period=7d')).body.totals.total).toBe(1);
      expect((await helena.get('/api/reports/summary?period=30d')).body.totals.total).toBe(2);
    });
  });

  describe('com o seed de demonstração (cerca de 500 chamados)', () => {
    beforeAll(async () => {
      await resetDatabase(ctx.prisma);
      runDemoSeed();
    });

    it('o seed cria usuários dos três perfis e chamados em vários status', async () => {
      const roles = await ctx.prisma.user.groupBy({ by: ['role'], _count: { _all: true } });
      expect(roles.map((r) => r.role).sort()).toEqual(['ADMIN', 'EMPLOYEE', 'TECHNICIAN']);
      expect(await ctx.prisma.ticket.count()).toBe(500);
      const statuses = await ctx.prisma.ticket.groupBy({ by: ['status'] });
      expect(statuses).toHaveLength(6);
      expect(await ctx.prisma.user.count({ where: { isActive: false } })).toBeGreaterThan(0);
    });

    it('seed é idempotente: segunda execução não duplica dados', async () => {
      runDemoSeed();
      expect(await ctx.prisma.ticket.count()).toBe(500);
    });

    it('listagens e relatório respondem em menos de 500 ms com 500 chamados', async () => {
      const marcos = await loginAs(ctx.app, 'marcos');
      const helena = await loginAs(ctx.app, 'helena');
      await marcos.get('/api/tickets?pageSize=20');
      await helena.get('/api/reports/summary?period=30d');

      const timed = async (run: () => PromiseLike<{ status: number }>): Promise<number> => {
        const start = process.hrtime.bigint();
        const res = await run();
        expect(res.status).toBe(200);
        return Number(process.hrtime.bigint() - start) / 1_000_000;
      };
      expect(await timed(() => marcos.get('/api/tickets?pageSize=20'))).toBeLessThan(500);
      expect(await timed(() => marcos.get('/api/tickets?status=OPEN&priority=HIGH&pageSize=20'))).toBeLessThan(500);
      expect(await timed(() => helena.get('/api/reports/summary?period=30d'))).toBeLessThan(500);
    });

    it('relatório do seed é coerente com a contagem do banco', async () => {
      const helena = await loginAs(ctx.app, 'helena');
      const res = await helena.get('/api/reports/summary?period=30d');
      const since = new Date(res.body.from);
      expect(res.body.totals.total).toBe(await ctx.prisma.ticket.count({ where: { createdAt: { gte: since } } }));
      const sum = res.body.byStatus.reduce((acc: number, r: { count: number }) => acc + r.count, 0);
      expect(sum).toBe(res.body.totals.total);
    });
  });
});
