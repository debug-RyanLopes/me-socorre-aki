import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';

export interface NotificationInput {
  ticketId: number;
  type: string;
  message: string;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(tx: Prisma.TransactionClient, userIds: number[], input: NotificationInput): Promise<void> {
    const recipients = [...new Set(userIds)];
    if (recipients.length === 0) return;
    await tx.notification.createMany({
      data: recipients.map((userId) => ({ userId, ticketId: input.ticketId, type: input.type, message: input.message })),
    });
  }

  async staffIds(tx: Prisma.TransactionClient, excludeUserId?: number): Promise<number[]> {
    const staff = await tx.user.findMany({
      where: { isActive: true, role: { in: ['TECHNICIAN', 'ADMIN'] }, id: excludeUserId ? { not: excludeUserId } : undefined },
      select: { id: true },
    });
    return staff.map((s) => s.id);
  }

  list(user: AuthUser) {
    return this.prisma.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async unreadCount(user: AuthUser): Promise<{ count: number }> {
    const count = await this.prisma.notification.count({ where: { userId: user.id, readAt: null } });
    return { count };
  }

  async markRead(user: AuthUser, id: number) {
    const result = await this.prisma.notification.updateMany({
      where: { id, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    if (result.count === 0) {
      const exists = await this.prisma.notification.findFirst({ where: { id, userId: user.id } });
      if (!exists) throw new NotFoundException('Notificação não encontrada.');
    }
    return this.prisma.notification.findUniqueOrThrow({ where: { id } });
  }

  async markAllRead(user: AuthUser): Promise<{ updated: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
}
