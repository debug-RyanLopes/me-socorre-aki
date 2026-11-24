import { PNG, TestContext, createTestApp, createUser, loginAs, openTicket, resetDatabase } from './helpers/test-app';

describe('Isolamento e visibilidade (e2e)', () => {
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
    await createUser(ctx.prisma, { login: 'carlos', role: 'EMPLOYEE', sectorName: 'RH' });
    await createUser(ctx.prisma, { login: 'marcos', role: 'TECHNICIAN', sectorName: 'TI' });
    await createUser(ctx.prisma, { login: 'helena', role: 'ADMIN', sectorName: 'TI' });
  });

  async function ticketOf(login: string): Promise<number> {
    const agent = await loginAs(ctx.app, login);
    const res = await openTicket(agent);
    expect(res.status).toBe(201);
    return res.body.id;
  }

  it('AT-003: funcionário não vê, lista, comenta nem age no chamado de outro', async () => {
    const carlosTicket = await ticketOf('carlos');
    const paula = await loginAs(ctx.app, 'paula');

    expect((await paula.get(`/api/tickets/${carlosTicket}`)).status).toBe(404);
    expect((await paula.get(`/api/tickets/${carlosTicket}/comments`)).status).toBe(404);
    expect((await paula.post(`/api/tickets/${carlosTicket}/comments`).send({ body: 'oi' })).status).toBe(404);
    expect((await paula.post(`/api/tickets/${carlosTicket}/cancel`).send({ reason: 'x' })).status).toBe(404);

    const list = await paula.get('/api/tickets');
    expect(list.status).toBe(200);
    expect(list.body.items.map((t: { id: number }) => t.id)).not.toContain(carlosTicket);
    expect(list.body.total).toBe(0);
  });

  it('varredura de IDs: funcionário só obtém 200 nos próprios chamados', async () => {
    const ids: number[] = [];
    for (const login of ['paula', 'carlos', 'paula', 'carlos']) ids.push(await ticketOf(login));
    const paula = await loginAs(ctx.app, 'paula');
    const owner = await ctx.prisma.user.findUniqueOrThrow({ where: { login: 'paula' } });
    for (const id of ids) {
      const ticket = await ctx.prisma.ticket.findUniqueOrThrow({ where: { id } });
      const res = await paula.get(`/api/tickets/${id}`);
      expect(res.status).toBe(ticket.requesterId === owner.id ? 200 : 404);
    }
  });

  it('TI e administrador enxergam qualquer chamado', async () => {
    const id = await ticketOf('paula');
    for (const login of ['marcos', 'helena']) {
      const agent = await loginAs(ctx.app, login);
      expect((await agent.get(`/api/tickets/${id}`)).status).toBe(200);
    }
  });

  it('AT-004: observação interna e seu anexo ficam invisíveis ao funcionário', async () => {
    const id = await ticketOf('paula');
    const paula = await loginAs(ctx.app, 'paula');
    const marcos = await loginAs(ctx.app, 'marcos');

    const internal = await marcos
      .post(`/api/tickets/${id}/comments`)
      .field('body', 'Suspeita de falha de hardware')
      .field('visibility', 'INTERNAL')
      .attach('files', PNG, 'diagnostico.png');
    expect(internal.status).toBe(201);
    const attachmentId = internal.body.attachments[0].id;

    const asEmployee = await paula.get(`/api/tickets/${id}/comments`);
    expect(asEmployee.status).toBe(200);
    expect(JSON.stringify(asEmployee.body)).not.toContain('Suspeita de falha');
    expect(asEmployee.body).toHaveLength(0);

    expect((await paula.get(`/api/attachments/${attachmentId}`)).status).toBe(404);
    const asStaff = await marcos.get(`/api/attachments/${attachmentId}`);
    expect(asStaff.status).toBe(200);
    expect(asStaff.headers['x-content-type-options']).toBe('nosniff');
    expect(asStaff.headers['content-disposition']).toContain('attachment');

    const staffView = await marcos.get(`/api/tickets/${id}/comments`);
    expect(staffView.body).toHaveLength(1);
  });

  it('funcionário não pode criar observação interna', async () => {
    const id = await ticketOf('paula');
    const paula = await loginAs(ctx.app, 'paula');
    const res = await paula.post(`/api/tickets/${id}/comments`).send({ body: 'tentando', visibility: 'INTERNAL' });
    expect(res.status).toBe(403);
  });

  it('detalhe do funcionário omite prioridade sugerida e eventos internos', async () => {
    const id = await ticketOf('paula');
    const marcos = await loginAs(ctx.app, 'marcos');
    await marcos.post(`/api/tickets/${id}/priority`).send({ priority: 'CRITICAL', justification: 'Setor parado' });

    const paula = await loginAs(ctx.app, 'paula');
    const asEmployee = (await paula.get(`/api/tickets/${id}`)).body;
    expect(asEmployee.suggestedPriority).toBeNull();
    expect(asEmployee.priority).toBeNull();
    expect(asEmployee.events.map((e: { type: string }) => e.type)).not.toContain('PRIORITY_CHANGED');
    expect(JSON.stringify(asEmployee)).not.toContain('Setor parado');

    const asStaff = (await marcos.get(`/api/tickets/${id}`)).body;
    expect(asStaff.events.map((e: { type: string }) => e.type)).toContain('PRIORITY_CHANGED');
    expect(asStaff.priority).toBe('CRITICAL');
  });

  it('funcionário recebe 403 nas rotas da TI e do administrador', async () => {
    const id = await ticketOf('paula');
    const paula = await loginAs(ctx.app, 'paula');
    expect((await paula.get('/api/users')).status).toBe(403);
    expect((await paula.get('/api/reports/summary')).status).toBe(403);
    expect((await paula.get('/api/equipment')).status).toBe(403);
    expect((await paula.get('/api/priority-rules')).status).toBe(403);
    expect((await paula.post(`/api/tickets/${id}/assume`)).status).toBe(403);
    expect((await paula.post(`/api/tickets/${id}/resolve`).send({ solution: 'x' })).status).toBe(403);
  });

  it('técnico não acessa rotas exclusivas do administrador', async () => {
    const id = await ticketOf('paula');
    const marcos = await loginAs(ctx.app, 'marcos');
    expect((await marcos.get('/api/users')).status).toBe(403);
    expect((await marcos.get('/api/reports/summary')).status).toBe(403);
    expect((await marcos.post(`/api/tickets/${id}/assign`).send({ assigneeId: 1 })).status).toBe(403);
    expect((await marcos.post('/api/sectors').send({ name: 'Novo' })).status).toBe(403);
  });
});
