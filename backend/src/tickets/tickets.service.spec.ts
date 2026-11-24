import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { TicketAccessPolicy } from '../access/ticket-access.policy';
import { AttachmentsService } from '../attachments/attachments.service';
import { AuthUser } from '../common/types/auth-user';
import { AppConfig } from '../config/env.validation';
import { NotificationsService } from '../notifications/notifications.service';
import { PriorityRulesService } from '../priority-rules/priority-rules.service';
import { PrismaService } from '../prisma/prisma.service';
import { TicketEventsService } from './ticket-events.service';
import { TicketsService } from './tickets.service';

const employee: AuthUser = { id: 10, name: 'Paula', email: 'p@e', login: 'paula', role: 'EMPLOYEE', sectorId: 1, mustChangePassword: false };
const technician: AuthUser = { id: 20, name: 'Marcos', email: 'm@e', login: 'marcos', role: 'TECHNICIAN', sectorId: 2, mustChangePassword: false };
const admin: AuthUser = { id: 30, name: 'Helena', email: 'h@e', login: 'helena', role: 'ADMIN', sectorId: 2, mustChangePassword: false };

function ticketRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    requesterId: 10,
    status: 'OPEN',
    priority: 'MEDIUM',
    assigneeId: null,
    closedAt: null,
    serialInformed: 'NB-1',
    ...overrides,
  };
}

function build(ticket: Record<string, unknown> = ticketRow()) {
  const tx = {
    user: { findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 10, name: 'Paula', email: 'p@e', sectorId: 1 }) },
    equipment: { findUnique: jest.fn().mockResolvedValue({ id: 4 }) },
    ticket: {
      create: jest.fn().mockResolvedValue({ id: 77 }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    ticketComment: { create: jest.fn().mockResolvedValue({}) },
  };
  const prisma = {
    category: { findUnique: jest.fn().mockResolvedValue({ id: 1, active: true }) },
    user: { findUnique: jest.fn().mockResolvedValue({ id: 20, name: 'Marcos', isActive: true, role: 'TECHNICIAN' }) },
    ticket: { findUniqueOrThrow: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const access = { loadVisibleTicket: jest.fn().mockResolvedValue(ticket) };
  const priorityRules = { suggest: jest.fn().mockResolvedValue('HIGH') };
  const attachments = {
    validateAll: jest.fn().mockReturnValue([]),
    saveAll: jest.fn().mockResolvedValue([]),
    discard: jest.fn().mockResolvedValue(undefined),
  };
  const notifications = {
    notify: jest.fn().mockResolvedValue(undefined),
    staffIds: jest.fn().mockResolvedValue([20, 30]),
  };
  const events = { record: jest.fn().mockResolvedValue({}) };
  const config = { settings: { reopenWindowHours: 72 } };
  const service = new TicketsService(
    prisma as unknown as PrismaService,
    access as unknown as TicketAccessPolicy,
    priorityRules as unknown as PriorityRulesService,
    attachments as unknown as AttachmentsService,
    notifications as unknown as NotificationsService,
    events as unknown as TicketEventsService,
    config as unknown as AppConfig,
  );
  jest.spyOn(service, 'getDetail').mockResolvedValue({} as never);
  return { service, prisma, tx, access, attachments, notifications, events };
}

const createDto = {
  description: ' Teclado falhando ',
  serial: ' nb-1 ',
  impactAffected: 'SELF',
  impactBlocking: 'LIMITED',
  impactAlternative: 'YES',
};

describe('TicketsService.create', () => {
  it('normaliza o serial, vincula o equipamento e usa a prioridade sugerida', async () => {
    const { service, tx, notifications } = build();
    await service.create(employee, createDto, undefined);
    const data = tx.ticket.create.mock.calls[0][0].data;
    expect(data.serialInformed).toBe('NB-1');
    expect(data.equipmentId).toBe(4);
    expect(data.priority).toBe('HIGH');
    expect(data.suggestedPriority).toBe('HIGH');
    expect(data.description).toBe('Teclado falhando');
    expect(notifications.notify).toHaveBeenCalled();
  });

  it('abre o chamado mesmo com serial não cadastrado', async () => {
    const { service, tx } = build();
    tx.equipment.findUnique.mockResolvedValue(null);
    await service.create(employee, createDto, undefined);
    expect(tx.ticket.create.mock.calls[0][0].data.equipmentId).toBeNull();
  });

  it('remove arquivos já gravados se a transação falhar', async () => {
    const { service, tx, attachments } = build();
    attachments.saveAll.mockImplementation(async (_tx, _files, _ctx, written: string[]) => {
      written.push('chave-1');
      return [];
    });
    tx.ticket.create.mockResolvedValue({ id: 5 });
    const failure = new Error('falha ao notificar');
    (service as unknown as { notifications: { staffIds: jest.Mock } }).notifications.staffIds.mockRejectedValue(failure);
    await expect(service.create(employee, createDto, undefined)).rejects.toBe(failure);
    expect(attachments.discard).toHaveBeenCalledWith(['chave-1']);
  });

  it('rejeita serial vazio após normalização', async () => {
    const { service } = build();
    await expect(service.create(employee, { ...createDto, serial: '   ' }, undefined)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe('TicketsService.perform', () => {
  it('rejeita reabertura após 72 horas do fechamento', async () => {
    const closedAt = new Date(Date.now() - 73 * 3_600_000);
    const { service } = build(ticketRow({ status: 'CLOSED', closedAt }));
    await expect(service.perform(employee, 1, 'REOPEN', { reason: 'voltou' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('aceita reabertura dentro do prazo e limpa a data de fechamento', async () => {
    const closedAt = new Date(Date.now() - 2 * 24 * 3_600_000);
    const { service, tx } = build(ticketRow({ status: 'CLOSED', closedAt }));
    await service.perform(employee, 1, 'REOPEN', { reason: 'voltou a falhar' });
    const call = tx.ticket.updateMany.mock.calls[0][0];
    expect(call.data).toMatchObject({ status: 'OPEN', closedAt: null });
  });

  it('responde 409 quando outra pessoa alterou o chamado antes', async () => {
    const { service, tx } = build();
    tx.ticket.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.perform(technician, 1, 'TRIAGE', {})).rejects.toBeInstanceOf(ConflictException);
  });

  it('impede o técnico de assumir chamado que já tem outro responsável', async () => {
    const { service } = build(ticketRow({ assigneeId: 99 }));
    await expect(service.perform(technician, 1, 'ASSIGN', { assigneeId: 20 })).rejects.toBeInstanceOf(ConflictException);
  });

  it('impede o técnico de atribuir a outra pessoa', async () => {
    const { service } = build();
    await expect(service.perform(technician, 1, 'ASSIGN', { assigneeId: 21 })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('permite ao administrador atribuir a um técnico ativo', async () => {
    const { service, tx } = build();
    await service.perform(admin, 1, 'ASSIGN', { assigneeId: 20 });
    expect(tx.ticket.updateMany.mock.calls[0][0].data).toMatchObject({ assigneeId: 20 });
  });

  it('exige justificativa ao alterar a prioridade na triagem', async () => {
    const { service } = build();
    await expect(service.perform(technician, 1, 'TRIAGE', { priority: 'CRITICAL' })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('registra prioridade anterior, nova e justificativa na triagem', async () => {
    const { service, events } = build();
    await service.perform(technician, 1, 'TRIAGE', { priority: 'HIGH', justification: 'Setor parado' });
    const priorityEvent = events.record.mock.calls.map((c) => c[1]).find((e) => e.type === 'PRIORITY_CHANGED');
    expect(priorityEvent.payload).toEqual({ from: 'MEDIUM', to: 'HIGH', justification: 'Setor parado' });
  });

  it('resolver registra solução, data e assume o chamado sem responsável', async () => {
    const { service, tx } = build(ticketRow({ status: 'WAITING_START' }));
    await service.perform(technician, 1, 'RESOLVE', { solution: 'Teclado trocado' });
    expect(tx.ticket.updateMany.mock.calls[0][0].data).toMatchObject({
      status: 'RESOLVED',
      solution: 'Teclado trocado',
      assigneeId: 20,
    });
  });

  it('pedir informação cria comentário público e notifica o solicitante', async () => {
    const { service, tx, notifications } = build(ticketRow({ status: 'WAITING_START', assigneeId: 20 }));
    await service.perform(technician, 1, 'REQUEST_INFO', { message: 'Qual o modelo?' });
    expect(tx.ticketComment.create.mock.calls[0][0].data).toMatchObject({ visibility: 'PUBLIC', body: 'Qual o modelo?' });
    expect(notifications.notify.mock.calls[0][1]).toEqual([10]);
  });

  it('não notifica quem executou a ação', async () => {
    const { service, notifications } = build(ticketRow({ status: 'RESOLVED', assigneeId: 10 }));
    await service.perform(employee, 1, 'CONFIRM');
    expect(notifications.notify.mock.calls[0][1]).toEqual([]);
  });

  it('proíbe o funcionário de executar ações da TI', async () => {
    const { service } = build();
    await expect(service.perform(employee, 1, 'TRIAGE', {})).rejects.toBeInstanceOf(ForbiddenException);
  });
});

describe('TicketsService.changePriority', () => {
  it('rejeita prioridade igual à atual', async () => {
    const { service } = build(ticketRow({ priority: 'HIGH' }));
    await expect(service.changePriority(technician, 1, 'HIGH', 'x')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejeita alteração em chamado fechado ou cancelado', async () => {
    const closed = build(ticketRow({ status: 'CLOSED' }));
    await expect(closed.service.changePriority(technician, 1, 'LOW', 'x')).rejects.toBeInstanceOf(ConflictException);
    const cancelled = build(ticketRow({ status: 'CANCELLED' }));
    await expect(cancelled.service.changePriority(technician, 1, 'LOW', 'x')).rejects.toBeInstanceOf(ConflictException);
  });

  it('proíbe o funcionário', async () => {
    const { service } = build();
    await expect(service.changePriority(employee, 1, 'LOW', 'x')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('grava o evento com prioridade anterior, nova, autor e justificativa', async () => {
    const { service, events } = build();
    await service.changePriority(technician, 1, 'CRITICAL', ' Rede parada ');
    const call = events.record.mock.calls[0][1];
    expect(call).toMatchObject({ type: 'PRIORITY_CHANGED', actorId: 20 });
    expect(call.payload).toEqual({ from: 'MEDIUM', to: 'CRITICAL', justification: 'Rede parada' });
  });
});

describe('TicketsService.correctSerial', () => {
  it('normaliza o serial, vincula o equipamento e registra o evento', async () => {
    const { service, tx, events } = build();
    await service.correctSerial(technician, 1, ' nb-9 ');
    expect(tx.ticket.update.mock.calls[0][0].data).toEqual({ serialInformed: 'NB-9', equipmentId: 4 });
    expect(events.record.mock.calls[0][1].type).toBe('SERIAL_CORRECTED');
  });
});
