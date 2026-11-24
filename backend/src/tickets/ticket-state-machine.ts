import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Role, TicketStatus } from '@prisma/client';

export type TicketAction =
  | 'TRIAGE'
  | 'ASSIGN'
  | 'REQUEST_INFO'
  | 'USER_REPLY'
  | 'RESOLVE'
  | 'CONFIRM'
  | 'REJECT_RESOLUTION'
  | 'REOPEN'
  | 'CANCEL';

interface Transition {
  from: TicketStatus[];
  to: TicketStatus | null;
  roles: Role[];
  requiresReason: boolean;
}

const STAFF: Role[] = ['TECHNICIAN', 'ADMIN'];
const OPEN_STATES: TicketStatus[] = ['OPEN', 'WAITING_START', 'WAITING_USER'];

export const TRANSITIONS: Record<TicketAction, Transition> = {
  TRIAGE: { from: ['OPEN'], to: 'WAITING_START', roles: STAFF, requiresReason: false },
  ASSIGN: { from: OPEN_STATES, to: null, roles: STAFF, requiresReason: false },
  REQUEST_INFO: { from: ['OPEN', 'WAITING_START'], to: 'WAITING_USER', roles: STAFF, requiresReason: true },
  USER_REPLY: { from: ['WAITING_USER'], to: 'WAITING_START', roles: ['EMPLOYEE'], requiresReason: false },
  RESOLVE: { from: OPEN_STATES, to: 'RESOLVED', roles: STAFF, requiresReason: true },
  CONFIRM: { from: ['RESOLVED'], to: 'CLOSED', roles: ['EMPLOYEE'], requiresReason: false },
  REJECT_RESOLUTION: { from: ['RESOLVED'], to: 'OPEN', roles: ['EMPLOYEE'], requiresReason: true },
  REOPEN: { from: ['CLOSED'], to: 'OPEN', roles: ['EMPLOYEE'], requiresReason: true },
  CANCEL: { from: OPEN_STATES, to: 'CANCELLED', roles: ['EMPLOYEE', ...STAFF], requiresReason: true },
};

export function applyTransition(
  current: TicketStatus,
  action: TicketAction,
  role: Role,
  reason?: string,
): TicketStatus {
  const transition = TRANSITIONS[action];
  if (!transition.roles.includes(role)) {
    throw new ForbiddenException('Perfil sem permissão para esta ação.');
  }
  if (!transition.from.includes(current)) {
    throw new ConflictException('Ação indisponível para o status atual.');
  }
  if (transition.requiresReason && !reason?.trim()) {
    throw new BadRequestException('Informe o motivo.');
  }
  return transition.to ?? current;
}

export function assertReopenWindow(closedAt: Date | null, now: Date, hours: number): void {
  if (!closedAt || now.getTime() - closedAt.getTime() > hours * 3_600_000) {
    throw new ConflictException('Prazo de reabertura expirado. Abra um novo chamado.');
  }
}
