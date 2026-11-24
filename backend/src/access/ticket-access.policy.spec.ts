import { NotFoundException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { TicketAccessPolicy } from './ticket-access.policy';

const employee: AuthUser = { id: 10, name: 'Paula', email: 'p@e', login: 'paula', role: 'EMPLOYEE', sectorId: 1, mustChangePassword: false };
const technician: AuthUser = { ...employee, id: 20, role: 'TECHNICIAN' };
const admin: AuthUser = { ...employee, id: 30, role: 'ADMIN' };

function build(ticket: { id: number; requesterId: number } | null) {
  const prisma = { ticket: { findUnique: jest.fn().mockResolvedValue(ticket) } };
  return new TicketAccessPolicy(prisma as unknown as PrismaService);
}

describe('TicketAccessPolicy', () => {
  it('permite ao funcionário ver o próprio chamado', async () => {
    const policy = build({ id: 1, requesterId: 10 });
    await expect(policy.loadVisibleTicket(employee, 1)).resolves.toMatchObject({ id: 1 });
  });

  it('responde 404 quando o funcionário tenta ver chamado de outro', async () => {
    const policy = build({ id: 1, requesterId: 99 });
    await expect(policy.loadVisibleTicket(employee, 1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('responde 404 para chamado inexistente', async () => {
    const policy = build(null);
    await expect(policy.loadVisibleTicket(technician, 1)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('permite à TI e ao administrador ver qualquer chamado', async () => {
    const policy = build({ id: 1, requesterId: 99 });
    await expect(policy.loadVisibleTicket(technician, 1)).resolves.toBeDefined();
    await expect(policy.loadVisibleTicket(admin, 1)).resolves.toBeDefined();
  });

  it('restringe o funcionário a conteúdo público', () => {
    const policy = build(null);
    expect(policy.allowedVisibilities(employee)).toEqual(['PUBLIC']);
    expect(policy.allowedVisibilities(technician)).toEqual(['PUBLIC', 'INTERNAL']);
    expect(policy.allowedVisibilities(admin)).toEqual(['PUBLIC', 'INTERNAL']);
  });
});
