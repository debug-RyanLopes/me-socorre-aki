import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { Attachment, Prisma, TicketComment, User } from '@prisma/client';
import { TicketAccessPolicy } from '../access/ticket-access.policy';
import { AttachmentsService, toAttachmentView } from '../attachments/attachments.service';
import { formatTicketCode } from '../common/format-ticket-code';
import { AuthUser } from '../common/types/auth-user';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { recordTicketEvent } from '../tickets/ticket-events.service';
import { applyTransition } from '../tickets/ticket-state-machine';
import { CreateCommentDto } from './dto/create-comment.dto';

type CommentRow = TicketComment & {
  author: Pick<User, 'id' | 'name' | 'role'>;
  attachments: Attachment[];
};

function toView(row: CommentRow) {
  return {
    id: row.id,
    ticketId: row.ticketId,
    body: row.body,
    visibility: row.visibility,
    createdAt: row.createdAt,
    author: row.author,
    attachments: row.attachments.map(toAttachmentView),
  };
}

const COMMENT_INCLUDE = {
  author: { select: { id: true, name: true, role: true } },
  attachments: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.TicketCommentInclude;

@Injectable()
export class CommentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TicketAccessPolicy,
    private readonly attachments: AttachmentsService,
    private readonly notifications: NotificationsService,
  ) {}

  async list(user: AuthUser, ticketId: number) {
    await this.access.loadVisibleTicket(user, ticketId);
    const rows = await this.prisma.ticketComment.findMany({
      where: { ticketId, visibility: { in: this.access.allowedVisibilities(user) } },
      include: COMMENT_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return rows.map((row) =>
      toView({
        ...row,
        attachments: row.attachments.filter((a) => this.access.allowedVisibilities(user).includes(a.visibility)),
      }),
    );
  }

  async create(
    user: AuthUser,
    ticketId: number,
    dto: CreateCommentDto,
    files: Express.Multer.File[] | undefined,
  ) {
    const ticket = await this.access.loadVisibleTicket(user, ticketId);
    if (ticket.status === 'CLOSED' || ticket.status === 'CANCELLED') {
      throw new ConflictException('Chamado encerrado não aceita comentários.');
    }
    const visibility = dto.visibility ?? 'PUBLIC';
    if (user.role === 'EMPLOYEE' && visibility === 'INTERNAL') {
      throw new ForbiddenException('Observações internas são exclusivas da equipe de TI.');
    }
    const validated = this.attachments.validateAll(files);
    const written: string[] = [];

    try {
      const commentId = await this.prisma.$transaction(async (tx) => {
        const comment = await tx.ticketComment.create({
          data: { ticketId, authorId: user.id, body: dto.body.trim(), visibility },
        });
        await this.attachments.saveAll(
          tx,
          validated,
          { ticketId, commentId: comment.id, uploaderId: user.id, visibility },
          written,
        );
        if (user.role === 'EMPLOYEE' && ticket.status === 'WAITING_USER') {
          const next = applyTransition(ticket.status, 'USER_REPLY', user.role);
          const moved = await tx.ticket.updateMany({
            where: { id: ticketId, status: ticket.status },
            data: { status: next },
          });
          if (moved.count > 0) {
            await recordTicketEvent(tx, {
              ticketId,
              type: 'USER_REPLIED',
              actorId: user.id,
              payload: { from: ticket.status, to: next },
            });
          }
        }
        await this.notifyComment(tx, ticket, user, visibility);
        return comment.id;
      });
      const row = await this.prisma.ticketComment.findUniqueOrThrow({
        where: { id: commentId },
        include: COMMENT_INCLUDE,
      });
      return toView(row);
    } catch (error) {
      await this.attachments.discard(written);
      throw error;
    }
  }

  private async notifyComment(
    tx: Prisma.TransactionClient,
    ticket: { id: number; requesterId: number; assigneeId: number | null },
    author: AuthUser,
    visibility: 'PUBLIC' | 'INTERNAL',
  ): Promise<void> {
    const code = formatTicketCode(ticket.id);
    const staffTargets = async () =>
      ticket.assigneeId ? [ticket.assigneeId] : await this.notifications.staffIds(tx, author.id);

    let recipients: number[];
    let message: string;
    if (visibility === 'INTERNAL') {
      recipients = await staffTargets();
      message = `${code}: nova observação interna de ${author.name}.`;
    } else if (author.role === 'EMPLOYEE') {
      recipients = await staffTargets();
      message = `${code}: ${author.name} adicionou um comentário.`;
    } else {
      recipients = [ticket.requesterId];
      message = `${code}: a TI respondeu ao seu chamado.`;
    }
    await this.notifications.notify(
      tx,
      recipients.filter((id) => id !== author.id),
      { ticketId: ticket.id, type: 'NEW_COMMENT', message },
    );
  }
}
