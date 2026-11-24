import { ConflictException, ForbiddenException } from '@nestjs/common';
import { TicketAccessPolicy } from '../access/ticket-access.policy';
import { AttachmentsService } from '../attachments/attachments.service';
import { AuthUser } from '../common/types/auth-user';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { CommentsService } from './comments.service';

const employee: AuthUser = { id: 10, name: 'Paula', email: 'p@e', login: 'paula', role: 'EMPLOYEE', sectorId: 1, mustChangePassword: false };
const technician: AuthUser = { id: 20, name: 'Marcos', email: 'm@e', login: 'marcos', role: 'TECHNICIAN', sectorId: 2, mustChangePassword: false };

function build(ticket: Record<string, unknown>) {
  const tx = {
    ticketComment: { create: jest.fn().mockResolvedValue({ id: 5 }) },
    ticket: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    ticketEvent: { create: jest.fn().mockResolvedValue({}) },
  };
  const comment = {
    id: 5,
    ticketId: 1,
    body: 'x',
    visibility: 'PUBLIC',
    createdAt: new Date(),
    author: { id: 10, name: 'Paula', role: 'EMPLOYEE' },
    attachments: [],
  };
  const prisma = {
    ticketComment: { findUniqueOrThrow: jest.fn().mockResolvedValue(comment), findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  const access = {
    loadVisibleTicket: jest.fn().mockResolvedValue(ticket),
    allowedVisibilities: jest.fn((user: AuthUser) => (user.role === 'EMPLOYEE' ? ['PUBLIC'] : ['PUBLIC', 'INTERNAL'])),
  };
  const attachments = {
    validateAll: jest.fn().mockReturnValue([]),
    saveAll: jest.fn().mockResolvedValue([]),
    discard: jest.fn().mockResolvedValue(undefined),
  };
  const notifications = { notify: jest.fn().mockResolvedValue(undefined), staffIds: jest.fn().mockResolvedValue([20, 30]) };
  const service = new CommentsService(
    prisma as unknown as PrismaService,
    access as unknown as TicketAccessPolicy,
    attachments as unknown as AttachmentsService,
    notifications as unknown as NotificationsService,
  );
  return { service, tx, prisma, access, notifications };
}

const baseTicket = { id: 1, requesterId: 10, assigneeId: 20, status: 'WAITING_START' };

describe('CommentsService.create', () => {
  it('proíbe o funcionário de criar observação interna', async () => {
    const { service } = build(baseTicket);
    await expect(service.create(employee, 1, { body: 'x', visibility: 'INTERNAL' }, undefined)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('rejeita comentário em chamado fechado ou cancelado', async () => {
    for (const status of ['CLOSED', 'CANCELLED']) {
      const { service } = build({ ...baseTicket, status });
      await expect(service.create(technician, 1, { body: 'x' }, undefined)).rejects.toBeInstanceOf(ConflictException);
    }
  });

  it('resposta do funcionário em "Aguardando usuário" volta o chamado para "Aguardando iniciar"', async () => {
    const { service, tx } = build({ ...baseTicket, status: 'WAITING_USER' });
    await service.create(employee, 1, { body: 'Segue a informação' }, undefined);
    expect(tx.ticket.updateMany.mock.calls[0][0].data).toEqual({ status: 'WAITING_START' });
    expect(tx.ticketEvent.create.mock.calls[0][0].data.type).toBe('USER_REPLIED');
  });

  it('comentário da TI não altera o status', async () => {
    const { service, tx } = build({ ...baseTicket, status: 'WAITING_USER' });
    await service.create(technician, 1, { body: 'Pode confirmar?' }, undefined);
    expect(tx.ticket.updateMany).not.toHaveBeenCalled();
  });

  it('comentário público da TI notifica o solicitante', async () => {
    const { service, notifications } = build(baseTicket);
    await service.create(technician, 1, { body: 'Olá' }, undefined);
    expect(notifications.notify.mock.calls[0][1]).toEqual([10]);
  });

  it('observação interna notifica só a TI e nunca o solicitante', async () => {
    const { service, notifications } = build({ ...baseTicket, assigneeId: null });
    await service.create(technician, 1, { body: 'Nota', visibility: 'INTERNAL' }, undefined);
    const recipients: number[] = notifications.notify.mock.calls[0][1];
    expect(recipients).not.toContain(10);
    expect(recipients).toEqual([30]);
  });
});

describe('CommentsService.list', () => {
  it('filtra por visibilidade permitida ao perfil', async () => {
    const { service, prisma } = build(baseTicket);
    await service.list(employee, 1);
    expect(prisma.ticketComment.findMany.mock.calls[0][0].where).toEqual({ ticketId: 1, visibility: { in: ['PUBLIC'] } });
    await service.list(technician, 1);
    expect(prisma.ticketComment.findMany.mock.calls[1][0].where.visibility).toEqual({ in: ['PUBLIC', 'INTERNAL'] });
  });
});
