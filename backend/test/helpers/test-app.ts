import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, Role, User } from '@prisma/client';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { PrismaService } from '../../src/prisma/prisma.service';
import { execSync } from 'child_process';
import { seedReferenceData } from '../../prisma/seed-reference';

export const DEFAULT_PASSWORD = 'senha-de-teste-123';

export interface TestContext {
  app: INestApplication;
  prisma: PrismaService;
}

export type Agent = ReturnType<typeof request.agent>;

export async function createTestApp(): Promise<TestContext> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
  `;
  const list = tables.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  await seedReferenceData(prisma);
}

export interface UserSpec {
  login: string;
  role: Role;
  name?: string;
  sectorName?: string;
  mustChangePassword?: boolean;
  isActive?: boolean;
  password?: string;
}

export async function createUser(prisma: PrismaClient, spec: UserSpec): Promise<User> {
  const sector = await prisma.sector.findUniqueOrThrow({ where: { name: spec.sectorName ?? 'Financeiro' } });
  return prisma.user.create({
    data: {
      name: spec.name ?? spec.login,
      email: `${spec.login}@empresa.example`,
      login: spec.login,
      role: spec.role,
      sectorId: sector.id,
      passwordHash: await argon2.hash(spec.password ?? DEFAULT_PASSWORD, { type: argon2.argon2id }),
      mustChangePassword: spec.mustChangePassword ?? false,
      isActive: spec.isActive ?? true,
    },
  });
}

export function runDemoSeed(): void {
  execSync('npx ts-node prisma/seed.ts', {
    stdio: 'inherit',
    env: { ...process.env, SEED_PASSWORD: DEFAULT_PASSWORD },
  });
}

export function newAgent(app: INestApplication): Agent {
  const agent = request.agent(app.getHttpServer());
  agent.set('X-Requested-With', 'jest');
  return agent;
}

export async function loginAs(app: INestApplication, login: string, password = DEFAULT_PASSWORD): Promise<Agent> {
  const agent = newAgent(app);
  const res = await agent.post('/api/auth/login').send({ login, password });
  if (res.status !== 200) throw new Error(`Login de ${login} falhou: ${res.status} ${JSON.stringify(res.body)}`);
  return agent;
}

export const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02]);

export interface TicketOverrides {
  description?: string;
  serial?: string;
  impactAffected?: string;
  impactBlocking?: string;
  impactAlternative?: string;
  title?: string;
}

export function openTicket(agent: Agent, overrides: TicketOverrides = {}) {
  return agent
    .post('/api/tickets')
    .field('description', overrides.description ?? 'Teclado com teclas falhando')
    .field('serial', overrides.serial ?? 'NB-48213')
    .field('impactAffected', overrides.impactAffected ?? 'SELF')
    .field('impactBlocking', overrides.impactBlocking ?? 'LIMITED')
    .field('impactAlternative', overrides.impactAlternative ?? 'YES')
    .field('title', overrides.title ?? 'Teclado com defeito');
}
