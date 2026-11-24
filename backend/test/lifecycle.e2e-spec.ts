import { TestContext, createTestApp, createUser, loginAs, openTicket, resetDatabase } from './helpers/test-app';

const DAY = 24 * 3_600_000;

describe('Ciclo de vida do chamado (e2e)', () => {
  let ctx: TestContext;

  beforeAll(async () => {
    ctx = await createTestApp();
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  beforeEach(async () => {
    await resetDatabase(ctx.prisma);
    await createUser(ctx.prisma, { login: 'paula', role: 'EMPLOYEE', name: 'Paula Ribeiro' });
    await createUser(ctx.prisma, { login: 'marcos', role: 'TECHNICIAN', sectorName: 'TI', name: 'Marcos Teixeira' });
    await createUser(ctx.prisma, { login: 'julia', role: 'TECHNICIAN', sectorName: 'TI', name: 'Julia Prado' });
    await createUser(ctx.prisma, { login: 'helena', role: 'ADMIN', sectorName: 'TI', name: 'Helena Duarte' });
    const financeiro = await ctx.prisma.sector.findUniqueOrThrow({ where: { name: 'Financeiro' } });
    await ctx.prisma.equipment.create({
      data: { serial: 'NB-48213', type: 'NOTEBOOK', manufacturer: 'Dell', model: 'Latitude 5420', sectorId: financeiro.id },
    });
  });

  async function resolvedTicket(): Promise<number> {
    const paula = await loginAs(ctx.app, 'paula');
    const marcos = await loginAs(ctx.app, 'marcos');
    const id = (await openTicket(paula)).body.id;
    await marcos.post(`/api/tickets/${id}/assume`);
    await marcos.post(`/api/tickets/${id}/triage`).send({});
    await marcos.post(`/api/tickets/${id}/resolve`).send({ solution: 'Teclado trocado' });
    return id;
  }

  it('AT-001: abre chamado com dados da conta, equipamento vinculado e prioridade sugerida', async () => {
    const paula = await loginAs(ctx.app, 'paula');
    const res = await openTicket(paula, { impactAffected: 'SELF', impactBlocking: 'BLOCKED', impactAlternative: 'NO' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      code: 'CH-000001',
      status: 'OPEN',
      requesterName: 'Paula Ribeiro',
      requesterEmail: 'paula@empresa.example',
      sector: { name: 'Financeiro' },
      serialInformed: 'NB-48213',
      equipmentPending: false,
      equipment: { serial: 'NB-48213', model: 'Latitude 5420' },
    });

    const stored = await ctx.prisma.ticket.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(stored.suggestedPriority).toBe('HIGH');
    expect(stored.priority).toBe('HIGH');

    const events = await ctx.prisma.ticketEvent.findMany({ where: { ticketId: res.body.id } });
    expect(events.map((e) => e.type)).toEqual(['CREATED']);

    const staff = await ctx.prisma.user.findMany({ where: { role: { in: ['TECHNICIAN', 'ADMIN'] } } });
    const notified = await ctx.prisma.notification.findMany({ where: { ticketId: res.body.id } });
    expect(notified.map((n) => n.userId).sort()).toEqual(staff.map((u) => u.id).sort());
  });

  it('AT-002: serial desconhecido não bloqueia a abertura e fica pendente de validação', async () => {
    const paula = await loginAs(ctx.app, 'paula');
    const res = await openTicket(paula, { serial: ' xx-0001 ' });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ serialInformed: 'XX-0001', equipmentPending: true, equipment: null });
  });

  it('exige descrição e serial na abertura', async () => {
    const paula = await loginAs(ctx.app, 'paula');
    const noSerial = await paula
      .post('/api/tickets')
      .field('description', 'x')
      .field('impactAffected', 'SELF')
      .field('impactBlocking', 'NONE')
      .field('impactAlternative', 'YES');
    expect(noSerial.status).toBe(400);
    const noDescription = await openTicket(paula, { description: '' });
    expect(noDescription.status).toBe(400);
    expect(await ctx.prisma.ticket.count()).toBe(0);
  });

  it('somente funcionário abre chamado', async () => {
    const marcos = await loginAs(ctx.app, 'marcos');
    expect((await openTicket(marcos)).status).toBe(403);
  });

  it('AT-005: técnico assume o chamado e o responsável fica registrado', async () => {
    const paula = await loginAs(ctx.app, 'paula');
    const marcos = await loginAs(ctx.app, 'marcos');
    const julia = await loginAs(ctx.app, 'julia');
    const id = (await openTicket(paula)).body.id;

    const res = await marcos.post(`/api/tickets/${id}/assume`);
    expect(res.status).toBe(200);
    expect(res.body.assignee.name).toBe('Marcos Teixeira');
    expect(res.body.assignedAt).not.toBeNull();
    const assigned = res.body.events.find((e: { type: string }) => e.type === 'ASSIGNED');
    expect(assigned.actor.name).toBe('Marcos Teixeira');

    expect((await julia.post(`/api/tickets/${id}/assume`)).status).toBe(409);
  });

  it('administrador atribui e reatribui a técnicos, nunca a funcionário', async () => {
    const paula = await loginAs(ctx.app, 'paula');
    const helena = await loginAs(ctx.app, 'helena');
    const id = (await openTicket(paula)).body.id;
    const julia = await ctx.prisma.user.findUniqueOrThrow({ where: { login: 'julia' } });
    const employee = await ctx.prisma.user.findUniqueOrThrow({ where: { login: 'paula' } });

    const res = await helena.post(`/api/tickets/${id}/assign`).send({ assigneeId: julia.id });
    expect(res.status).toBe(200);
    expect(res.body.assignee.id).toBe(julia.id);
    expect((await helena.post(`/api/tickets/${id}/assign`).send({ assigneeId: employee.id })).status).toBe(400);

    const notice = await ctx.prisma.notification.findFirst({ where: { userId: julia.id, type: 'TICKET_ASSIGNED' } });
    expect(notice).not.toBeNull();
  });

  it('AT-006: resolver notifica o solicitante e a confirmação fecha o chamado', async () => {
    const id = await resolvedTicket();
    const paula = await loginAs(ctx.app, 'paula');
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { login: 'paula' } });

    const detail = (await paula.get(`/api/tickets/${id}`)).body;
    expect(detail.status).toBe('RESOLVED');
    expect(detail.solution).toBe('Teclado trocado');
    const notice = await ctx.prisma.notification.findFirst({ where: { userId: user.id, type: 'TICKET_RESOLVED' } });
    expect(notice).not.toBeNull();

    const closed = await paula.post(`/api/tickets/${id}/confirm`);
    expect(closed.status).toBe(200);
    expect(closed.body.status).toBe('CLOSED');
    expect(closed.body.closedAt).not.toBeNull();
    expect(closed.body.reopenUntil).not.toBeNull();
    const types = closed.body.events.map((e: { type: string }) => e.type);
    expect(types).toEqual(expect.arrayContaining(['CREATED', 'ASSIGNED', 'TRIAGED', 'RESOLVED', 'CLOSED']));
  });

  it('técnico não confirma o fechamento no lugar do funcionário', async () => {
    const id = await resolvedTicket();
    const marcos = await loginAs(ctx.app, 'marcos');
    expect((await marcos.post(`/api/tickets/${id}/confirm`)).status).toBe(403);
  });

  it('AT-007: reabertura dois dias após o fechamento volta o chamado para a fila', async () => {
    const id = await resolvedTicket();
    const paula = await loginAs(ctx.app, 'paula');
    await paula.post(`/api/tickets/${id}/confirm`);
    await ctx.prisma.ticket.update({ where: { id }, data: { closedAt: new Date(Date.now() - 2 * DAY) } });

    const res = await paula.post(`/api/tickets/${id}/reopen`).send({ reason: 'O problema voltou' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OPEN');
    expect(res.body.closedAt).toBeNull();
    const reopened = res.body.events.find((e: { type: string }) => e.type === 'REOPENED');
    expect(reopened.payload.reason).toBe('O problema voltou');
    expect(reopened.actor.name).toBe('Paula Ribeiro');
  });

  it('AT-008: reabertura após o prazo é rejeitada sem alterar o chamado', async () => {
    const id = await resolvedTicket();
    const paula = await loginAs(ctx.app, 'paula');
    await paula.post(`/api/tickets/${id}/confirm`);
    await ctx.prisma.ticket.update({ where: { id }, data: { closedAt: new Date(Date.now() - 4 * DAY) } });

    const res = await paula.post(`/api/tickets/${id}/reopen`).send({ reason: 'Voltou' });
    expect(res.status).toBe(409);
    expect(res.body.message).toContain('Prazo de reabertura expirado');
    expect((await ctx.prisma.ticket.findUniqueOrThrow({ where: { id } })).status).toBe('CLOSED');
  });

  it('AT-009: reabertura sem motivo é rejeitada', async () => {
    const id = await resolvedTicket();
    const paula = await loginAs(ctx.app, 'paula');
    await paula.post(`/api/tickets/${id}/confirm`);
    expect((await paula.post(`/api/tickets/${id}/reopen`).send({})).status).toBe(400);
    expect((await paula.post(`/api/tickets/${id}/reopen`).send({ reason: '   ' })).status).toBe(400);
    expect((await ctx.prisma.ticket.findUniqueOrThrow({ where: { id } })).status).toBe('CLOSED');
  });

  it('funcionário recusa a solução e o chamado volta para Aberto com motivo', async () => {
    const id = await resolvedTicket();
    const paula = await loginAs(ctx.app, 'paula');
    const res = await paula.post(`/api/tickets/${id}/reject-resolution`).send({ reason: 'Ainda falha' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('OPEN');
    expect(res.body.events.map((e: { type: string }) => e.type)).toContain('RESOLUTION_REJECTED');
  });

  it('AT-010: cancelamento exige justificativa e registra autor, data e motivo', async () => {
    const paula = await loginAs(ctx.app, 'paula');
    const id = (await openTicket(paula)).body.id;

    expect((await paula.post(`/api/tickets/${id}/cancel`).send({})).status).toBe(400);
    const res = await paula.post(`/api/tickets/${id}/cancel`).send({ reason: 'Resolvido sozinho' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('CANCELLED');
    expect(res.body.cancelledAt).not.toBeNull();
    const cancelled = res.body.events.find((e: { type: string }) => e.type === 'CANCELLED');
    expect(cancelled.payload.reason).toBe('Resolvido sozinho');
    expect(cancelled.actor.name).toBe('Paula Ribeiro');
  });

  it('chamado Fechado ou Cancelado não pode ser cancelado de novo', async () => {
    const id = await resolvedTicket();
    const paula = await loginAs(ctx.app, 'paula');
    await paula.post(`/api/tickets/${id}/confirm`);
    expect((await paula.post(`/api/tickets/${id}/cancel`).send({ reason: 'x' })).status).toBe(409);
  });

  it('a TI também cancela com justificativa e o solicitante é notificado', async () => {
    const paula = await loginAs(ctx.app, 'paula');
    const marcos = await loginAs(ctx.app, 'marcos');
    const id = (await openTicket(paula)).body.id;
    const res = await marcos.post(`/api/tickets/${id}/cancel`).send({ reason: 'Duplicado do CH-000099' });
    expect(res.status).toBe(200);
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { login: 'paula' } });
    expect(await ctx.prisma.notification.count({ where: { userId: user.id, message: { contains: 'cancelado' } } })).toBe(1);
  });

  it('AT-011: alteração de prioridade registra anterior, nova, autor, momento e justificativa', async () => {
    const paula = await loginAs(ctx.app, 'paula');
    const marcos = await loginAs(ctx.app, 'marcos');
    const id = (await openTicket(paula)).body.id;
    const before = (await ctx.prisma.ticket.findUniqueOrThrow({ where: { id } })).priority;

    expect((await marcos.post(`/api/tickets/${id}/priority`).send({ priority: 'CRITICAL' })).status).toBe(400);
    const res = await marcos.post(`/api/tickets/${id}/priority`).send({ priority: 'CRITICAL', justification: 'Setor inteiro parado' });
    expect(res.status).toBe(200);
    expect(res.body.priority).toBe('CRITICAL');

    const event = await ctx.prisma.ticketEvent.findFirstOrThrow({ where: { ticketId: id, type: 'PRIORITY_CHANGED' } });
    expect(event.payload).toEqual({ from: before, to: 'CRITICAL', justification: 'Setor inteiro parado' });
    expect(event.actorId).not.toBeNull();
    expect(event.createdAt).toBeInstanceOf(Date);
    expect((await ctx.prisma.ticket.findUniqueOrThrow({ where: { id } })).suggestedPriority).toBe(before);
  });

  it('triagem com prioridade diferente exige justificativa e registra o evento', async () => {
    const paula = await loginAs(ctx.app, 'paula');
    const marcos = await loginAs(ctx.app, 'marcos');
    const id = (await openTicket(paula)).body.id;
    expect((await marcos.post(`/api/tickets/${id}/triage`).send({ priority: 'LOW' })).status).toBe(400);
    const res = await marcos.post(`/api/tickets/${id}/triage`).send({ priority: 'LOW', justification: 'Sem urgência' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('WAITING_START');
    expect(res.body.priority).toBe('LOW');
  });

  it('pedir informação coloca o chamado em Aguardando usuário e a resposta do funcionário o devolve', async () => {
    const paula = await loginAs(ctx.app, 'paula');
    const marcos = await loginAs(ctx.app, 'marcos');
    const id = (await openTicket(paula)).body.id;
    await marcos.post(`/api/tickets/${id}/triage`).send({});

    const asked = await marcos.post(`/api/tickets/${id}/request-info`).send({ message: 'Qual o modelo do teclado?' });
    expect(asked.status).toBe(200);
    expect(asked.body.status).toBe('WAITING_USER');

    const comments = (await paula.get(`/api/tickets/${id}/comments`)).body;
    expect(comments[0]).toMatchObject({ body: 'Qual o modelo do teclado?', visibility: 'PUBLIC' });

    const reply = await paula.post(`/api/tickets/${id}/comments`).send({ body: 'Logitech K120' });
    expect(reply.status).toBe(201);
    expect((await paula.get(`/api/tickets/${id}`)).body.status).toBe('WAITING_START');
  });

  it('chamado fechado ou cancelado não aceita novos comentários', async () => {
    const paula = await loginAs(ctx.app, 'paula');
    const id = (await openTicket(paula)).body.id;
    await paula.post(`/api/tickets/${id}/cancel`).send({ reason: 'x' });
    expect((await paula.post(`/api/tickets/${id}/comments`).send({ body: 'oi' })).status).toBe(409);
  });

  it('TI corrige o serial do chamado e o equipamento é vinculado', async () => {
    const paula = await loginAs(ctx.app, 'paula');
    const marcos = await loginAs(ctx.app, 'marcos');
    const id = (await openTicket(paula, { serial: 'NB-4821E' })).body.id;
    expect((await paula.get(`/api/tickets/${id}`)).body.equipmentPending).toBe(true);

    const res = await marcos.post(`/api/tickets/${id}/serial`).send({ serial: 'nb-48213' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ serialInformed: 'NB-48213', equipmentPending: false });
    expect(res.body.events.map((e: { type: string }) => e.type)).toContain('SERIAL_CORRECTED');
  });

  it('duas ações simultâneas no mesmo chamado: uma vence e a outra recebe 409', async () => {
    const paula = await loginAs(ctx.app, 'paula');
    const marcos = await loginAs(ctx.app, 'marcos');
    const julia = await loginAs(ctx.app, 'julia');
    const id = (await openTicket(paula)).body.id;
    const [a, b] = await Promise.all([marcos.post(`/api/tickets/${id}/assume`), julia.post(`/api/tickets/${id}/assume`)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
  });

  it('fila da TI filtra por status, prioridade, responsável e período, com paginação', async () => {
    const paula = await loginAs(ctx.app, 'paula');
    const marcos = await loginAs(ctx.app, 'marcos');
    const first = (await openTicket(paula, { impactAffected: 'COMPANY', impactBlocking: 'BLOCKED', impactAlternative: 'NO' })).body.id;
    await openTicket(paula);
    await openTicket(paula);
    await marcos.post(`/api/tickets/${first}/assume`);

    expect((await marcos.get('/api/tickets?unassigned=true')).body.total).toBe(2);
    expect((await marcos.get('/api/tickets?mine=true')).body.total).toBe(1);
    expect((await marcos.get('/api/tickets?priority=CRITICAL')).body.total).toBe(1);
    expect((await marcos.get('/api/tickets?status=OPEN&pageSize=2&page=2')).body.items).toHaveLength(1);
    const tomorrow = new Date(Date.now() + DAY).toISOString();
    expect((await marcos.get(`/api/tickets?from=${encodeURIComponent(tomorrow)}`)).body.total).toBe(0);
    const ordered = (await marcos.get('/api/tickets')).body.items;
    expect(ordered[0].id).toBe(first);
    expect((await marcos.get('/api/tickets?pageSize=1000')).status).toBe(400);
  });
});
