import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { Role, TicketStatus } from '@prisma/client';
import { TRANSITIONS, TicketAction, applyTransition, assertReopenWindow } from './ticket-state-machine';

const ALL_STATUSES: TicketStatus[] = ['OPEN', 'WAITING_START', 'WAITING_USER', 'RESOLVED', 'CLOSED', 'CANCELLED'];
const ALL_ROLES: Role[] = ['EMPLOYEE', 'TECHNICIAN', 'ADMIN'];

describe('applyTransition', () => {
  it.each(Object.entries(TRANSITIONS) as [TicketAction, (typeof TRANSITIONS)[TicketAction]][])(
    '%s: aceita somente origens e perfis declarados',
    (action, transition) => {
      for (const status of ALL_STATUSES) {
        for (const role of ALL_ROLES) {
          const call = () => applyTransition(status, action, role, 'motivo');
          if (!transition.roles.includes(role)) {
            expect(call).toThrow(ForbiddenException);
          } else if (!transition.from.includes(status)) {
            expect(call).toThrow(ConflictException);
          } else {
            expect(call()).toBe(transition.to ?? status);
          }
        }
      }
    },
  );

  it('exige motivo nas ações que o pedem', () => {
    const withReason = (Object.keys(TRANSITIONS) as TicketAction[]).filter((a) => TRANSITIONS[a].requiresReason);
    expect(withReason.sort()).toEqual(['CANCEL', 'REJECT_RESOLUTION', 'REOPEN', 'REQUEST_INFO', 'RESOLVE']);
    expect(() => applyTransition('CLOSED', 'REOPEN', 'EMPLOYEE', '   ')).toThrow(BadRequestException);
    expect(() => applyTransition('OPEN', 'CANCEL', 'EMPLOYEE')).toThrow(BadRequestException);
  });

  it('percorre o ciclo feliz: Aberto → Aguardando iniciar → Resolvido → Fechado', () => {
    const afterTriage = applyTransition('OPEN', 'TRIAGE', 'TECHNICIAN');
    const afterResolve = applyTransition(afterTriage, 'RESOLVE', 'TECHNICIAN', 'Teclado trocado');
    expect(afterResolve).toBe('RESOLVED');
    expect(applyTransition(afterResolve, 'CONFIRM', 'EMPLOYEE')).toBe('CLOSED');
  });

  it('reabre chamado fechado para Aberto', () => {
    expect(applyTransition('CLOSED', 'REOPEN', 'EMPLOYEE', 'Voltou a falhar')).toBe('OPEN');
  });

  it('não permite cancelar chamado Resolvido, Fechado ou Cancelado', () => {
    for (const status of ['RESOLVED', 'CLOSED', 'CANCELLED'] as TicketStatus[]) {
      expect(() => applyTransition(status, 'CANCEL', 'EMPLOYEE', 'motivo')).toThrow(ConflictException);
    }
  });

  it('atribuição não altera o status', () => {
    expect(applyTransition('WAITING_USER', 'ASSIGN', 'ADMIN')).toBe('WAITING_USER');
  });
});

describe('assertReopenWindow', () => {
  const closedAt = new Date('2026-11-20T12:00:00.000Z');

  it('aceita reabertura dois dias depois', () => {
    expect(() => assertReopenWindow(closedAt, new Date('2026-11-22T12:00:00.000Z'), 72)).not.toThrow();
  });

  it('aceita exatamente no limite de 72 horas', () => {
    expect(() => assertReopenWindow(closedAt, new Date('2026-11-23T12:00:00.000Z'), 72)).not.toThrow();
  });

  it('rejeita um milissegundo após as 72 horas', () => {
    expect(() => assertReopenWindow(closedAt, new Date('2026-11-23T12:00:00.001Z'), 72)).toThrow(ConflictException);
  });

  it('rejeita no quarto dia e quando não há data de fechamento', () => {
    expect(() => assertReopenWindow(closedAt, new Date('2026-11-24T12:00:00.000Z'), 72)).toThrow(ConflictException);
    expect(() => assertReopenWindow(null, new Date(), 72)).toThrow(ConflictException);
  });
});
