import { Priority, TicketStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDate, IsEnum, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQuery } from '../../common/dto/pagination.dto';

const toBoolean = ({ value }: { value: unknown }) => value === 'true' || value === true;

export class ListTicketsQuery extends PaginationQuery {
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
  assigneeId?: number;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  unassigned?: boolean;

  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  mine?: boolean;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  from?: Date;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  to?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  q?: string;
}
