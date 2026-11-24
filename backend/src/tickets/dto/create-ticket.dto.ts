import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IMPACT_OPTIONS } from '../../priority-rules/priority.util';

export class CreateTicketDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  description: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  serial: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  categoryId?: number;

  @IsIn(IMPACT_OPTIONS.AFFECTED)
  impactAffected: string;

  @IsIn(IMPACT_OPTIONS.BLOCKING)
  impactBlocking: string;

  @IsIn(IMPACT_OPTIONS.ALTERNATIVE)
  impactAlternative: string;
}
