import { Priority } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReasonDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  reason: string;
}

export class ResolveDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  solution: string;
}

export class RequestInfoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  message: string;
}

export class AssignDto {
  @Type(() => Number)
  @IsInt()
  assigneeId: number;
}

export class TriageDto {
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  justification?: string;
}

export class ChangePriorityDto {
  @IsEnum(Priority)
  priority: Priority;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  justification: string;
}

export class CorrectSerialDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  serial: string;
}
