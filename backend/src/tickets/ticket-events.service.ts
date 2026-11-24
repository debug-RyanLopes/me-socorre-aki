import { Injectable } from '@nestjs/common';
import { EventType, Prisma } from '@prisma/client';

export const REQUESTER_VISIBLE: Record<EventType, boolean> = {
  CREATED: true,
  ASSIGNED: true,
  TRIAGED: true,
  PRIORITY_CHANGED: false,
  INFO_REQUESTED: true,
  USER_REPLIED: true,
  RESOLVED: true,
  CLOSED: true,
  RESOLUTION_REJECTED: true,
  REOPENED: true,
  CANCELLED: true,
  SERIAL_CORRECTED: false,
  EQUIPMENT_LINKED: false,
};

export interface TicketEventInput {
  ticketId: number;
  type: EventType;
  actorId: number | null;
  payload?: Prisma.InputJsonObject;
}

export function recordTicketEvent(tx: Prisma.TransactionClient, input: TicketEventInput) {
  return tx.ticketEvent.create({
    data: {
      ticketId: input.ticketId,
      type: input.type,
      actorId: input.actorId,
      payload: input.payload ?? {},
      requesterVisible: REQUESTER_VISIBLE[input.type],
    },
  });
}

@Injectable()
export class TicketEventsService {
  record(tx: Prisma.TransactionClient, input: TicketEventInput) {
    return recordTicketEvent(tx, input);
  }
}
