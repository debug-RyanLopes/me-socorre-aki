import { PrismaClient } from '@prisma/client';
import { DEFAULT_THRESHOLDS, DEFAULT_WEIGHTS } from '../src/priority-rules/priority.util';

export const SECTORS = ['Financeiro', 'RH', 'Comercial', 'Operações', 'TI'];
export const CATEGORIES = ['Hardware', 'Software', 'Rede', 'Acesso', 'Impressoras e periféricos'];

export async function seedReferenceData(prisma: PrismaClient): Promise<void> {
  for (const name of SECTORS) {
    await prisma.sector.upsert({ where: { name }, update: {}, create: { name } });
  }
  for (const name of CATEGORIES) {
    await prisma.category.upsert({ where: { name }, update: {}, create: { name } });
  }
  await prisma.priorityWeight.deleteMany();
  await prisma.priorityThreshold.deleteMany();
  await prisma.priorityWeight.createMany({ data: DEFAULT_WEIGHTS });
  await prisma.priorityThreshold.createMany({ data: DEFAULT_THRESHOLDS });
}
