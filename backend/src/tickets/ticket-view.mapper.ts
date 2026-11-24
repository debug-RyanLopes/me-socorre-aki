import { Prisma } from '@prisma/client';
import { formatTicketCode } from '../common/format-ticket-code';
import { AuthUser } from '../common/types/auth-user';

export const LIST_INCLUDE = {
  assignee: { select: { id: true, name: true } },
  sector: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  equipment: { select: { id: true, serial: true, manufacturer: true, model: true } },
} satisfies Prisma.TicketInclude;

export const DETAIL_INCLUDE = {
  ...LIST_INCLUDE,
  events: { include: { actor: { select: { id: true, name: true } } }, orderBy: { createdAt: 'asc' } },
  attachments: { where: { commentId: null }, orderBy: { createdAt: 'asc' } },
} satisfies Prisma.TicketInclude;

export type TicketListRow = Prisma.TicketGetPayload<{ include: typeof LIST_INCLUDE }>;
export type TicketDetailRow = Prisma.TicketGetPayload<{ include: typeof DETAIL_INCLUDE }>;

const REQUESTER_PAYLOAD_KEYS = ['from', 'to', 'reason'];

function sanitizePayload(payload: Prisma.JsonValue): Prisma.JsonObject {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return {};
  return Object.fromEntries(
    Object.entries(payload).filter(([key]) => REQUESTER_PAYLOAD_KEYS.includes(key)),
  ) as Prisma.JsonObject;
}

export function toTicketListItem(ticket: TicketListRow, user: AuthUser) {
  const isStaff = user.role !== 'EMPLOYEE';
  return {
    id: ticket.id,
    code: formatTicketCode(ticket.id),
    title: ticket.title,
    summary: ticket.description.slice(0, 140),
    status: ticket.status,
    priority: isStaff ? ticket.priority : null,
    requesterId: ticket.requesterId,
    requesterName: ticket.requesterName,
    sector: ticket.sector,
    category: ticket.category,
    serialInformed: ticket.serialInformed,
    equipment: ticket.equipment,
    equipmentPending: ticket.equipmentId === null,
    assignee: ticket.assignee,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    resolvedAt: ticket.resolvedAt,
    closedAt: ticket.closedAt,
  };
}

export function toTicketDetail(ticket: TicketDetailRow, user: AuthUser, reopenWindowHours: number) {
  const isStaff = user.role !== 'EMPLOYEE';
  const events = ticket.events
    .filter((event) => isStaff || event.requesterVisible)
    .map((event) => ({
      id: event.id,
      type: event.type,
      actor: event.actor,
      payload: isStaff ? event.payload : sanitizePayload(event.payload),
      createdAt: event.createdAt,
    }));
  return {
    ...toTicketListItem(ticket, user),
    description: ticket.description,
    requesterEmail: ticket.requesterEmail,
    solution: ticket.solution,
    cancelledAt: ticket.cancelledAt,
    assignedAt: ticket.assignedAt,
    impact: {
      affected: ticket.impactAffected,
      blocking: ticket.impactBlocking,
      alternative: ticket.impactAlternative,
    },
    suggestedPriority: isStaff ? ticket.suggestedPriority : null,
    reopenUntil:
      ticket.status === 'CLOSED' && ticket.closedAt
        ? new Date(ticket.closedAt.getTime() + reopenWindowHours * 3_600_000)
        : null,
    events,
    attachments: ticket.attachments.map((a) => ({ id: a.id, originalName: a.originalName, mime: a.mime, size: a.size })),
  };
}
