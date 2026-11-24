import type { AuthUser, TicketDetail } from './types';

export type TicketActionKey =
  | 'assume'
  | 'assign'
  | 'triage'
  | 'request-info'
  | 'resolve'
  | 'priority'
  | 'serial'
  | 'cancel'
  | 'confirm'
  | 'reject-resolution'
  | 'reopen';

const WORKING_STATES = ['OPEN', 'WAITING_START', 'WAITING_USER'];

export function availableActions(ticket: TicketDetail, user: AuthUser): TicketActionKey[] {
  const actions: TicketActionKey[] = [];
  const working = WORKING_STATES.includes(ticket.status);

  if (user.role === 'EMPLOYEE') {
    if (ticket.requesterId !== user.id) return actions;
    if (ticket.status === 'RESOLVED') actions.push('confirm', 'reject-resolution');
    if (ticket.status === 'CLOSED' && ticket.reopenUntil && new Date(ticket.reopenUntil).getTime() >= Date.now()) {
      actions.push('reopen');
    }
    if (working) actions.push('cancel');
    return actions;
  }

  if (working) {
    if (!ticket.assignee) actions.push('assume');
    if (user.role === 'ADMIN') actions.push('assign');
    if (ticket.status === 'OPEN') actions.push('triage');
    if (ticket.status === 'OPEN' || ticket.status === 'WAITING_START') actions.push('request-info');
    actions.push('resolve');
  }
  if (ticket.status !== 'CLOSED' && ticket.status !== 'CANCELLED') actions.push('priority');
  if (ticket.equipmentPending) actions.push('serial');
  if (working) actions.push('cancel');
  return actions;
}

export function canComment(ticket: TicketDetail): boolean {
  return ticket.status !== 'CLOSED' && ticket.status !== 'CANCELLED';
}
