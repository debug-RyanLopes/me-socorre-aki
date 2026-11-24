import { ConflictException } from '@nestjs/common';
import { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { EquipmentService } from './equipment.service';

const actor: AuthUser = { id: 5, name: 'Marcos', email: 'm@e', login: 'marcos', role: 'TECHNICIAN', sectorId: 1, mustChangePassword: false };

function build(existingSerial: unknown = null) {
  const tx = {
    equipment: {
      create: jest.fn().mockResolvedValue({
        id: 9,
        serial: 'NB-55901',
        type: 'NOTEBOOK',
        manufacturer: 'Dell',
        model: 'Latitude',
        sectorId: 1,
        sector: { name: 'Comercial' },
        _count: { tickets: 0 },
      }),
    },
    ticket: {
      findMany: jest.fn().mockResolvedValue([{ id: 1 }, { id: 2 }]),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    ticketEvent: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
  };
  const prisma = {
    sector: { findUnique: jest.fn().mockResolvedValue({ id: 1 }) },
    equipment: { findUnique: jest.fn().mockResolvedValue(existingSerial) },
    $transaction: jest.fn(async (fn: (client: typeof tx) => unknown) => fn(tx)),
  };
  return { service: new EquipmentService(prisma as unknown as PrismaService), tx, prisma };
}

describe('EquipmentService', () => {
  it('normaliza o serial e vincula os chamados pendentes com o mesmo serial', async () => {
    const { service, tx } = build();
    const created = await service.create(actor, {
      serial: ' nb-55901 ',
      type: 'NOTEBOOK',
      manufacturer: 'Dell',
      model: 'Latitude',
      sectorId: 1,
    });
    expect(tx.equipment.create.mock.calls[0][0].data.serial).toBe('NB-55901');
    expect(tx.ticket.findMany.mock.calls[0][0].where).toEqual({ serialInformed: 'NB-55901', equipmentId: null });
    expect(tx.ticket.updateMany).toHaveBeenCalledWith({ where: { id: { in: [1, 2] } }, data: { equipmentId: 9 } });
    expect(tx.ticketEvent.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(created.linkedTickets).toBe(2);
  });

  it('rejeita serial duplicado', async () => {
    const { service } = build({ id: 1 });
    await expect(
      service.create(actor, { serial: 'NB-1', type: 'NOTEBOOK', manufacturer: 'Dell', model: 'X', sectorId: 1 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
