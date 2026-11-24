import { Injectable, NotFoundException } from '@nestjs/common';
import { Ticket, Visibility } from '@prisma/client';
import { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TicketAccessPolicy {
  constructor(private readonly prisma: PrismaService) {}

  async loadVisibleTicket(user: AuthUser, id: number): Promise<Ticket> {
    const ticket = await this.prisma.ticket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException('Chamado não encontrado.');
    this.assertCanSee(user, ticket);
    return ticket;
  }

  assertCanSee(user: AuthUser, ticket: Pick<Ticket, 'requesterId'>): void {
    if (user.role === 'EMPLOYEE' && ticket.requesterId !== user.id) {
      throw new NotFoundException('Chamado não encontrado.');
    }
  }

  allowedVisibilities(user: AuthUser): Visibility[] {
    return user.role === 'EMPLOYEE' ? ['PUBLIC'] : ['PUBLIC', 'INTERNAL'];
  }
}
