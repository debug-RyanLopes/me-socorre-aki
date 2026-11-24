import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from './notifications.service';

const user: AuthUser = { id: 3, name: 'Paula', email: 'p@e', login: 'paula', role: 'EMPLOYEE', sectorId: 1, mustChangePassword: false };

function build() {
  const notification = {
    updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    findFirst: jest.fn().mockResolvedValue(null),
    findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 1 }),
    count: jest.fn().mockResolvedValue(4),
    createMany: jest.fn().mockResolvedValue({ count: 2 }),
  };
  const prisma = { notification };
  const tx = { notification, user: { findMany: jest.fn().mockResolvedValue([{ id: 8 }, { id: 9 }]) } };
  return { service: new NotificationsService(prisma as unknown as PrismaService), notification, tx };
}

describe('NotificationsService', () => {
  it('cria uma notificação por destinatário, sem duplicar', async () => {
    const { service, notification, tx } = build();
    await service.notify(tx as unknown as Prisma.TransactionClient, [1, 2, 2], {
      ticketId: 5,
      type: 'TICKET_CREATED',
      message: 'Novo chamado',
    });
    expect(notification.createMany.mock.calls[0][0].data).toHaveLength(2);
  });

  it('não grava nada quando não há destinatários', async () => {
    const { service, notification, tx } = build();
    await service.notify(tx as unknown as Prisma.TransactionClient, [], { ticketId: 1, type: 't', message: 'm' });
    expect(notification.createMany).not.toHaveBeenCalled();
  });

  it('lista os técnicos e administradores ativos, excluindo o autor', async () => {
    const { service, tx } = build();
    const ids = await service.staffIds(tx as unknown as Prisma.TransactionClient, 8);
    expect(ids).toEqual([8, 9]);
    expect(tx.user.findMany.mock.calls[0][0].where.id).toEqual({ not: 8 });
  });

  it('conta apenas as não lidas do próprio usuário', async () => {
    const { service, notification } = build();
    await expect(service.unreadCount(user)).resolves.toEqual({ count: 4 });
    expect(notification.count).toHaveBeenCalledWith({ where: { userId: 3, readAt: null } });
  });

  it('marca como lida somente notificação do próprio usuário', async () => {
    const { service, notification } = build();
    await service.markRead(user, 1);
    expect(notification.updateMany.mock.calls[0][0].where).toEqual({ id: 1, userId: 3, readAt: null });
  });

  it('responde 404 quando a notificação não é do usuário', async () => {
    const { service, notification } = build();
    notification.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.markRead(user, 99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marca todas como lidas', async () => {
    const { service } = build();
    await expect(service.markAllRead(user)).resolves.toEqual({ updated: 1 });
  });
});
