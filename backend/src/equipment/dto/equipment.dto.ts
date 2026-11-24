import { EquipmentType } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsDate, IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationQuery } from '../../common/dto/pagination.dto';

export class CreateEquipmentDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  serial: string;

  @IsEnum(EquipmentType)
  type: EquipmentType;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  manufacturer: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  model: string;

  @Type(() => Number)
  @IsInt()
  sectorId: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  responsibleId?: number;

  @IsOptional()
  @Type(() => Date)
  @IsDate()
  acquiredAt?: Date;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  assetTag?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateEquipmentDto {
  @IsOptional()
  @IsEnum(EquipmentType)
  type?: EquipmentType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  manufacturer?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  model?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sectorId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  responsibleId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(60)
  assetTag?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class ListEquipmentQuery extends PaginationQuery {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  q?: string;

  @IsOptional()
  @IsEnum(EquipmentType)
  type?: EquipmentType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  sectorId?: number;
}
