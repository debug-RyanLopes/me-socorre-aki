import { readdirSync } from 'fs';
import { PNG, TestContext, createTestApp, createUser, loginAs, openTicket, resetDatabase } from './helpers/test-app';

const PDF = Buffer.from('%PDF-1.7\n%conteudo de teste\n', 'latin1');
const EXE = Buffer.from('MZ\x90\x00\x03\x00\x00\x00', 'latin1');

describe('Anexos (e2e)', () => {
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
  });

  const storedFiles = () => readdirSync(process.env.UPLOAD_DIR!).length;

  it('aceita PNG e PDF na abertura, grava em disco e permite o download ao solicitante', async () => {
    const paula = await loginAs(ctx.app, 'paula');
    const before = storedFiles();
    const res = await openTicket(paula).attach('files', PNG, 'erro.png').attach('files', PDF, 'relatorio.pdf');
    expect(res.status).toBe(201);
    expect(res.body.attachments).toHaveLength(2);
    expect(storedFiles()).toBe(before + 2);

    const png = res.body.attachments.find((a: { originalName: string }) => a.originalName === 'erro.png');
    const download = await paula.get(`/api/attachments/${png.id}`).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(download.status).toBe(200);
    expect(download.headers['content-type']).toContain('image/png');
    expect(download.headers['x-content-type-options']).toBe('nosniff');
    expect(Buffer.compare(download.body as Buffer, PNG)).toBe(0);

    const stored = await ctx.prisma.attachment.findFirstOrThrow({ where: { originalName: 'erro.png' } });
    expect(stored.storageKey).toMatch(/^[0-9a-f-]{36}$/);
    expect(stored.storageKey).not.toContain('erro');
  });

  it('AT-013: executável renomeado para .png é rejeitado e nenhum chamado é criado', async () => {
    const paula = await loginAs(ctx.app, 'paula');
    const before = storedFiles();
    const res = await openTicket(paula).attach('files', EXE, 'foto.png');
    expect(res.status).toBe(400);
    expect(await ctx.prisma.ticket.count()).toBe(0);
    expect(storedFiles()).toBe(before);
  });

  it('rejeita extensão não permitida e arquivo vazio', async () => {
    const paula = await loginAs(ctx.app, 'paula');
    expect((await openTicket(paula).attach('files', PNG, 'imagem.gif')).status).toBe(400);
    expect((await openTicket(paula).attach('files', Buffer.alloc(0), 'vazio.png')).status).toBe(400);
    expect(await ctx.prisma.ticket.count()).toBe(0);
  });

  it('rejeita arquivo acima de 5 MB', async () => {
    const paula = await loginAs(ctx.app, 'paula');
    const big = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
    const res = await openTicket(paula).attach('files', big, 'grande.png');
    expect([400, 413]).toContain(res.status);
    expect(await ctx.prisma.ticket.count()).toBe(0);
  });

  it('rejeita mais de 5 arquivos por envio', async () => {
    const paula = await loginAs(ctx.app, 'paula');
    let req = openTicket(paula);
    for (let i = 0; i < 6; i += 1) req = req.attach('files', PNG, `img${i}.png`);
    const res = await req;
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    expect(await ctx.prisma.ticket.count()).toBe(0);
  });

  it('anexo de comentário público é visível ao funcionário; outro funcionário não baixa', async () => {
    const paula = await loginAs(ctx.app, 'paula');
    const carlos = await loginAs(ctx.app, 'carlos');
    const marcos = await loginAs(ctx.app, 'marcos');
    const id = (await openTicket(paula)).body.id;

    const comment = await marcos.post(`/api/tickets/${id}/comments`).field('body', 'Segue o guia').attach('files', PDF, 'guia.pdf');
    expect(comment.status).toBe(201);
    const attachmentId = comment.body.attachments[0].id;

    expect((await paula.get(`/api/attachments/${attachmentId}`)).status).toBe(200);
    expect((await carlos.get(`/api/attachments/${attachmentId}`)).status).toBe(404);
    expect((await paula.get('/api/attachments/99999')).status).toBe(404);
  });

  it('download exige autenticação', async () => {
    const paula = await loginAs(ctx.app, 'paula');
    const res = await openTicket(paula).attach('files', PNG, 'erro.png');
    const anonymous = (await import('./helpers/test-app')).newAgent(ctx.app);
    expect((await anonymous.get(`/api/attachments/${res.body.attachments[0].id}`)).status).toBe(401);
  });
});
