import { AppConfig } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService, fillTrend, periodStart } from './reports.service';

describe('periodStart', () => {
  const now = new Date('2026-11-24T15:30:45.000Z');

  it('"7d", "30d" e "90d" contam dias corridos até agora', () => {
    expect(periodStart('7d', now, 'America/Sao_Paulo').toISOString()).toBe('2026-11-17T15:30:45.000Z');
    expect(periodStart('30d', now, 'America/Sao_Paulo').toISOString()).toBe('2026-10-25T15:30:45.000Z');
    expect(periodStart('90d', now, 'America/Sao_Paulo').toISOString()).toBe('2026-08-26T15:30:45.000Z');
  });

  it('"today" começa à 00:00 no fuso configurado', () => {
    expect(periodStart('today', now, 'America/Sao_Paulo').toISOString()).toBe('2026-11-24T03:00:00.000Z');
  });

  it('"today" considera o dia local quando o UTC já virou o dia', () => {
    const lateUtc = new Date('2026-11-25T01:00:00.000Z');
    expect(periodStart('today', lateUtc, 'America/Sao_Paulo').toISOString()).toBe('2026-11-24T03:00:00.000Z');
  });

  it('"today" em UTC começa à meia-noite UTC', () => {
    expect(periodStart('today', now, 'UTC').toISOString()).toBe('2026-11-24T00:00:00.000Z');
  });
});

describe('ReportsService.summary', () => {
  it('agrega contadores, nomes e tempo médio', async () => {
    const prisma = {
      ticket: {
        groupBy: jest
          .fn()
          .mockResolvedValueOnce([
            { status: 'OPEN', _count: { _all: 2 } },
            { status: 'CLOSED', _count: { _all: 3 } },
          ])
          .mockResolvedValueOnce([{ priority: 'HIGH', _count: { _all: 5 } }])
          .mockResolvedValueOnce([{ sectorId: 1, _count: { _all: 5 } }])
          .mockResolvedValueOnce([{ categoryId: null, _count: { _all: 5 } }])
          .mockResolvedValueOnce([
            { assigneeId: 9, _count: { _all: 3 } },
            { assigneeId: null, _count: { _all: 2 } },
          ])
          .mockResolvedValueOnce([{ equipmentId: 4, _count: { _all: 2 } }]),
        count: jest.fn().mockResolvedValue(2),
      },
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ avg: 93600 }])
        .mockResolvedValueOnce([{ bucket: '2026-11-23', count: 5 }]),
      sector: { findMany: jest.fn().mockResolvedValue([{ id: 1, name: 'Financeiro' }]) },
      category: { findMany: jest.fn().mockResolvedValue([]) },
      user: { findMany: jest.fn().mockResolvedValue([{ id: 9, name: 'Marcos Teixeira' }]) },
      equipment: { findMany: jest.fn().mockResolvedValue([{ id: 4, serial: 'NB-1', manufacturer: 'Dell', model: 'L5420' }]) },
    };
    const config = { settings: { appTimezone: 'America/Sao_Paulo' } };
    const service = new ReportsService(prisma as unknown as PrismaService, config as unknown as AppConfig);

    const result = await service.summary({ period: '7d' }, new Date('2026-11-24T12:00:00.000Z'));

    expect(result.totals).toEqual({ total: 5, resolvedOrClosed: 3, unassignedNow: 2, avgResolutionSeconds: 93600 });
    expect(result.bySector).toEqual([{ key: '1', name: 'Financeiro', count: 5 }]);
    expect(result.byCategory[0].name).toBe('Sem categoria');
    expect(result.byTechnician.map((r) => r.name)).toEqual(['Marcos Teixeira', 'Sem responsável']);
    expect(result.topEquipment[0].name).toBe('NB-1 · Dell L5420');
    expect(result.byPriority).toEqual([{ key: 'HIGH', name: 'HIGH', count: 5 }]);
    expect(result.trend).toHaveLength(8);
    expect(result.trend.find((p) => p.bucket === '2026-11-23')?.count).toBe(5);
    expect(result.trend.filter((p) => p.count === 0)).toHaveLength(7);
  });
});

describe('fillTrend', () => {
  it('preenche com zero os dias sem chamados, no fuso configurado', () => {
    const from = new Date('2026-11-21T15:00:00.000Z');
    const now = new Date('2026-11-24T15:00:00.000Z');
    const filled = fillTrend([{ bucket: '2026-11-22', count: 4 }], from, now, 'day', 'America/Sao_Paulo');
    expect(filled).toEqual([
      { bucket: '2026-11-21', count: 0 },
      { bucket: '2026-11-22', count: 4 },
      { bucket: '2026-11-23', count: 0 },
      { bucket: '2026-11-24', count: 0 },
    ]);
  });

  it('agrupa por hora no período de hoje', () => {
    const from = new Date('2026-11-24T03:00:00.000Z');
    const now = new Date('2026-11-24T06:30:00.000Z');
    const filled = fillTrend([], from, now, 'hour', 'America/Sao_Paulo');
    expect(filled.map((p) => p.bucket)).toEqual(['2026-11-24T00', '2026-11-24T01', '2026-11-24T02', '2026-11-24T03']);
  });
});
