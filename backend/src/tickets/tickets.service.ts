import { BadRequestException, ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { EventType, Prisma, Priority, Ticket, User } from '@prisma/client';
import { TicketAccessPolicy } from '../access/ticket-access.policy';
import { AttachmentsService } from '../attachments/attachments.service';
import { ticketFilterWhere } from '../common/ticket-filters';
import { Page, toSkipTake } from '../common/dto/pagination.dto';
import { formatTicketCode } from '../common/format-ticket-code';
import { normalizeSerial } from '../common/normalize-serial';
import { AuthUser } from '../common/types/auth-user';
import { AppConfig } from '../config/env.validation';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { PriorityRulesService } from '../priority-rules/priority-rules.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { ListTicketsQuery } from './dto/list-tickets.query';
import { TicketEventsService } from './ticket-events.service';
import { TicketAction, applyTransition, assertReopenWindow } from './ticket-state-machine';
import {
  DETAIL_INCLUDE,
  LIST_INCLUDE,
  toTicketDetail,
  toTicketListItem,
} from './ticket-view.mapper';

export interface ActionInput {
  reason?: string;
  solution?: string;
  message?: string;
  assigneeId?: number;
  priority?: Priority;
  justification?: string;
}

const EVENT_BY_ACTION: Record<TicketAction, EventType> = {
  TRIAGE: 'TRIAGED',
  ASSIGN: 'ASSIGNED',
  REQUEST_INFO: 'INFO_REQUESTED',
  USER_REPLY: 'USER_REPLIED',
  RESOLVE: 'RESOLVED',
  CONFIRM: 'CLOSED',
  REJECT_RESOLUTION: 'RESOLUTION_REJECTED',
  REOPEN: 'REOPENED',
  CANCEL: 'CANCELLED',
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: 'Aberto',
  WAITING_START: 'Aguardando iniciar',
  WAITING_USER: 'Aguardando usuário',
  RESOLVED: 'Resolvido',
  CLOSED: 'Fechado',
  CANCELLED: 'Cancelado',
};

@Injectable()
export class TicketsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TicketAccessPolicy,
    private readonly priorityRules: PriorityRulesService,
    private readonly attachments: AttachmentsService,
    private readonly notifications: NotificationsService,
    private readonly events: TicketEventsService,
    private readonly config: AppConfig,
  ) {}

  async create(user: AuthUser, dto: CreateTicketDto, files: Express.Multer.File[] | undefined) {
    const validated = this.attachments.validateAll(files);
    if (dto.categoryId !== undefined) {
      const category = await this.prisma.category.findUnique({ where: { id: dto.categoryId } });
      if (!category || !category.active) throw new BadRequestException('Categoria inexistente ou inativa.');
    }
    const suggested = await this.priorityRules.suggest({
      affected: dto.impactAffected,
      blocking: dto.impactBlocking,
      alternative: dto.impactAlternative,
    });
    const serial = normalizeSerial(dto.serial);
    if (!serial) throw new BadRequestException('Informe o número de série.');

    const written: string[] = [];
    try {
      const ticketId = await this.prisma.$transaction(async (tx) => {
        const requester = await tx.user.findUniqueOrThrow({ where: { id: user.id } });
        const equipment = await tx.equipment.findUnique({ where: { serial } });
        const ticket = await tx.ticket.create({
          data: {
            requesterId: requester.id,
            requesterName: requester.name,
            requesterEmail: requester.email,
            sectorId: requester.sectorId,
            title: dto.title?.trim() || null,
            description: dto.description.trim(),
            categoryId: dto.categoryId ?? null,
            serialInformed: serial,
            equipmentId: equipment?.id ?? null,
            impactAffected: dto.impactAffected,
            impactBlocking: dto.impactBlocking,
            impactAlternative: dto.impactAlternative,
            suggestedPriority: suggested,
            priority: suggested,
          },
        });
        await this.events.record(tx, {
          ticketId: ticket.id,
          type: 'CREATED',
          actorId: user.id,
          payload: { suggestedPriority: suggested, equipmentIdentified: equipment !== null },
        });
        await this.attachments.saveAll(
          tx,
          validated,
          { ticketId: ticket.id, commentId: null, uploaderId: user.id, visibility: 'PUBLIC' },
          written,
        );
        await this.notifications.notify(tx, await this.notifications.staffIds(tx, user.id), {
          ticketId: ticket.id,
          type: 'TICKET_CREATED',
          message: `Novo chamado ${formatTicketCode(ticket.id)} de ${requester.name}.`,
        });
        return ticket.id;
      });
      return this.getDetail(user, ticketId);
    } catch (error) {
      await this.attachments.discard(written);
      throw error;
    }
  }

  async list(user: AuthUser, query: ListTicketsQuery): Promise<Page<ReturnType<typeof toTicketListItem>>> {
    const where: Prisma.TicketWhereInput = ticketFilterWhere(query);
    if (user.role === 'EMPLOYEE') where.requesterId = user.id;
    if (query.mine) where.assigneeId = user.id;
    if (query.from || query.to) where.createdAt = { gte: query.from, lte: query.to };
    if (query.q) {
      const numeric = Number(query.q.replace(/\D/g, ''));
      where.OR = [
        { serialInformed: { contains: normalizeSerial(query.q), mode: 'insensitive' } },
        { title: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
        ...(Number.isInteger(numeric) && numeric > 0 ? [{ id: numeric }] : []),
      ];
    }
    const orderBy: Prisma.TicketOrderByWithRelationInput[] =
      user.role === 'EMPLOYEE' ? [{ createdAt: 'desc' }] : [{ priority: 'desc' }, { createdAt: 'asc' }];

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.ticket.findMany({ where, orderBy, include: LIST_INCLUDE, ...toSkipTake(query) }),
      this.prisma.ticket.count({ where }),
    ]);
    return { items: rows.map((row) => toTicketListItem(row, user)), total, page: query.page, pageSize: query.pageSize };
  }

  async getDetail(user: AuthUser, id: number) {
    await this.access.loadVisibleTicket(user, id);
    const row = await this.prisma.ticket.findUniqueOrThrow({ where: { id }, include: DETAIL_INCLUDE });
    return toTicketDetail(row, user, this.config.settings.reopenWindowHours);
  }

  async perform(user: AuthUser, id: number, action: TicketAction, input: ActionInput = {}) {
    const ticket = await this.access.loadVisibleTicket(user, id);
    const reason = action === 'RESOLVE' ? input.solution : action === 'REQUEST_INFO' ? input.message : input.reason;
    const next = applyTransition(ticket.status, action, user.role, reason);
    if (action === 'REOPEN') {
      assertReopenWindow(ticket.closedAt, new Date(), this.config.settings.reopenWindowHours);
    }
    const assignee = action === 'ASSIGN' ? await this.resolveAssignee(user, ticket, input.assigneeId) : null;
    const newPriority = action === 'TRIAGE' ? this.resolveTriagePriority(ticket, input) : null;
    const now = new Date();

    await this.prisma.$transaction(async (tx) => {
      const data: Prisma.TicketUncheckedUpdateManyInput = { status: next };
      if (assignee) {
        data.assigneeId = assignee.id;
        data.assignedAt = now;
      }
      if (newPriority) data.priority = newPriority;
      if (action === 'RESOLVE') {
        data.solution = input.solution!.trim();
        data.resolvedAt = now;
        if (!ticket.assigneeId) {
          data.assigneeId = user.id;
          data.assignedAt = now;
        }
      }
      if (action === 'CONFIRM') data.closedAt = now;
      if (action === 'REOPEN') data.closedAt = null;
      if (action === 'CANCEL') data.cancelledAt = now;

      const updated = await tx.ticket.updateMany({
        where: { id, status: ticket.status, assigneeId: ticket.assigneeId },
        data,
      });
      if (updated.count === 0) {
        throw new ConflictException('O chamado foi alterado por outra pessoa. Recarregue.');
      }

      if (action === 'REQUEST_INFO') {
        await tx.ticketComment.create({
          data: { ticketId: id, authorId: user.id, body: input.message!.trim(), visibility: 'PUBLIC' },
        });
      }
      if (newPriority) {
        await this.events.record(tx, {
          ticketId: id,
          type: 'PRIORITY_CHANGED',
          actorId: user.id,
          payload: { from: ticket.priority, to: newPriority, justification: input.justification?.trim() ?? null },
        });
      }
      await this.events.record(tx, {
        ticketId: id,
        type: EVENT_BY_ACTION[action],
        actorId: user.id,
        payload: {
          from: ticket.status,
          to: next,
          reason: reason?.trim() ?? null,
          ...(assignee ? { assigneeId: assignee.id, assigneeName: assignee.name } : {}),
        },
      });
      await this.notifyAction(tx, ticket, action, user, assignee);
    });

    return this.getDetail(user, id);
  }

  async changePriority(user: AuthUser, id: number, priority: Priority, justification: string) {
    const ticket = await this.access.loadVisibleTicket(user, id);
    if (user.role === 'EMPLOYEE') throw new ForbiddenException('Perfil sem permissão para esta ação.');
    if (ticket.status === 'CLOSED' || ticket.status === 'CANCELLED') {
      throw new ConflictException('Chamado encerrado não permite alterar a prioridade.');
    }
    if (ticket.priority === priority) throw new BadRequestException('A prioridade informada já é a atual.');

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.ticket.updateMany({ where: { id, status: ticket.status }, data: { priority } });
      if (updated.count === 0) throw new ConflictException('O chamado foi alterado por outra pessoa. Recarregue.');
      await this.events.record(tx, {
        ticketId: id,
        type: 'PRIORITY_CHANGED',
        actorId: user.id,
        payload: { from: ticket.priority, to: priority, justification: justification.trim() },
      });
    });
    return this.getDetail(user, id);
  }

  async correctSerial(user: AuthUser, id: number, rawSerial: string) {
    const ticket = await this.access.loadVisibleTicket(user, id);
    if (user.role === 'EMPLOYEE') throw new ForbiddenException('Perfil sem permissão para esta ação.');
    const serial = normalizeSerial(rawSerial);
    if (!serial) throw new BadRequestException('Informe o número de série.');

    await this.prisma.$transaction(async (tx) => {
      const equipment = await tx.equipment.findUnique({ where: { serial } });
      await tx.ticket.update({ where: { id }, data: { serialInformed: serial, equipmentId: equipment?.id ?? null } });
      await this.events.record(tx, {
        ticketId: id,
        type: 'SERIAL_CORRECTED',
        actorId: user.id,
        payload: { from: ticket.serialInformed, to: serial, equipmentLinked: equipment !== null },
      });
    });
    return this.getDetail(user, id);
  }

  private async resolveAssignee(user: AuthUser, ticket: Ticket, requestedId?: number): Promise<User> {
    const targetId = requestedId ?? user.id;
    if (user.role === 'TECHNICIAN') {
      if (targetId !== user.id) throw new ForbiddenException('Técnicos só podem assumir chamados para si.');
      if (ticket.assigneeId && ticket.assigneeId !== user.id) {
        throw new ConflictException('O chamado já possui responsável.');
      }
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target || !target.isActive || target.role === 'EMPLOYEE') {
      throw new BadRequestException('Responsável inválido.');
    }
    return target;
  }

  private resolveTriagePriority(ticket: Ticket, input: ActionInput): Priority | null {
    if (!input.priority || input.priority === ticket.priority) return null;
    if (!input.justification?.trim()) {
      throw new BadRequestException('Informe a justificativa da alteração de prioridade.');
    }
    return input.priority;
  }

  private async notifyAction(
    tx: Prisma.TransactionClient,
    ticket: Ticket,
    action: TicketAction,
    actor: AuthUser,
    assignee: User | null,
  ): Promise<void> {
    const code = formatTicketCode(ticket.id);
    const handlers = async () =>
      ticket.assigneeId ? [ticket.assigneeId] : await this.notifications.staffIds(tx, actor.id);
    let recipients: number[] = [];
    let type = 'STATUS_CHANGED';
    let message = '';

    switch (action) {
      case 'ASSIGN':
        recipients = assignee ? [assignee.id] : [];
        type = 'TICKET_ASSIGNED';
        message = `${code} foi atribuído a você.`;
        break;
      case 'TRIAGE':
        recipients = [ticket.requesterId];
        message = `${code}: status alterado para ${STATUS_LABEL.WAITING_START}.`;
        break;
      case 'REQUEST_INFO':
        recipients = [ticket.requesterId];
        type = 'NEW_COMMENT';
        message = `${code}: a TI fez uma pergunta e aguarda sua resposta.`;
        break;
      case 'RESOLVE':
        recipients = [ticket.requesterId];
        type = 'TICKET_RESOLVED';
        message = `${code} foi resolvido. Confirme se o problema acabou.`;
        break;
      case 'CONFIRM':
        recipients = await handlers();
        message = `${code} foi fechado pelo solicitante.`;
        break;
      case 'REJECT_RESOLUTION':
        recipients = await handlers();
        type = 'TICKET_REOPENED';
        message = `${code}: o solicitante informou que o problema persiste.`;
        break;
      case 'REOPEN':
        recipients = await handlers();
        type = 'TICKET_REOPENED';
        message = `${code} foi reaberto pelo solicitante.`;
        break;
      case 'CANCEL':
        recipients = actor.id === ticket.requesterId ? await handlers() : [ticket.requesterId];
        message = `${code} foi cancelado.`;
        break;
      default:
        return;
    }
    await this.notifications.notify(
      tx,
      recipients.filter((id) => id !== actor.id),
      { ticketId: ticket.id, type, message },
    );
  }
}
