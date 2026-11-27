import { Priority, TicketStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsIn, IsInt, IsOptional } from 'class-validator';
import { TicketFilterValues, toBoolean } from '../../common/ticket-filters';

export const REPORT_PERIODS = ['today', '7d', '30d', '90d'] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];

export class ReportPeriodQuery implements TicketFilterValues {
  @IsOptional()
  @IsIn(REPORT_PERIODS)
  period: ReportPeriod = '7d';

  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sectorId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  uncategorized?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assigneeId?: number;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  unassigned?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  equipmentId?: number;
}
