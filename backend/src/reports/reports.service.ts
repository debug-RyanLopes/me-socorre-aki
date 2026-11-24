import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AppConfig } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { ReportPeriod } from './dto/report-period.query';

export interface CountRow {
  key: string;
  name: string;
  count: number;
}

const DAY_MS = 86_400_000;

export function periodStart(period: ReportPeriod, now: Date, timeZone: string): Date {
  if (period === '7d') return new Date(now.getTime() - 7 * DAY_MS);
  if (period === '30d') return new Date(now.getTime() - 30 * DAY_MS);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: string): number => Number(parts.find((p) => p.type === type)?.value);
  const localAsUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
  const offset = localAsUtc - Math.floor(now.getTime() / 1000) * 1000;
  return new Date(Date.UTC(part('year'), part('month') - 1, part('day')) - offset);
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  async summary(period: ReportPeriod, now: Date = new Date()) {
    const from = periodStart(period, now, this.config.settings.appTimezone);
    const where: Prisma.TicketWhereInput = { createdAt: { gte: from } };

    const [byStatus, bySector, byCategory, byAssignee, byEquipment, unassignedNow, avg] = await Promise.all([
      this.prisma.ticket.groupBy({ by: ['status'], where, _count: { _all: true } }),
      this.prisma.ticket.groupBy({ by: ['sectorId'], where, _count: { _all: true } }),
      this.prisma.ticket.groupBy({ by: ['categoryId'], where, _count: { _all: true } }),
      this.prisma.ticket.groupBy({ by: ['assigneeId'], where, _count: { _all: true } }),
      this.prisma.ticket.groupBy({
        by: ['equipmentId'],
        where: { ...where, equipmentId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
      this.prisma.ticket.count({
        where: { assigneeId: null, status: { in: ['OPEN', 'WAITING_START', 'WAITING_USER'] } },
      }),
      this.prisma.$queryRaw<{ avg: number | null }[]>(Prisma.sql`
        SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)))::float8 AS avg
        FROM tickets
        WHERE resolved_at IS NOT NULL
          AND resolved_at >= ${from}
          AND status IN ('RESOLVED', 'CLOSED')
      `),
    ]);

    const [sectors, categories, assignees, equipment] = await Promise.all([
      this.prisma.sector.findMany({ where: { id: { in: bySector.map((r) => r.sectorId) } } }),
      this.prisma.category.findMany({
        where: { id: { in: byCategory.flatMap((r) => (r.categoryId === null ? [] : [r.categoryId])) } },
      }),
      this.prisma.user.findMany({
        where: { id: { in: byAssignee.flatMap((r) => (r.assigneeId === null ? [] : [r.assigneeId])) } },
      }),
      this.prisma.equipment.findMany({
        where: { id: { in: byEquipment.flatMap((r) => (r.equipmentId === null ? [] : [r.equipmentId])) } },
      }),
    ]);

    const statusRows: CountRow[] = byStatus.map((r) => ({ key: r.status, name: r.status, count: r._count._all }));
    const total = statusRows.reduce((sum, r) => sum + r.count, 0);
    const resolvedOrClosed = statusRows
      .filter((r) => r.key === 'RESOLVED' || r.key === 'CLOSED')
      .reduce((sum, r) => sum + r.count, 0);

    return {
      period,
      from,
      to: now,
      totals: {
        total,
        resolvedOrClosed,
        unassignedNow,
        avgResolutionSeconds: avg[0]?.avg ?? null,
      },
      byStatus: statusRows,
      bySector: bySector
        .map((r) => ({
          key: String(r.sectorId),
          name: sectors.find((s) => s.id === r.sectorId)?.name ?? 'Desconhecido',
          count: r._count._all,
        }))
        .sort((a, b) => b.count - a.count),
      byCategory: byCategory
        .map((r) => ({
          key: String(r.categoryId),
          name: categories.find((c) => c.id === r.categoryId)?.name ?? 'Sem categoria',
          count: r._count._all,
        }))
        .sort((a, b) => b.count - a.count),
      byTechnician: byAssignee
        .map((r) => ({
          key: String(r.assigneeId),
          name: assignees.find((u) => u.id === r.assigneeId)?.name ?? 'Sem responsável',
          count: r._count._all,
        }))
        .sort((a, b) => b.count - a.count),
      topEquipment: byEquipment.map((r) => {
        const item = equipment.find((e) => e.id === r.equipmentId);
        return {
          key: String(r.equipmentId),
          name: item ? `${item.serial} · ${item.manufacturer} ${item.model}` : 'Desconhecido',
          count: r._count._all,
        };
      }),
    };
  }
}
