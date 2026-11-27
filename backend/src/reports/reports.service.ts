import { Injectable } from '@nestjs/common';
import { Prisma, TicketStatus } from '@prisma/client';
import { TicketFilterValues, ticketFilterSql, ticketFilterWhere } from '../common/ticket-filters';
import { AppConfig } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { ReportPeriod } from './dto/report-period.query';

export interface CountRow {
  key: string;
  name: string;
  count: number;
}

export interface TrendPoint {
  bucket: string;
  count: number;
}

export type Granularity = 'hour' | 'day';

export interface ReportFilters extends TicketFilterValues {
  period: ReportPeriod;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
const PERIOD_DAYS: Record<Exclude<ReportPeriod, 'today'>, number> = { '7d': 7, '30d': 30, '90d': 90 };
const OPEN_STATUSES: TicketStatus[] = ['OPEN', 'WAITING_START', 'WAITING_USER'];

const DIMENSION_KEYS = {
  status: ['status'],
  priority: ['priority'],
  sector: ['sectorId'],
  category: ['categoryId', 'uncategorized'],
  technician: ['assigneeId', 'unassigned'],
  equipment: ['equipmentId'],
} as const satisfies Record<string, (keyof TicketFilterValues)[]>;

export function withoutDimension(
  filters: TicketFilterValues,
  dimension: keyof typeof DIMENSION_KEYS,
): TicketFilterValues {
  const rest: TicketFilterValues = { ...filters };
  for (const key of DIMENSION_KEYS[dimension]) delete rest[key];
  return rest;
}

export function periodStart(period: ReportPeriod, now: Date, timeZone: string): Date {
  if (period !== 'today') return new Date(now.getTime() - PERIOD_DAYS[period] * DAY_MS);
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

export function bucketKey(date: Date, granularity: Granularity, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  const day = `${part('year')}-${part('month')}-${part('day')}`;
  return granularity === 'hour' ? `${day}T${part('hour')}` : day;
}

export function fillTrend(
  rows: TrendPoint[],
  from: Date,
  now: Date,
  granularity: Granularity,
  timeZone: string,
): TrendPoint[] {
  const counts = new Map(rows.map((row) => [row.bucket, row.count]));
  const step = granularity === 'hour' ? HOUR_MS : DAY_MS;
  const keys: string[] = [];
  for (let time = from.getTime(); time <= now.getTime(); time += step) {
    const key = bucketKey(new Date(time), granularity, timeZone);
    if (!keys.includes(key)) keys.push(key);
  }
  const last = bucketKey(now, granularity, timeZone);
  if (!keys.includes(last)) keys.push(last);
  return keys.map((bucket) => ({ bucket, count: counts.get(bucket) ?? 0 }));
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  async summary(filters: ReportFilters, now: Date = new Date()) {
    const timeZone = this.config.settings.appTimezone;
    const from = periodStart(filters.period, now, timeZone);
    const granularity: Granularity = filters.period === 'today' ? 'hour' : 'day';
    const dimensions = ticketFilterWhere(filters);
    const inPeriod = { createdAt: { gte: from } };
    const where: Prisma.TicketWhereInput = { ...dimensions, ...inPeriod };
    const crossWhere = (dimension: keyof typeof DIMENSION_KEYS): Prisma.TicketWhereInput => ({
      ...ticketFilterWhere(withoutDimension(filters, dimension)),
      ...inPeriod,
    });
    const sqlFilters = ticketFilterSql(filters);
    const sqlFormat = granularity === 'hour' ? 'YYYY-MM-DD"T"HH24' : 'YYYY-MM-DD';

    const [byStatus, byPriority, bySector, byCategory, byAssignee, byEquipment, unassignedNow, avg, trend] =
      await Promise.all([
        this.prisma.ticket.groupBy({ by: ['status'], where: crossWhere('status'), _count: { _all: true } }),
        this.prisma.ticket.groupBy({ by: ['priority'], where: crossWhere('priority'), _count: { _all: true } }),
        this.prisma.ticket.groupBy({ by: ['sectorId'], where: crossWhere('sector'), _count: { _all: true } }),
        this.prisma.ticket.groupBy({ by: ['categoryId'], where: crossWhere('category'), _count: { _all: true } }),
        this.prisma.ticket.groupBy({ by: ['assigneeId'], where: crossWhere('technician'), _count: { _all: true } }),
        this.prisma.ticket.groupBy({
          by: ['equipmentId'],
          where: { ...crossWhere('equipment'), equipmentId: { not: null } },
          _count: { _all: true },
          orderBy: { _count: { id: 'desc' } },
          take: 10,
        }),
        this.prisma.ticket.count({
          where: { AND: [dimensions, { assigneeId: null, status: { in: OPEN_STATUSES } }] },
        }),
        this.prisma.$queryRaw<{ avg: number | null }[]>(Prisma.sql`
          SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)))::float8 AS avg
          FROM tickets
          WHERE resolved_at IS NOT NULL
            AND resolved_at >= ${from}
            AND status IN ('RESOLVED', 'CLOSED')
            AND ${sqlFilters}
        `),
        this.prisma.$queryRaw<TrendPoint[]>(Prisma.sql`
          SELECT to_char(date_trunc(${granularity}, (created_at AT TIME ZONE 'UTC') AT TIME ZONE ${timeZone}), ${sqlFormat}) AS bucket,
                 COUNT(*)::int AS count
          FROM tickets
          WHERE created_at >= ${from}
            AND ${sqlFilters}
          GROUP BY 1
          ORDER BY 1
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
    const selected = statusRows.filter((r) => !filters.status || r.key === filters.status);
    const total = selected.reduce((sum, r) => sum + r.count, 0);
    const resolvedOrClosed = selected
      .filter((r) => r.key === 'RESOLVED' || r.key === 'CLOSED')
      .reduce((sum, r) => sum + r.count, 0);
    const byCount = (a: CountRow, b: CountRow) => b.count - a.count;

    return {
      period: filters.period,
      from,
      to: now,
      granularity,
      totals: {
        total,
        resolvedOrClosed,
        unassignedNow,
        avgResolutionSeconds: avg[0]?.avg ?? null,
      },
      trend: fillTrend(trend, from, now, granularity, timeZone),
      byStatus: statusRows,
      byPriority: byPriority.map((r) => ({ key: r.priority, name: r.priority, count: r._count._all })),
      bySector: bySector
        .map((r) => ({
          key: String(r.sectorId),
          name: sectors.find((s) => s.id === r.sectorId)?.name ?? 'Desconhecido',
          count: r._count._all,
        }))
        .sort(byCount),
      byCategory: byCategory
        .map((r) => ({
          key: String(r.categoryId),
          name: categories.find((c) => c.id === r.categoryId)?.name ?? 'Sem categoria',
          count: r._count._all,
        }))
        .sort(byCount),
      byTechnician: byAssignee
        .map((r) => ({
          key: String(r.assigneeId),
          name: assignees.find((u) => u.id === r.assigneeId)?.name ?? 'Sem responsável',
          count: r._count._all,
        }))
        .sort(byCount),
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
