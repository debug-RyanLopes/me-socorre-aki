import { Prisma, Priority, TicketStatus } from '@prisma/client';

export interface TicketFilterValues {
  status?: TicketStatus;
  priority?: Priority;
  sectorId?: number;
  categoryId?: number;
  uncategorized?: boolean;
  assigneeId?: number;
  unassigned?: boolean;
  equipmentId?: number;
}

export const toBoolean = ({ value }: { value: unknown }): boolean => value === 'true' || value === true;

export function ticketFilterWhere(filters: TicketFilterValues): Prisma.TicketWhereInput {
  const where: Prisma.TicketWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.sectorId) where.sectorId = filters.sectorId;
  if (filters.uncategorized) where.categoryId = null;
  else if (filters.categoryId) where.categoryId = filters.categoryId;
  if (filters.unassigned) where.assigneeId = null;
  else if (filters.assigneeId) where.assigneeId = filters.assigneeId;
  if (filters.equipmentId) where.equipmentId = filters.equipmentId;
  return where;
}

export function ticketFilterSql(filters: TicketFilterValues): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];
  if (filters.status) conditions.push(Prisma.sql`status::text = ${filters.status}`);
  if (filters.priority) conditions.push(Prisma.sql`priority::text = ${filters.priority}`);
  if (filters.sectorId) conditions.push(Prisma.sql`sector_id = ${filters.sectorId}`);
  if (filters.uncategorized) conditions.push(Prisma.sql`category_id IS NULL`);
  else if (filters.categoryId) conditions.push(Prisma.sql`category_id = ${filters.categoryId}`);
  if (filters.unassigned) conditions.push(Prisma.sql`assignee_id IS NULL`);
  else if (filters.assigneeId) conditions.push(Prisma.sql`assignee_id = ${filters.assigneeId}`);
  if (filters.equipmentId) conditions.push(Prisma.sql`equipment_id = ${filters.equipmentId}`);
  return conditions.length === 0 ? Prisma.sql`TRUE` : Prisma.join(conditions, ' AND ');
}
