import { DEFAULT_PASSWORD, TestContext, createTestApp, createUser, loginAs, newAgent, openTicket, resetDatabase } from './helpers/test-app';

describe('Cadastro de usuários e equipamentos (e2e)', () => {
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
    await createUser(ctx.prisma, { login: 'marcos', role: 'TECHNICIAN', sectorName: 'TI' });
    await createUser(ctx.prisma, { login: 'helena', role: 'ADMIN', sectorName: 'TI' });
  });

  async function sectorId(name: string): Promise<number> {
    return (await ctx.prisma.sector.findUniqueOrThrow({ where: { name } })).id;
  }

  it('somente o administrador cadastra usuários', async () => {
    const body = { name: 'Novo', email: 'novo@empresa.example', login: 'novo', role: 'EMPLOYEE', sectorId: await sectorId('RH') };
    for (const login of ['paula', 'marcos']) {
      const agent = await loginAs(ctx.app, login);
      expect((await agent.post('/api/users').send(body)).status).toBe(403);
    }
    expect(await ctx.prisma.user.count({ where: { login: 'novo' } })).toBe(0);
  });

  it('administrador cadastra usuário com senha temporária e troca obrigatória no primeiro acesso', async () => {
    const helena = await loginAs(ctx.app, 'helena');
    const res = await helena.post('/api/users').send({
      name: 'Renata Alves',
      email: 'Renata.Alves@empresa.example',
      login: 'Renata',
      role: 'TECHNICIAN',
      sectorId: await sectorId('TI'),
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ login: 'renata', email: 'renata.alves@empresa.example', mustChangePassword: true, isActive: true });
    expect(res.body.temporaryPassword.length).toBeGreaterThanOrEqual(10);
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');

    const stored = await ctx.prisma.user.findUniqueOrThrow({ where: { login: 'renata' } });
    expect(stored.passwordHash).not.toContain(res.body.temporaryPassword);

    const login = await newAgent(ctx.app).post('/api/auth/login').send({ login: 'renata', password: res.body.temporaryPassword });
    expect(login.status).toBe(200);
    expect(login.body.mustChangePassword).toBe(true);
  });

  it('aceita senha temporária informada, desde que atenda ao tamanho mínimo', async () => {
    const helena = await loginAs(ctx.app, 'helena');
    const base = { name: 'Bruno', email: 'bruno@empresa.example', login: 'bruno', role: 'EMPLOYEE', sectorId: await sectorId('RH') };
    expect((await helena.post('/api/users').send({ ...base, temporaryPassword: 'curta' })).status).toBe(400);
    const ok = await helena.post('/api/users').send({ ...base, temporaryPassword: 'temporaria-segura-1' });
    expect(ok.status).toBe(201);
    expect(ok.body.temporaryPassword).toBeUndefined();
  });

  it('valida dados e impede login e e-mail duplicados', async () => {
    const helena = await loginAs(ctx.app, 'helena');
    const base = { name: 'Dup', email: 'dup@empresa.example', login: 'dup', role: 'EMPLOYEE', sectorId: await sectorId('RH') };
    expect((await helena.post('/api/users').send({ ...base, email: 'invalido' })).status).toBe(400);
    expect((await helena.post('/api/users').send({ ...base, role: 'SUPER' })).status).toBe(400);
    expect((await helena.post('/api/users').send({ ...base, sectorId: 9999 })).status).toBe(400);
    expect((await helena.post('/api/users').send(base)).status).toBe(201);
    expect((await helena.post('/api/users').send({ ...base, email: 'outro@empresa.example' })).status).toBe(409);
    expect((await helena.post('/api/users').send({ ...base, login: 'dup2' })).status).toBe(409);
  });

  it('lista usuários com busca, filtros e paginação, e edita perfil e setor', async () => {
    const helena = await loginAs(ctx.app, 'helena');
    const all = await helena.get('/api/users');
    expect(all.body.total).toBe(3);
    expect((await helena.get('/api/users?role=TECHNICIAN')).body.total).toBe(1);
    expect((await helena.get('/api/users?q=PAUL')).body.items[0].login).toBe('paula');
    expect((await helena.get('/api/users?active=false')).body.total).toBe(0);
    expect((await helena.get('/api/users?pageSize=2&page=2')).body.items).toHaveLength(1);

    const paula = await ctx.prisma.user.findUniqueOrThrow({ where: { login: 'paula' } });
    const res = await helena.patch(`/api/users/${paula.id}`).send({ role: 'TECHNICIAN', sectorId: await sectorId('TI') });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ role: 'TECHNICIAN', sectorName: 'TI' });
  });

  it('desativação preserva chamados, comentários e histórico do usuário', async () => {
    const paula = await loginAs(ctx.app, 'paula');
    const helena = await loginAs(ctx.app, 'helena');
    const marcos = await loginAs(ctx.app, 'marcos');
    const id = (await openTicket(paula)).body.id;
    await paula.post(`/api/tickets/${id}/comments`).send({ body: 'Estou aguardando' });
    const user = await ctx.prisma.user.findUniqueOrThrow({ where: { login: 'paula' } });

    await helena.post(`/api/users/${user.id}/deactivate`);

    const detail = (await marcos.get(`/api/tickets/${id}`)).body;
    expect(detail.requesterName).toBe('paula');
    const created = detail.events.find((e: { type: string }) => e.type === 'CREATED');
    expect(created.actor.name).toBe('paula');
    const comments = (await marcos.get(`/api/tickets/${id}/comments`)).body;
    expect(comments[0].author.name).toBe('paula');
    expect(await ctx.prisma.user.count({ where: { id: user.id } })).toBe(1);
  });

  it('administrador gerencia setores e categorias; nomes são únicos', async () => {
    const helena = await loginAs(ctx.app, 'helena');
    const created = await helena.post('/api/sectors').send({ name: 'Jurídico' });
    expect(created.status).toBe(201);
    expect((await helena.post('/api/sectors').send({ name: 'Jurídico' })).status).toBe(409);
    expect((await helena.patch(`/api/sectors/${created.body.id}`).send({ active: false })).body.active).toBe(false);

    const paula = await loginAs(ctx.app, 'paula');
    const names = (await paula.get('/api/sectors')).body.map((s: { name: string }) => s.name);
    expect(names).not.toContain('Jurídico');
    expect((await helena.get('/api/sectors?includeInactive=true')).body.map((s: { name: string }) => s.name)).toContain('Jurídico');

    const category = await helena.post('/api/categories').send({ name: 'Telefonia' });
    expect(category.status).toBe(201);
    expect((await helena.post('/api/categories').send({ name: 'Telefonia' })).status).toBe(409);
  });

  const equipment = async (serial: string) => ({
    serial,
    type: 'NOTEBOOK',
    manufacturer: 'Dell',
    model: 'Latitude 5420',
    sectorId: await sectorId('Financeiro'),
  });

  it('AT-014: serial duplicado no cadastro é rejeitado, inclusive com variação de caixa e espaços', async () => {
    const marcos = await loginAs(ctx.app, 'marcos');
    expect((await marcos.post('/api/equipment').send(await equipment('NB-1001'))).status).toBe(201);
    expect((await marcos.post('/api/equipment').send(await equipment('NB-1001'))).status).toBe(409);
    expect((await marcos.post('/api/equipment').send(await equipment('  nb-1001 '))).status).toBe(409);
    expect(await ctx.prisma.equipment.count()).toBe(1);
  });

  it('cadastrar equipamento vincula automaticamente os chamados abertos com aquele serial', async () => {
    const paula = await loginAs(ctx.app, 'paula');
    const marcos = await loginAs(ctx.app, 'marcos');
    const first = (await openTicket(paula, { serial: 'nb-5590' })).body.id;
    const second = (await openTicket(paula, { serial: 'NB-5590' })).body.id;
    const other = (await openTicket(paula, { serial: 'IMP-1' })).body.id;

    const pending = (await marcos.get('/api/equipment/pending')).body;
    expect(pending.map((p: { serial: string }) => p.serial).sort()).toEqual(['IMP-1', 'NB-5590']);
    expect(pending.find((p: { serial: string }) => p.serial === 'NB-5590').ticketCount).toBe(2);

    const created = await marcos.post('/api/equipment').send(await equipment('NB-5590'));
    expect(created.status).toBe(201);
    expect(created.body.linkedTickets).toBe(2);

    const linked = await ctx.prisma.ticket.findMany({ where: { equipmentId: created.body.id } });
    expect(linked.map((t) => t.id).sort()).toEqual([first, second].sort());
    expect((await ctx.prisma.ticket.findUniqueOrThrow({ where: { id: other } })).equipmentId).toBeNull();
    expect(await ctx.prisma.ticketEvent.count({ where: { type: 'EQUIPMENT_LINKED' } })).toBe(2);
    expect((await marcos.get('/api/equipment/pending')).body.map((p: { serial: string }) => p.serial)).toEqual(['IMP-1']);
  });

  it('lista equipamentos com contagem de chamados, busca por serial e histórico', async () => {
    const paula = await loginAs(ctx.app, 'paula');
    const marcos = await loginAs(ctx.app, 'marcos');
    await marcos.post('/api/equipment').send(await equipment('NB-7000'));
    await openTicket(paula, { serial: 'NB-7000' });
    await openTicket(paula, { serial: 'NB-7000' });

    const res = await marcos.get('/api/equipment?q=nb-70');
    expect(res.status).toBe(200);
    expect(res.body.items[0]).toMatchObject({ serial: 'NB-7000', ticketCount: 2, sectorName: 'Financeiro' });
    expect((await marcos.get('/api/equipment?type=PRINTER')).body.total).toBe(0);
  });

  it('valida campos obrigatórios do equipamento', async () => {
    const marcos = await loginAs(ctx.app, 'marcos');
    const base = await equipment('NB-9000');
    expect((await marcos.post('/api/equipment').send({ ...base, manufacturer: '' })).status).toBe(400);
    expect((await marcos.post('/api/equipment').send({ ...base, type: 'CARRO' })).status).toBe(400);
    expect((await marcos.post('/api/equipment').send({ ...base, sectorId: 9999 })).status).toBe(400);
  });

  it('senha padrão de teste nunca é aceita como nova senha temporária curta', async () => {
    const helena = await loginAs(ctx.app, 'helena');
    const paula = await ctx.prisma.user.findUniqueOrThrow({ where: { login: 'paula' } });
    const res = await helena.post(`/api/users/${paula.id}/reset-password`).send({ temporaryPassword: 'x' });
    expect(res.status).toBe(400);
    expect((await newAgent(ctx.app).post('/api/auth/login').send({ login: 'paula', password: DEFAULT_PASSWORD })).status).toBe(200);
  });
});
