import { fakerPT_BR as faker } from '@faker-js/faker';
import { EquipmentType, EventType, Prisma, PrismaClient, Role, TicketStatus, User } from '@prisma/client';
import * as argon2 from 'argon2';
import {
  DEFAULT_THRESHOLDS,
  DEFAULT_WEIGHTS,
  IMPACT_OPTIONS,
  scoreAnswers,
  suggestPriority,
} from '../src/priority-rules/priority.util';
import { SECTORS, seedReferenceData } from './seed-reference';

const TICKET_COUNT = 500;
const HOUR = 3_600_000;

const STAFF = [
  { name: 'Helena Duarte', login: 'helena', role: 'ADMIN' as Role },
  { name: 'Marcos Teixeira', login: 'marcos', role: 'TECHNICIAN' as Role },
  { name: 'Julia Prado', login: 'julia', role: 'TECHNICIAN' as Role },
];

const EMPLOYEES = [
  ['Paula Ribeiro', 'paula'],
  ['Carlos Menezes', 'carlos'],
  ['Renata Alves', 'renata'],
  ['Diego Farias', 'diego'],
  ['Fernanda Lima', 'fernanda'],
  ['Bruno Cardoso', 'bruno'],
  ['Larissa Moura', 'larissa'],
  ['Tiago Nogueira', 'tiago'],
  ['Camila Rocha', 'camila'],
  ['Eduardo Pires', 'eduardo'],
  ['Juliana Castro', 'juliana'],
  ['Renato Siqueira', 'renato'],
];

const PROBLEMS = [
  'Sem acesso ao sistema financeiro',
  'Impressora não imprime',
  'Notebook reinicia sozinho',
  'Mouse sem resposta',
  'Lentidão na rede do setor',
  'Instalar leitor de PDF',
  'Teclado com teclas falhando',
  'Monitor sem imagem',
  'Esqueci a senha do e-mail',
  'Wi-Fi caindo na sala de reunião',
  'Planilha de custos não abre',
  'Bateria do notebook não carrega',
];

const MODELS: Record<EquipmentType, { manufacturer: string; model: string; prefix: string }[]> = {
  NOTEBOOK: [
    { manufacturer: 'Dell', model: 'Latitude 5420', prefix: 'NB' },
    { manufacturer: 'Lenovo', model: 'ThinkPad E14', prefix: 'NB' },
  ],
  DESKTOP: [{ manufacturer: 'HP', model: 'ProDesk 400', prefix: 'DT' }],
  PRINTER: [{ manufacturer: 'HP', model: 'LaserJet M404', prefix: 'IMP' }],
  PERIPHERAL: [
    { manufacturer: 'Logitech', model: 'M170', prefix: 'PER' },
    { manufacturer: 'Logitech', model: 'K120', prefix: 'PER' },
  ],
  OTHER: [{ manufacturer: 'Genérico', model: 'Equipamento', prefix: 'OUT' }],
};

function pick<T>(items: T[]): T {
  return items[faker.number.int({ min: 0, max: items.length - 1 })];
}

function pickState(): TicketStatus {
  const roll = faker.number.int({ min: 1, max: 100 });
  if (roll <= 12) return 'OPEN';
  if (roll <= 32) return 'WAITING_START';
  if (roll <= 40) return 'WAITING_USER';
  if (roll <= 52) return 'RESOLVED';
  if (roll <= 94) return 'CLOSED';
  return 'CANCELLED';
}

export async function seedDemo(prisma: PrismaClient, password: string): Promise<void> {
  faker.seed(42);
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const sectors = await prisma.sector.findMany();
  const sectorByName = new Map(sectors.map((s) => [s.name, s.id]));
  const categories = await prisma.category.findMany();

  const staffRows: User[] = [];
  for (const person of STAFF) {
    staffRows.push(
      await prisma.user.create({
        data: {
          name: person.name,
          email: `${person.login}@empresa.example`,
          login: person.login,
          role: person.role,
          sectorId: sectorByName.get('TI')!,
          passwordHash,
          mustChangePassword: false,
        },
      }),
    );
  }
  const technicians = staffRows.filter((u) => u.role === 'TECHNICIAN');

  const employeeRows = [];
  const employeeSectors = SECTORS.filter((s) => s !== 'TI');
  for (const [index, [name, login]] of EMPLOYEES.entries()) {
    const inactive = login === 'renato';
    employeeRows.push(
      await prisma.user.create({
        data: {
          name,
          email: `${login}@empresa.example`,
          login,
          role: 'EMPLOYEE',
          sectorId: sectorByName.get(employeeSectors[index % employeeSectors.length])!,
          passwordHash,
          mustChangePassword: false,
          isActive: !inactive,
          deactivatedAt: inactive ? new Date() : null,
          deactivatedById: inactive ? staffRows[0].id : null,
        },
      }),
    );
  }

  const equipmentRows = [];
  const types = Object.keys(MODELS) as EquipmentType[];
  for (let i = 0; i < 40; i += 1) {
    const type = types[i % types.length];
    const spec = pick(MODELS[type]);
    equipmentRows.push(
      await prisma.equipment.create({
        data: {
          serial: `${spec.prefix}-${String(10000 + i * 7)}`,
          type,
          manufacturer: spec.manufacturer,
          model: spec.model,
          sectorId: pick(sectors).id,
          responsibleId: pick(employeeRows).id,
        },
      }),
    );
  }

  const now = Date.now();
  const ticketData: Prisma.TicketCreateManyInput[] = [];
  const plans: { status: TicketStatus; createdAt: Date; assigneeId: number | null; times: Record<string, Date> }[] = [];

  for (let i = 0; i < TICKET_COUNT; i += 1) {
    const requester = pick(employeeRows);
    const status = pickState();
    const createdAt = new Date(now - faker.number.int({ min: 2, max: 60 * 24 }) * HOUR);
    const assignedAt = new Date(createdAt.getTime() + faker.number.int({ min: 1, max: 6 }) * HOUR);
    const resolvedAt = new Date(assignedAt.getTime() + faker.number.int({ min: 1, max: 72 }) * HOUR);
    const closedAt = new Date(resolvedAt.getTime() + faker.number.int({ min: 1, max: 48 }) * HOUR);
    const cancelledAt = new Date(createdAt.getTime() + faker.number.int({ min: 1, max: 24 }) * HOUR);
    const capped = (date: Date): Date => (date.getTime() > now ? new Date(now - HOUR) : date);

    const assigneeId =
      status === 'OPEN' ? (faker.number.int({ min: 1, max: 100 }) <= 85 ? null : pick(technicians).id) : pick(technicians).id;
    const answers = {
      affected: pick(IMPACT_OPTIONS.AFFECTED),
      blocking: pick(IMPACT_OPTIONS.BLOCKING),
      alternative: pick(IMPACT_OPTIONS.ALTERNATIVE),
    };
    const suggested = suggestPriority(scoreAnswers(DEFAULT_WEIGHTS, answers), DEFAULT_THRESHOLDS);
    const equipment = faker.number.int({ min: 1, max: 100 }) <= 85 ? pick(equipmentRows) : null;
    const resolved = status === 'RESOLVED' || status === 'CLOSED';

    ticketData.push({
      requesterId: requester.id,
      requesterName: requester.name,
      requesterEmail: requester.email,
      sectorId: requester.sectorId,
      title: pick(PROBLEMS),
      description: `${faker.lorem.sentence()} ${faker.lorem.sentence()}`,
      categoryId: faker.number.int({ min: 1, max: 100 }) <= 90 ? pick(categories).id : null,
      serialInformed: equipment ? equipment.serial : `NB-9${faker.number.int({ min: 1000, max: 9999 })}`,
      equipmentId: equipment?.id ?? null,
      assigneeId,
      assignedAt: assigneeId ? capped(assignedAt) : null,
      impactAffected: answers.affected,
      impactBlocking: answers.blocking,
      impactAlternative: answers.alternative,
      suggestedPriority: suggested,
      priority: suggested,
      status,
      solution: resolved ? 'Problema analisado e corrigido pela equipe de TI.' : null,
      resolvedAt: resolved ? capped(resolvedAt) : null,
      closedAt: status === 'CLOSED' ? capped(closedAt) : null,
      cancelledAt: status === 'CANCELLED' ? capped(cancelledAt) : null,
      createdAt,
    });
    plans.push({
      status,
      createdAt,
      assigneeId,
      times: {
        assignedAt: capped(assignedAt),
        resolvedAt: capped(resolvedAt),
        closedAt: capped(closedAt),
        cancelledAt: capped(cancelledAt),
      },
    });
  }

  const created = await prisma.ticket.createManyAndReturn({ data: ticketData, select: { id: true, requesterId: true } });

  const events: Prisma.TicketEventCreateManyInput[] = [];
  const comments: Prisma.TicketCommentCreateManyInput[] = [];
  const addEvent = (
    ticketId: number,
    type: EventType,
    actorId: number | null,
    createdAt: Date,
    visible: boolean,
    payload: Prisma.InputJsonObject = {},
  ): void => {
    events.push({ ticketId, type, actorId, createdAt, requesterVisible: visible, payload });
  };

  created.forEach((ticket, index) => {
    const plan = plans[index];
    addEvent(ticket.id, 'CREATED', ticket.requesterId, plan.createdAt, true);
    if (plan.assigneeId) addEvent(ticket.id, 'ASSIGNED', plan.assigneeId, plan.times.assignedAt, true, { assigneeId: plan.assigneeId });
    if (plan.status !== 'OPEN' && plan.status !== 'CANCELLED' && plan.assigneeId) {
      addEvent(ticket.id, 'TRIAGED', plan.assigneeId, plan.times.assignedAt, true, { from: 'OPEN', to: 'WAITING_START' });
    }
    if ((plan.status === 'RESOLVED' || plan.status === 'CLOSED') && plan.assigneeId) {
      addEvent(ticket.id, 'RESOLVED', plan.assigneeId, plan.times.resolvedAt, true, { reason: 'Problema corrigido.' });
    }
    if (plan.status === 'CLOSED') addEvent(ticket.id, 'CLOSED', ticket.requesterId, plan.times.closedAt, true);
    if (plan.status === 'CANCELLED') {
      addEvent(ticket.id, 'CANCELLED', ticket.requesterId, plan.times.cancelledAt, true, { reason: 'Não é mais necessário.' });
    }
    if (plan.assigneeId && faker.number.int({ min: 1, max: 100 }) <= 35) {
      comments.push({
        ticketId: ticket.id,
        authorId: plan.assigneeId,
        body: 'Olá! Estou verificando o seu chamado e retorno em breve.',
        visibility: 'PUBLIC',
        createdAt: plan.times.assignedAt,
      });
    }
    if (plan.assigneeId && faker.number.int({ min: 1, max: 100 }) <= 10) {
      comments.push({
        ticketId: ticket.id,
        authorId: plan.assigneeId,
        body: 'Nota interna: verificar histórico do equipamento antes de trocar peças.',
        visibility: 'INTERNAL',
        createdAt: plan.times.assignedAt,
      });
    }
  });

  await prisma.ticketEvent.createMany({ data: events });
  await prisma.ticketComment.createMany({ data: comments });

  const openUnassigned = created.filter((_, index) => plans[index].status === 'OPEN' && !plans[index].assigneeId).slice(0, 5);
  await prisma.notification.createMany({
    data: openUnassigned.flatMap((ticket) =>
      staffRows.map((staff) => ({
        userId: staff.id,
        ticketId: ticket.id,
        type: 'TICKET_CREATED',
        message: `Novo chamado CH-${String(ticket.id).padStart(6, '0')} aguardando atendimento.`,
      })),
    ),
  });
}

export async function seedIfEmpty(prisma: PrismaClient, password: string): Promise<boolean> {
  if ((await prisma.user.count()) > 0) return false;
  await seedReferenceData(prisma);
  await seedDemo(prisma, password);
  return true;
}

async function main(): Promise<void> {
  const password = process.env.SEED_PASSWORD;
  if (!password) throw new Error('Defina SEED_PASSWORD para criar os usuários de demonstração.');
  const prisma = new PrismaClient();
  try {
    const seeded = await seedIfEmpty(prisma, password);
    console.log(seeded ? 'Seed concluído.' : 'Banco já possui dados; seed ignorado.');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
