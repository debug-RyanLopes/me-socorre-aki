import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Equipment, Prisma } from '@prisma/client';
import { Page, toSkipTake } from '../common/dto/pagination.dto';
import { normalizeSerial } from '../common/normalize-serial';
import { AuthUser } from '../common/types/auth-user';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEquipmentDto, ListEquipmentQuery, UpdateEquipmentDto } from './dto/equipment.dto';

export interface EquipmentView extends Equipment {
  sectorName: string;
  ticketCount: number;
  linkedTickets?: number;
}

export interface PendingSerial {
  serial: string;
  ticketCount: number;
  tickets: { id: number; requesterName: string; createdAt: Date }[];
}

type EquipmentRow = Equipment & { sector: { name: string }; _count: { tickets: number } };

function toView(row: EquipmentRow, linkedTickets?: number): EquipmentView {
  const { sector, _count, ...rest } = row;
  return { ...rest, sectorName: sector.name, ticketCount: _count.tickets, linkedTickets };
}

@Injectable()
export class EquipmentService {
  constructor(private readonly prisma: PrismaService) {}

  async create(actor: AuthUser, dto: CreateEquipmentDto): Promise<EquipmentView> {
    const serial = normalizeSerial(dto.serial);
    if (!serial) throw new BadRequestException('Informe o serial.');
    const sector = await this.prisma.sector.findUnique({ where: { id: dto.sectorId } });
    if (!sector) throw new BadRequestException('Setor inexistente.');
    if (await this.prisma.equipment.findUnique({ where: { serial } })) {
      throw new ConflictException('Já existe equipamento com este serial.');
    }
    if (dto.assetTag && (await this.prisma.equipment.findUnique({ where: { assetTag: dto.assetTag } }))) {
      throw new ConflictException('Já existe equipamento com este número de patrimônio.');
    }

    return this.prisma.$transaction(async (tx) => {
      const row = await tx.equipment.create({
        data: {
          serial,
          type: dto.type,
          manufacturer: dto.manufacturer.trim(),
          model: dto.model.trim(),
          sectorId: dto.sectorId,
          responsibleId: dto.responsibleId,
          acquiredAt: dto.acquiredAt,
          assetTag: dto.assetTag,
          notes: dto.notes,
        },
        include: { sector: { select: { name: true } }, _count: { select: { tickets: true } } },
      });
      const pending = await tx.ticket.findMany({
        where: { serialInformed: serial, equipmentId: null },
        select: { id: true },
      });
      if (pending.length > 0) {
        await tx.ticket.updateMany({
          where: { id: { in: pending.map((t) => t.id) } },
          data: { equipmentId: row.id },
        });
        await tx.ticketEvent.createMany({
          data: pending.map((t) => ({
            ticketId: t.id,
            type: 'EQUIPMENT_LINKED' as const,
            actorId: actor.id,
            payload: { equipmentId: row.id, serial },
            requesterVisible: false,
          })),
        });
      }
      return toView({ ...row, _count: { tickets: pending.length } }, pending.length);
    });
  }

  async update(id: number, dto: UpdateEquipmentDto): Promise<EquipmentView> {
    const current = await this.prisma.equipment.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Equipamento não encontrado.');
    if (dto.sectorId !== undefined) {
      const sector = await this.prisma.sector.findUnique({ where: { id: dto.sectorId } });
      if (!sector) throw new BadRequestException('Setor inexistente.');
    }
    if (dto.assetTag && dto.assetTag !== current.assetTag) {
      if (await this.prisma.equipment.findUnique({ where: { assetTag: dto.assetTag } })) {
        throw new ConflictException('Já existe equipamento com este número de patrimônio.');
      }
    }
    const row = await this.prisma.equipment.update({
      where: { id },
      data: dto,
      include: { sector: { select: { name: true } }, _count: { select: { tickets: true } } },
    });
    return toView(row);
  }

  async list(query: ListEquipmentQuery): Promise<Page<EquipmentView>> {
    const where: Prisma.EquipmentWhereInput = {};
    if (query.type) where.type = query.type;
    if (query.sectorId) where.sectorId = query.sectorId;
    if (query.q) {
      where.OR = [
        { serial: { contains: normalizeSerial(query.q), mode: 'insensitive' } },
        { model: { contains: query.q, mode: 'insensitive' } },
        { manufacturer: { contains: query.q, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.equipment.findMany({
        where,
        orderBy: { serial: 'asc' },
        include: { sector: { select: { name: true } }, _count: { select: { tickets: true } } },
        ...toSkipTake(query),
      }),
      this.prisma.equipment.count({ where }),
    ]);
    return { items: rows.map((row) => toView(row)), total, page: query.page, pageSize: query.pageSize };
  }

  async pending(): Promise<PendingSerial[]> {
    const tickets = await this.prisma.ticket.findMany({
      where: { equipmentId: null, status: { not: 'CANCELLED' } },
      select: { id: true, serialInformed: true, requesterName: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const grouped = new Map<string, PendingSerial>();
    for (const ticket of tickets) {
      const entry = grouped.get(ticket.serialInformed) ?? {
        serial: ticket.serialInformed,
        ticketCount: 0,
        tickets: [],
      };
      entry.ticketCount += 1;
      entry.tickets.push({ id: ticket.id, requesterName: ticket.requesterName, createdAt: ticket.createdAt });
      grouped.set(ticket.serialInformed, entry);
    }
    return [...grouped.values()];
  }
}
